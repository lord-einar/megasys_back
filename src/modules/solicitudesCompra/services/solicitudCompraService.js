// src/modules/solicitudesCompra/services/solicitudCompraService.js
import { Op } from 'sequelize';
import {
  SolicitudCompra,
  SolicitudCompraHistorial,
  SolicitudCompraAdjunto,
  CatalogoEquipo,
  Personal,
  PersonalSede,
  Inventario,
  AsignacionInventario,
  TipoArticulo,
  Sede,
  sequelize
} from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import solicitudCompraNotificationService from './solicitudCompraNotificationService.js';
import { TIPO_EQUIPO_TO_TIPO_ARTICULO, tipoArticuloCoincide } from '../../../shared/constants/tipoEquipo.js';

// Estados terminales — no se pueden editar ni transicionar.
const ESTADOS_TERMINALES = ['finalizada', 'comprada', 'rechazada', 'cancelada'];
const ESTADOS_COMPRA = ['pedido', 'recibido', 'entregado_sistemas', 'entregado_destinatario'];

// Mapeo tipo_equipo -> nombre del TipoArticulo en inventario (ver shared/constants/tipoEquipo.js)

// Campos del solicitante: si cambia alguno tras una aprobación, la solicitud
// vuelve a 'pendiente_infra' y se limpian las aprobaciones previas.
const CAMPOS_SOLICITANTE = [
  'tipo_equipo',
  'motivo',
  'observacion_solicitante',
  'beneficiario_personal_id',
  'inventario_actual_id',
  'denuncia_presentada'
];

const MOTIVOS_REPOSICION = ['reposicion_robo', 'reposicion_perdida', 'reposicion_rotura'];

// Asociaciones a incluir en listados/detalle
const includeRelaciones = (full = true) => {
  const base = [
    {
      model: Personal,
      as: 'beneficiario',
      attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id'],
      include: full ? [{ model: Sede, as: 'sede', attributes: ['id', 'nombre_sede'] }] : []
    },
    {
      model: Personal,
      as: 'solicitante',
      attributes: ['id', 'nombre', 'apellido', 'email']
    },
    {
      model: CatalogoEquipo,
      as: 'catalogoEquipo',
      attributes: ['id', 'tipo', 'marca', 'modelo']
    }
  ];

  if (!full) return base;

  return [
    ...base,
    { model: Personal, as: 'infraAprobador', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'rrhhAprobador', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'comprasResponsable', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'rechazadoPor', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'canceladoPor', attributes: ['id', 'nombre', 'apellido', 'email'] },
    {
      model: Inventario,
      as: 'inventarioActual',
      include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
    },
    {
      model: Inventario,
      as: 'inventarioCreado',
      include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
    },
    {
      model: SolicitudCompraAdjunto,
      as: 'adjuntos',
      include: [{ model: Personal, as: 'subidoPor', attributes: ['id', 'nombre', 'apellido', 'email'] }]
    },
    {
      model: SolicitudCompraHistorial,
      as: 'historial',
      include: [{ model: Personal, as: 'actor', attributes: ['id', 'nombre', 'apellido', 'email'] }],
      order: [['created_at', 'ASC']]
    }
  ];
};

class SolicitudCompraService {
  /**
   * Resuelve el Personal del usuario autenticado (por email).
   * Lo necesitamos para poblar solicitante / actores del historial.
   */
  async resolverPersonal(emailUsuario) {
    if (!emailUsuario) throw new Error('Usuario sin email');
    const personal = await Personal.findOne({
      where: { email: emailUsuario.toLowerCase(), activo: true }
    });
    if (!personal) {
      throw new Error('El usuario autenticado no está registrado como Personal activo');
    }
    return personal;
  }

  /**
   * Determina a qué grupo (infra/rrhh/compras) pertenece el creador.
   * Si pertenece a varios, prioriza Infraestructura > RRHH > Compras.
   */
  determinarSolicitanteGrupo(rolesAnalysis) {
    if (rolesAnalysis?.hasInfraestructura) return 'infraestructura';
    if (rolesAnalysis?.hasRRHH) return 'rrhh';
    if (rolesAnalysis?.hasCompras) return 'compras';
    throw new Error('El usuario no pertenece a Infraestructura, RRHH ni Compras');
  }

  async listar(filtros = {}, paginacion = {}) {
    const where = {};
    const { estado, tipo_equipo, motivo, beneficiario_personal_id, desde, hasta, q } = filtros;
    if (estado) where.estado = Array.isArray(estado) ? { [Op.in]: estado } : estado;
    if (tipo_equipo) where.tipo_equipo = tipo_equipo;
    if (motivo) where.motivo = motivo;
    if (beneficiario_personal_id) where.beneficiario_personal_id = beneficiario_personal_id;
    if (desde || hasta) {
      where.created_at = {};
      if (desde) where.created_at[Op.gte] = new Date(desde);
      if (hasta) where.created_at[Op.lte] = new Date(hasta);
    }

    const include = includeRelaciones(false);

    if (q) {
      // Búsqueda por nombre/apellido/email del beneficiario
      include[0].where = {
        [Op.or]: [
          { nombre: { [Op.iLike]: `%${q}%` } },
          { apellido: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } }
        ]
      };
      include[0].required = true;
    }

    const page = Math.max(parseInt(paginacion.page || 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(paginacion.limit || 20, 10), 1), 100);
    const offset = (page - 1) * limit;

    const { rows, count } = await SolicitudCompra.findAndCountAll({
      where,
      include,
      order: [['created_at', 'DESC']],
      distinct: true,
      limit,
      offset
    });

    return { rows, count, page, limit };
  }

  async obtener(id) {
    return SolicitudCompra.findByPk(id, {
      include: includeRelaciones(true),
      order: [[{ model: SolicitudCompraHistorial, as: 'historial' }, 'created_at', 'ASC']]
    });
  }

  async lookupPersonal({ q = '', limit = 50 } = {}) {
    const where = { activo: true };
    if (q) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${q}%` } },
        { apellido: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } }
      ];
    }

    return Personal.findAll({
      where,
      attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id'],
      include: [{ model: Sede, as: 'sede', attributes: ['id', 'nombre_sede'] }],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']],
      limit: Math.min(parseInt(limit, 10) || 50, 200)
    });
  }

  async lookupSedes({ q = '', limit = 100 } = {}) {
    const where = { activo: true };
    if (q) {
      where[Op.or] = [
        { nombre_sede: { [Op.iLike]: `%${q}%` } },
        { localidad: { [Op.iLike]: `%${q}%` } }
      ];
    }

    return Sede.findAll({
      where,
      attributes: ['id', 'nombre_sede', 'localidad', 'provincia'],
      order: [['nombre_sede', 'ASC']],
      limit: Math.min(parseInt(limit, 10) || 100, 300)
    });
  }

  async lookupInventarioAsignado({ personal_id, tipo_equipo }) {
    if (!personal_id) throw new Error('personal_id es requerido');

    const tipoArticulo = TIPO_EQUIPO_TO_TIPO_ARTICULO[tipo_equipo] || null;

    const includeInventario = {
      model: Inventario,
      as: 'inventario',
      include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
    };

    if (tipoArticulo) {
      includeInventario.include[0].where = { nombre: { [Op.iLike]: `%${tipoArticulo}%` } };
    }

    return AsignacionInventario.findAll({
      where: { personal_id, activo: true },
      include: [
        includeInventario,
        { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email'] }
      ],
      order: [['fecha_asignacion', 'DESC']]
    });
  }

  async contarAdjuntos(solicitudId, tipo, options = {}) {
    return SolicitudCompraAdjunto.count({
      where: { solicitud_id: solicitudId, tipo },
      transaction: options.transaction
    });
  }

  async validarEvidenciasParaAprobacionInfra(solicitud, options = {}) {
    if (solicitud.motivo === 'reposicion_robo' && solicitud.denuncia_presentada !== true) {
      throw new Error('Para aprobar una reposición por robo debe constar que se presentó la denuncia policial');
    }

    if (solicitud.motivo === 'reposicion_rotura') {
      const totalRotura = await this.contarAdjuntos(solicitud.id, 'rotura', options);
      if (totalRotura === 0) {
        throw new Error('Para aprobar una reposición por rotura debe cargarse una foto/evidencia del equipo dañado');
      }
    }
  }

  async resolverSedeInventario(beneficiario, transaction) {
    const sedesActivas = await PersonalSede.findAll({
      where: { personal_id: beneficiario.id, activo: true },
      attributes: ['sede_id'],
      transaction
    });

    if (sedesActivas.length > 1) {
      return null;
    }

    return sedesActivas[0]?.sede_id || beneficiario.sede_id || null;
  }

  /**
   * Crea una solicitud. El estado inicial siempre es 'pendiente_infra'.
   * Auto-aprobación de Infra se permite explícitamente en fase 4 (workflow).
   */
  async crear(payload, contexto) {
    const {
      tipo_equipo,
      motivo,
      observacion_solicitante,
      beneficiario_personal_id,
      inventario_actual_id = null,
      denuncia_presentada = null
    } = payload;

    if (!tipo_equipo || !motivo || !observacion_solicitante || !beneficiario_personal_id) {
      throw new Error('tipo_equipo, motivo, observacion_solicitante y beneficiario_personal_id son requeridos');
    }

    // Beneficiario debe existir y estar activo
    const beneficiario = await Personal.findByPk(beneficiario_personal_id);
    if (!beneficiario || !beneficiario.activo) {
      throw new Error('El beneficiario no existe o no está activo');
    }

    // Reglas por motivo
    const esReposicion = MOTIVOS_REPOSICION.includes(motivo);
    if (esReposicion) {
      if (!inventario_actual_id) {
        throw new Error('Para una reposición es obligatorio indicar el equipo actual del beneficiario');
      }
      // El equipo debe estar asignado activamente al beneficiario
      const asignacion = await AsignacionInventario.findOne({
        where: { inventario_id: inventario_actual_id, personal_id: beneficiario_personal_id, activo: true }
      });
      if (!asignacion) {
        throw new Error('El equipo indicado no está asignado actualmente al beneficiario');
      }
      // El tipo del equipo actual debe coincidir con el tipo solicitado
      const inv = await Inventario.findByPk(inventario_actual_id, {
        include: [{ model: TipoArticulo, as: 'tipoArticulo' }]
      });
      if (!tipoArticuloCoincide(tipo_equipo, inv?.tipoArticulo?.nombre)) {
        throw new Error('El tipo del equipo actual no coincide con el tipo de equipo solicitado');
      }
    } else {
      // Para nuevo_ingreso / nuevo_puesto no se admite inventario_actual_id
      if (inventario_actual_id) {
        throw new Error('inventario_actual_id solo aplica a reposiciones');
      }
    }

    // Para robo: denuncia_presentada debe ser explícitamente true o false (no null)
    if (motivo === 'reposicion_robo' && (denuncia_presentada === null || denuncia_presentada === undefined)) {
      throw new Error('Para reposición por robo debe indicarse si se presentó denuncia');
    }

    const solicitante = await this.resolverPersonal(contexto.email);
    const solicitante_grupo = this.determinarSolicitanteGrupo(contexto.roleAnalysis);

    const solicitud = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.create({
        tipo_equipo,
        motivo,
        observacion_solicitante,
        beneficiario_personal_id,
        inventario_actual_id: esReposicion ? inventario_actual_id : null,
        denuncia_presentada: motivo === 'reposicion_robo' ? !!denuncia_presentada : null,
        solicitante_personal_id: solicitante.id,
        solicitante_grupo,
        estado: 'pendiente_infra'
      }, { transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'creada',
        actor_personal_id: solicitante.id,
        actor_grupo: solicitante_grupo
      }, { transaction });

      logger.info('Solicitud de compra creada', {
        id: solicitud.id,
        numero: solicitud.numero,
        tipo_equipo,
        motivo,
        solicitante: solicitante.email
      });

      return solicitud;
    });

    const completa = await this.obtener(solicitud.id);
    await solicitudCompraNotificationService.notificarCreada(completa);
    return solicitud;
  }

  /**
   * Editar una solicitud. Si cambia algún campo del solicitante después de
   * que la solicitud ya fue aprobada por Infra/RRHH, la solicitud vuelve a
   * 'pendiente_infra' y se limpian las aprobaciones (historial: reenviada_infra).
   * Estados terminales (comprada/rechazada/cancelada) no se editan.
   */
  async actualizar(id, cambios, contexto) {
    return sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (ESTADOS_TERMINALES.includes(solicitud.estado)) {
        throw new Error(`No se puede editar una solicitud en estado ${solicitud.estado}`);
      }

      // Validar cambios por campo
      const cambiosAplicables = {};
      const diff = {};

      for (const campo of CAMPOS_SOLICITANTE) {
        if (cambios[campo] !== undefined && cambios[campo] !== solicitud[campo]) {
          cambiosAplicables[campo] = cambios[campo];
          diff[campo] = { antes: solicitud[campo], despues: cambios[campo] };
        }
      }

      if (Object.keys(cambiosAplicables).length === 0) {
        throw new Error('No hay cambios para aplicar');
      }

      // Validaciones combinadas con los nuevos valores efectivos
      const efectivo = { ...solicitud.toJSON(), ...cambiosAplicables };
      const esReposicion = MOTIVOS_REPOSICION.includes(efectivo.motivo);

      if (efectivo.beneficiario_personal_id) {
        const benef = await Personal.findByPk(efectivo.beneficiario_personal_id, { transaction });
        if (!benef || !benef.activo) throw new Error('El beneficiario no existe o no está activo');
      }

      if (esReposicion) {
        if (!efectivo.inventario_actual_id) {
          throw new Error('Para una reposición es obligatorio indicar el equipo actual');
        }
        const asignacion = await AsignacionInventario.findOne({
          where: {
            inventario_id: efectivo.inventario_actual_id,
            personal_id: efectivo.beneficiario_personal_id,
            activo: true
          },
          transaction
        });
        if (!asignacion) {
          throw new Error('El equipo indicado no está asignado actualmente al beneficiario');
        }
      } else {
        cambiosAplicables.inventario_actual_id = null;
      }

      if (efectivo.motivo === 'reposicion_robo'
          && (efectivo.denuncia_presentada === null || efectivo.denuncia_presentada === undefined)) {
        throw new Error('Para reposición por robo debe indicarse si se presentó denuncia');
      }
      if (efectivo.motivo !== 'reposicion_robo') {
        cambiosAplicables.denuncia_presentada = null;
      }

      // Aplicar cambios
      for (const [campo, valor] of Object.entries(cambiosAplicables)) {
        solicitud[campo] = valor;
      }

      // Si la solicitud ya tenía aprobaciones, las invalidamos
      const tuvoAprobacion = ['aprobada_infra', 'pendiente_pedido'].includes(solicitud.estado);
      let accionHistorial = 'editada';

      if (tuvoAprobacion) {
        solicitud.estado = 'pendiente_infra';
        solicitud.infra_aprobador_id = null;
        solicitud.infra_fecha = null;
        solicitud.infra_observacion = null;
        solicitud.infra_catalogo_equipo_id = null;
        solicitud.rrhh_aprobador_id = null;
        solicitud.rrhh_fecha = null;
        solicitud.rrhh_observacion = null;
        accionHistorial = 'reenviada_infra';
      }

      await solicitud.save({ transaction });

      const actor = await this.resolverPersonal(contexto.email);
      const actorGrupo = this.determinarSolicitanteGrupo(contexto.roleAnalysis);

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: accionHistorial,
        actor_personal_id: actor.id,
        actor_grupo: actorGrupo,
        comentario: cambios.comentario || null,
        diff
      }, { transaction });

      return solicitud;
    });
  }

  /**
   * Aprobación de Infraestructura. Solo desde estado 'pendiente_infra'.
   * Requiere indicar el modelo del catálogo a comprar.
   * Se permite auto-aprobación (el creador puede aprobar su propia solicitud).
   */
  async aprobarInfra(id, { catalogo_equipo_id, observacion }, contexto) {
    if (!catalogo_equipo_id) throw new Error('Debe indicar el equipo del catálogo a comprar');

    const solicitud = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (solicitud.estado !== 'pendiente_infra') {
        throw new Error(`No se puede aprobar como Infraestructura desde el estado ${solicitud.estado}`);
      }

      await this.validarEvidenciasParaAprobacionInfra(solicitud, { transaction });

      // Validar catálogo: existe, activo y mismo tipo de equipo
      const catalogo = await CatalogoEquipo.findByPk(catalogo_equipo_id, { transaction });
      if (!catalogo) throw new Error('Equipo del catálogo no encontrado');
      if (!catalogo.activo) throw new Error('El equipo del catálogo está inactivo');
      if (catalogo.tipo !== solicitud.tipo_equipo) {
        throw new Error(`El equipo del catálogo es ${catalogo.tipo} pero la solicitud es de ${solicitud.tipo_equipo}`);
      }

      const actor = await this.resolverPersonal(contexto.email);

      solicitud.estado = 'aprobada_infra';
      solicitud.infra_aprobador_id = actor.id;
      solicitud.infra_fecha = new Date();
      solicitud.infra_observacion = observacion || null;
      solicitud.infra_catalogo_equipo_id = catalogo.id;
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'aprobada_infra',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        comentario: observacion || null,
        diff: { catalogo_equipo: { marca: catalogo.marca, modelo: catalogo.modelo } }
      }, { transaction });

      logger.info('Solicitud aprobada por Infraestructura', {
        id: solicitud.id, numero: solicitud.numero, aprobador: actor.email
      });
      return solicitud;
    });

    const completa = await this.obtener(solicitud.id);
    await solicitudCompraNotificationService.notificarAprobadaInfra(completa);
    return solicitud;
  }

  /**
   * Aprobación de RRHH. Solo desde 'aprobada_infra'.
   */
  async aprobarRrhh(id, { observacion }, contexto) {
    const solicitud = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (solicitud.estado !== 'aprobada_infra') {
        throw new Error(`No se puede aprobar como RRHH desde el estado ${solicitud.estado}`);
      }

      const actor = await this.resolverPersonal(contexto.email);

      solicitud.estado = 'pendiente_pedido';
      solicitud.rrhh_aprobador_id = actor.id;
      solicitud.rrhh_fecha = new Date();
      solicitud.rrhh_observacion = observacion || null;
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'aprobada_rrhh',
        actor_personal_id: actor.id,
        actor_grupo: 'rrhh',
        comentario: observacion || null
      }, { transaction });

      logger.info('Solicitud aprobada por RRHH', {
        id: solicitud.id, numero: solicitud.numero, aprobador: actor.email
      });
      return solicitud;
    });

    const completa = await this.obtener(solicitud.id);
    await solicitudCompraNotificationService.notificarAprobadaRrhh(completa);
    return solicitud;
  }

  /**
   * Registra la orden de compra y mueve la solicitud a "pedido".
   * La creación del inventario se hace al cierre de Sistemas con IMEI/serie.
   */
  async registrarCompra(id, payload, contexto) {
    const { numero_oc, observacion } = payload;

    if (!numero_oc) throw new Error('numero_oc es requerido');

    const solicitudActualizada = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (solicitud.estado !== 'pendiente_pedido') {
        throw new Error(`No se puede registrar compra desde el estado ${solicitud.estado}`);
      }

      const actor = await this.resolverPersonal(contexto.email);
      solicitud.estado = 'pedido';
      solicitud.compras_responsable_id = actor.id;
      solicitud.compras_fecha = new Date();
      solicitud.compras_estado_fecha = new Date();
      solicitud.compras_numero_oc = numero_oc;
      solicitud.compras_observacion = observacion || null;
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'pedido',
        actor_personal_id: actor.id,
        actor_grupo: 'compras',
        comentario: observacion || null,
        diff: { numero_oc }
      }, { transaction });

      logger.info('Orden de compra registrada', {
        id: solicitud.id, numero: solicitud.numero,
        oc: numero_oc, responsable: actor.email
      });

      return solicitud;
    });

    return solicitudActualizada;
  }

  async actualizarEstadoCompra(id, { estado, observacion }, contexto) {
    if (!ESTADOS_COMPRA.includes(estado)) {
      throw new Error(`Estado de compra inválido: ${estado}`);
    }

    const transiciones = {
      pedido: ['pendiente_pedido'],
      recibido: ['pedido'],
      entregado_sistemas: ['recibido'],
      entregado_destinatario: ['recibido']
    };

    const solicitudActualizada = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (!transiciones[estado]?.includes(solicitud.estado)) {
        throw new Error(`No se puede pasar de ${solicitud.estado} a ${estado}`);
      }

      const actor = await this.resolverPersonal(contexto.email);
      solicitud.estado = estado;
      solicitud.compras_responsable_id = actor.id;
      solicitud.compras_estado_fecha = new Date();
      solicitud.compras_entrega_observacion = observacion || null;
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: estado,
        actor_personal_id: actor.id,
        actor_grupo: 'compras',
        comentario: observacion || null
      }, { transaction });

      return solicitud;
    });

    // Cuando el equipo llega a Sistemas, notificar a Infra para que cargue IMEI / serie.
    if (estado === 'entregado_sistemas') {
      const completa = await this.obtener(solicitudActualizada.id);
      await solicitudCompraNotificationService.notificarEntregadoSistemas(completa);
    }

    return solicitudActualizada;
  }

  async finalizarSistemas(id, payload, contexto) {
    const { imei, numero_serie, fecha_adquisicion, valor_adquisicion, observacion } = payload;

    return sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, {
        include: [{ model: CatalogoEquipo, as: 'catalogoEquipo' }],
        transaction
      });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (!['entregado_sistemas', 'entregado_destinatario'].includes(solicitud.estado)) {
        throw new Error(`No se puede finalizar desde el estado ${solicitud.estado}`);
      }
      if (solicitud.tipo_equipo === 'celular' && !imei) {
        throw new Error('Para celulares debe cargarse el IMEI');
      }
      if (solicitud.tipo_equipo === 'notebook' && !numero_serie) {
        throw new Error('Para notebooks debe cargarse el número de serie');
      }
      if (!solicitud.catalogoEquipo) {
        throw new Error('La solicitud no tiene equipo de catálogo aprobado por Infraestructura');
      }

      const nombreTipo = TIPO_EQUIPO_TO_TIPO_ARTICULO[solicitud.tipo_equipo];
      const tipoArticulo = await TipoArticulo.findOne({ where: { nombre: nombreTipo }, transaction });
      if (!tipoArticulo) {
        throw new Error(`No se encuentra el tipo de artículo "${nombreTipo}" en el sistema`);
      }

      const actor = await this.resolverPersonal(contexto.email);
      const beneficiario = await Personal.findByPk(solicitud.beneficiario_personal_id, { transaction });
      if (!beneficiario) throw new Error('Beneficiario no encontrado');

      const hoy = new Date().toISOString().slice(0, 10);

      if (solicitud.esReposicion() && solicitud.inventario_actual_id) {
        const previo = await Inventario.findByPk(solicitud.inventario_actual_id, { transaction });
        if (previo) {
          previo.estado = 'dado_de_baja';
          previo.activo = false;
          await previo.save({ transaction });
        }

        const asignacionPrevia = await AsignacionInventario.findOne({
          where: {
            inventario_id: solicitud.inventario_actual_id,
            personal_id: solicitud.beneficiario_personal_id,
            activo: true
          },
          transaction
        });
        if (asignacionPrevia) {
          asignacionPrevia.activo = false;
          asignacionPrevia.fecha_devolucion = hoy;
          await asignacionPrevia.save({ transaction });
        }
      }

      const sedeDestino = await this.resolverSedeInventario(beneficiario, transaction);
      const identificadorSerie = solicitud.tipo_equipo === 'notebook' ? numero_serie : imei;

      const nuevoInventario = await Inventario.create({
        tipo_articulo_id: tipoArticulo.id,
        marca: solicitud.catalogoEquipo.marca,
        modelo: solicitud.catalogoEquipo.modelo,
        numero_serie: identificadorSerie,
        sede_id: sedeDestino,
        estado: 'en_uso',
        activo: true,
        fecha_adquisicion: fecha_adquisicion || hoy,
        valor_adquisicion: valor_adquisicion || null,
        observaciones: observacion || `Compra ${solicitud.getCodigo()} (OC ${solicitud.compras_numero_oc || 'sin OC'})`
      }, { transaction });

      await AsignacionInventario.create({
        inventario_id: nuevoInventario.id,
        personal_id: solicitud.beneficiario_personal_id,
        fecha_asignacion: hoy,
        motivo: `Solicitud ${solicitud.getCodigo()} (OC ${solicitud.compras_numero_oc || 'sin OC'})`,
        activo: true
      }, { transaction });

      solicitud.estado = 'finalizada';
      solicitud.imei = solicitud.tipo_equipo === 'celular' ? imei : null;
      solicitud.numero_serie_final = solicitud.tipo_equipo === 'notebook' ? numero_serie : null;
      solicitud.sistemas_fecha = new Date();
      solicitud.sistemas_observacion = observacion || null;
      solicitud.inventario_creado_id = nuevoInventario.id;
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'finalizada',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        comentario: observacion || null,
        diff: {
          inventario_creado_id: nuevoInventario.id,
          imei: solicitud.imei,
          numero_serie: solicitud.numero_serie_final,
          sede_id: sedeDestino
        }
      }, { transaction });

      return solicitud;
    });
  }

  /**
   * Rechazar solicitud. Solo grupos Infra (en pendiente_infra) y RRHH (en aprobada_infra).
   * El motivo es obligatorio.
   */
  async rechazar(id, { motivo }, contexto) {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de rechazo es obligatorio');
    }

    const solicitud = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');

      const grupoActor = this.determinarSolicitanteGrupo(contexto.roleAnalysis);

      // Quién puede rechazar en cada estado
      if (solicitud.estado === 'pendiente_infra' && grupoActor !== 'infraestructura') {
        throw new Error('Solo Infraestructura puede rechazar en este estado');
      }
      if (solicitud.estado === 'aprobada_infra' && grupoActor !== 'rrhh') {
        throw new Error('Solo RRHH puede rechazar en este estado');
      }
      if (!['pendiente_infra', 'aprobada_infra'].includes(solicitud.estado)) {
        throw new Error(`No se puede rechazar desde el estado ${solicitud.estado}`);
      }

      const actor = await this.resolverPersonal(contexto.email);

      solicitud.estado = 'rechazada';
      solicitud.rechazo_motivo = motivo.trim();
      solicitud.rechazo_por_id = actor.id;
      solicitud.rechazo_fecha = new Date();
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'rechazada',
        actor_personal_id: actor.id,
        actor_grupo: grupoActor,
        comentario: motivo.trim()
      }, { transaction });

      logger.info('Solicitud rechazada', {
        id: solicitud.id, numero: solicitud.numero, por: actor.email, grupo: grupoActor
      });
      return solicitud;
    });

    const completa = await this.obtener(solicitud.id);
    await solicitudCompraNotificationService.notificarRechazada(completa);
    return solicitud;
  }

  /**
   * Cancelar solicitud. Disponible para Infra/RRHH/Compras desde cualquier estado
   * no terminal. Motivo obligatorio.
   */
  async cancelar(id, { motivo }, contexto) {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de cancelación es obligatorio');
    }

    const solicitud = await sequelize.transaction(async (transaction) => {
      const solicitud = await SolicitudCompra.findByPk(id, { transaction });
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (ESTADOS_TERMINALES.includes(solicitud.estado)) {
        throw new Error(`No se puede cancelar una solicitud en estado ${solicitud.estado}`);
      }

      const actor = await this.resolverPersonal(contexto.email);
      const grupoActor = this.determinarSolicitanteGrupo(contexto.roleAnalysis);

      solicitud.estado = 'cancelada';
      solicitud.cancelacion_motivo = motivo.trim();
      solicitud.cancelado_por_id = actor.id;
      solicitud.cancelado_fecha = new Date();
      await solicitud.save({ transaction });

      await SolicitudCompraHistorial.create({
        solicitud_id: solicitud.id,
        accion: 'cancelada',
        actor_personal_id: actor.id,
        actor_grupo: grupoActor,
        comentario: motivo.trim()
      }, { transaction });

      logger.info('Solicitud cancelada', {
        id: solicitud.id, numero: solicitud.numero, por: actor.email, grupo: grupoActor
      });
      return solicitud;
    });

    const completa = await this.obtener(solicitud.id);
    await solicitudCompraNotificationService.notificarCancelada(completa);
    return solicitud;
  }
}

export default new SolicitudCompraService();
