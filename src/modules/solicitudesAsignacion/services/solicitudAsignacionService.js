import { Op, Sequelize } from 'sequelize';
import {
  SolicitudAsignacion,
  SolicitudAsignacionHistorial,
  SolicitudAsignacionAdjunto,
  CategoriaEquipo,
  Personal,
  Rol,
  Inventario,
  AsignacionInventario,
  TipoArticulo,
  Sede,
  Remito,
  RemitoDetalle,
  sequelize
} from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import stockAlertService from './stockAlertService.js';
import solicitudAsignacionNotificationService from './solicitudAsignacionNotificationService.js';
import { TIPO_EQUIPO_TO_TIPO_ARTICULO, tipoArticuloCoincide, etiquetaTipoEquipo } from '../../../shared/constants/tipoEquipo.js';

const ESTADOS_TERMINALES = ['finalizada', 'rechazada', 'cancelada'];
const MOTIVOS_REPOSICION = ['reposicion_robo', 'reposicion_perdida', 'reposicion_rotura'];

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
      model: CategoriaEquipo,
      as: 'categoria',
      attributes: ['id', 'nombre', 'tipo']
    },
    {
      model: Inventario,
      as: 'inventarioAsignado',
      attributes: ['id', 'marca', 'modelo', 'numero_serie', 'service_tag', 'estado', 'sede_id'],
      include: [
        { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] },
        { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede'] }
      ]
    },
    {
      model: Inventario,
      as: 'inventarioAnterior',
      attributes: ['id', 'marca', 'modelo', 'numero_serie', 'estado'],
      include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
    }
  ];

  if (!full) return base;

  return [
    ...base,
    { model: Personal, as: 'infraAsignador', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'rrhhAprobador', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'cierrePor', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'rechazadoPor', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Personal, as: 'canceladoPor', attributes: ['id', 'nombre', 'apellido', 'email'] },
    { model: Remito, as: 'remito', attributes: ['id', 'numero_remito', 'estado', 'fecha'] },
    {
      model: SolicitudAsignacionAdjunto,
      as: 'adjuntos',
      include: [{ model: Personal, as: 'subidoPor', attributes: ['id', 'nombre', 'apellido', 'email'] }]
    },
    {
      model: SolicitudAsignacionHistorial,
      as: 'historial',
      include: [{ model: Personal, as: 'actor', attributes: ['id', 'nombre', 'apellido', 'email'] }],
      order: [['created_at', 'ASC']]
    }
  ];
};

class SolicitudAsignacionService {
  async resolverPersonal(email) {
    if (!email) throw new Error('Usuario sin email');
    const personal = await Personal.findOne({
      where: { email: email.toLowerCase(), activo: true }
    });
    if (!personal) throw new Error('El usuario autenticado no está registrado como Personal activo');
    return personal;
  }

  determinarSolicitanteGrupo(roleAnalysis) {
    if (roleAnalysis?.hasInfraestructura) return 'infraestructura';
    if (roleAnalysis?.hasRRHH) return 'rrhh';
    if (roleAnalysis?.hasCompras) return 'compras';
    throw new Error('Solo Infraestructura, RRHH o Compras pueden crear solicitudes de asignación');
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

    const { rows, count } = await SolicitudAsignacion.findAndCountAll({
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
    return SolicitudAsignacion.findByPk(id, {
      include: includeRelaciones(true),
      order: [[{ model: SolicitudAsignacionHistorial, as: 'historial' }, 'created_at', 'ASC']]
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

  async lookupInventarioDisponible({ tipo_equipo, categoria_id } = {}) {
    const where = { estado: 'disponible', activo: true };

    if (tipo_equipo) {
      const nombreBuscar = TIPO_EQUIPO_TO_TIPO_ARTICULO[tipo_equipo] || 'Celular';
      const tiposArticulo = await TipoArticulo.findAll({
        where: { nombre: { [Op.iLike]: `%${nombreBuscar}%` } },
        attributes: ['id', 'nombre']
      });
      // Filtro estricto por coincidencia de tipo (evita que "PC" matchee parcialmente otros nombres).
      const idsValidos = tiposArticulo
        .filter(t => tipoArticuloCoincide(tipo_equipo, t.nombre))
        .map(t => t.id);
      if (!idsValidos.length) return [];
      where.tipo_articulo_id = { [Op.in]: idsValidos };
    }

    if (categoria_id) where.categoria_id = categoria_id;

    // Se ofrece cualquier equipo disponible del tipo/categoría, sin importar la
    // sede (consistente con lo que muestra "Stock disponible"). La sede del equipo
    // se usa luego como origen del remito.

    return Inventario.findAll({
      where,
      include: [
        { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] },
        { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede', 'localidad'] },
        { model: CategoriaEquipo, as: 'categoria', attributes: ['id', 'nombre', 'tipo'] }
      ],
      order: [['marca', 'ASC'], ['modelo', 'ASC']],
      limit: 500
    });
  }

  async crear(payload, contexto) {
    const {
      tipo_equipo,
      motivo,
      observacion_solicitante,
      beneficiario_personal_id,
      inventario_anterior_id = null,
      denuncia_presentada = null
    } = payload;

    if (!tipo_equipo || !motivo || !observacion_solicitante || !beneficiario_personal_id) {
      throw new Error('tipo_equipo, motivo, observacion_solicitante y beneficiario_personal_id son requeridos');
    }

    const beneficiario = await Personal.findByPk(beneficiario_personal_id);
    if (!beneficiario || !beneficiario.activo) {
      throw new Error('El beneficiario no existe o no está activo');
    }

    const esReposicion = MOTIVOS_REPOSICION.includes(motivo);

    if (esReposicion) {
      if (!inventario_anterior_id) {
        throw new Error('Para una reposición es obligatorio indicar el equipo actual del beneficiario');
      }
      const asignacion = await AsignacionInventario.findOne({
        where: { inventario_id: inventario_anterior_id, personal_id: beneficiario_personal_id, activo: true }
      });
      if (!asignacion) throw new Error('El equipo indicado no está asignado actualmente al beneficiario');

      const inv = await Inventario.findByPk(inventario_anterior_id, {
        include: [{ model: TipoArticulo, as: 'tipoArticulo' }]
      });
      if (!tipoArticuloCoincide(tipo_equipo, inv?.tipoArticulo?.nombre)) {
        throw new Error('El tipo del equipo actual no coincide con el tipo de equipo solicitado');
      }
    } else {
      if (inventario_anterior_id) throw new Error('inventario_anterior_id solo aplica a reposiciones');
    }

    if (motivo === 'reposicion_robo' && (denuncia_presentada === null || denuncia_presentada === undefined)) {
      throw new Error('Para reposición por robo debe indicarse si se presentó denuncia');
    }

    const solicitante = await this.resolverPersonal(contexto.email);
    const solicitante_grupo = this.determinarSolicitanteGrupo(contexto.roleAnalysis);

    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.create({
        tipo_equipo,
        motivo,
        observacion_solicitante,
        beneficiario_personal_id,
        inventario_anterior_id: esReposicion ? inventario_anterior_id : null,
        denuncia_presentada: motivo === 'reposicion_robo' ? !!denuncia_presentada : null,
        solicitante_personal_id: solicitante.id,
        solicitante_grupo,
        estado: 'pendiente_infra'
      }, { transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'creada',
        actor_personal_id: solicitante.id,
        actor_grupo: solicitante_grupo
      }, { transaction: t });

      logger.info('Solicitud de asignación creada', { id: s.id, numero: s.numero, tipo_equipo, motivo });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarCreada(completa).catch(() => {});
    return solicitud;
  }

  /**
   * Edita los datos de una solicitud ya creada. Solo permitido en estados no
   * terminales. Registra la edición en el historial y avisa por mail a
   * Compras, RRHH e Infraestructura.
   */
  async editar(id, payload, contexto) {
    const CAMPOS_EDITABLES = [
      'tipo_equipo',
      'motivo',
      'observacion_solicitante',
      'beneficiario_personal_id',
      'denuncia_presentada',
      'inventario_anterior_id'
    ];

    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (ESTADOS_TERMINALES.includes(s.estado)) {
        throw new Error(`No se puede editar una solicitud en estado ${s.estado}`);
      }

      // No permitir cambiar el tipo de equipo si ya hay un equipo asignado
      // (quedaría inconsistente con el inventario en uso).
      if (
        payload.tipo_equipo &&
        payload.tipo_equipo !== s.tipo_equipo &&
        s.inventario_asignado_id
      ) {
        throw new Error('No se puede cambiar el tipo de equipo mientras haya un equipo asignado. Liberá el equipo primero.');
      }

      // Validar beneficiario si cambia
      if (payload.beneficiario_personal_id && payload.beneficiario_personal_id !== s.beneficiario_personal_id) {
        const beneficiario = await Personal.findByPk(payload.beneficiario_personal_id, { transaction: t });
        if (!beneficiario || !beneficiario.activo) {
          throw new Error('El beneficiario no existe o no está activo');
        }
      }

      const tipoFinal = payload.tipo_equipo || s.tipo_equipo;
      const motivoFinal = payload.motivo || s.motivo;
      const esReposicion = MOTIVOS_REPOSICION.includes(motivoFinal);

      // Construir diff de campos que efectivamente cambian
      const diff = {};
      for (const campo of CAMPOS_EDITABLES) {
        if (!(campo in payload)) continue;
        let nuevoValor = payload[campo];

        if (campo === 'inventario_anterior_id') {
          nuevoValor = esReposicion ? (nuevoValor || null) : null;
        }
        if (campo === 'denuncia_presentada') {
          nuevoValor = motivoFinal === 'reposicion_robo' ? !!nuevoValor : null;
        }

        const valorActual = s.getDataValue(campo);
        if (String(valorActual ?? '') !== String(nuevoValor ?? '')) {
          diff[campo] = { antes: valorActual ?? null, despues: nuevoValor ?? null };
          s.set(campo, nuevoValor);
        }
      }

      if (Object.keys(diff).length === 0) {
        throw new Error('No hay cambios para guardar');
      }

      const actor = await this.resolverPersonal(contexto.email);
      const grupoActor = contexto.roleAnalysis?.hasInfraestructura ? 'infraestructura'
        : contexto.roleAnalysis?.hasRRHH ? 'rrhh'
        : contexto.roleAnalysis?.hasCompras ? 'compras'
        : 'desconocido';

      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'editada',
        actor_personal_id: actor.id,
        actor_grupo: grupoActor,
        comentario: payload.comentario_edicion || null,
        diff
      }, { transaction: t });

      logger.info('Solicitud de asignación editada', { id: s.id, numero: s.numero, campos: Object.keys(diff) });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarEditada(completa).catch(() => {});
    return solicitud;
  }

  /**
   * Marca la solicitud como "compra pendiente" cuando no hay stock del equipo
   * requerido. No frena el workflow: la solicitud avanza a la aprobación de RRHH
   * igual (la aprobación decide si corresponde entregar un equipo). Cuando entra
   * el stock comprado, Infra asigna el equipo editando la solicitud.
   * Avisa a Compras, RRHH e Infraestructura.
   */
  async solicitarCompra(id, { observacion } = {}, contexto) {
    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (s.estado !== 'pendiente_infra') {
        throw new Error(`Solo se puede solicitar compra desde la revisión de Infraestructura (estado actual: ${s.estado})`);
      }
      if (s.inventario_asignado_id) {
        throw new Error('La solicitud ya tiene un equipo asignado');
      }

      const actor = await this.resolverPersonal(contexto.email);
      // Solo marca la bandera. NO aprueba ni avanza el estado: la aprobación de
      // Infra es un paso explícito aparte (aprobarInfra).
      s.compra_pendiente = true;
      if (observacion) s.infra_observacion = observacion;
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'solicitud_compra',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        comentario: observacion || 'Se solicita compra por falta de stock del equipo requerido.'
      }, { transaction: t });

      logger.info('Solicitud marcada como compra pendiente', { id: s.id, numero: s.numero });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarSolicitudCompra(completa).catch(() => {});
    return solicitud;
  }

  /**
   * Aprobación explícita de Infraestructura. Requiere que se haya asignado un
   * equipo o que se haya marcado "compra pendiente". Avanza a la aprobación de RRHH.
   */
  async aprobarInfra(id, { observacion } = {}, contexto) {
    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (s.estado !== 'pendiente_infra') {
        throw new Error(`No se puede aprobar por Infraestructura desde el estado ${s.estado}`);
      }
      if (!s.inventario_asignado_id && !s.compra_pendiente) {
        throw new Error('Para aprobar debés asignar un equipo o marcar "Solicitar compra" si no hay stock');
      }

      const actor = await this.resolverPersonal(contexto.email);
      if (!s.infra_asignador_id) s.infra_asignador_id = actor.id;
      if (!s.infra_fecha) s.infra_fecha = new Date();
      if (observacion) s.infra_observacion = observacion;
      s.estado = 'pendiente_rrhh';
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'aprobada_infra',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        comentario: observacion || (s.compra_pendiente && !s.inventario_asignado_id
          ? 'Aprobada con compra pendiente (sin stock al momento)'
          : null)
      }, { transaction: t });

      logger.info('Solicitud aprobada por Infra', { id: s.id, numero: s.numero, compra_pendiente: s.compra_pendiente });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarAprobadaInfra(completa).catch(() => {});
    return solicitud;
  }

  async liberarEquipo(solicitud, t) {
    if (!solicitud.inventario_asignado_id) return;

    const inv = await Inventario.findByPk(solicitud.inventario_asignado_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (inv) {
      inv.estado = 'disponible';
      await inv.save({ transaction: t });
    }

    const asig = await AsignacionInventario.findOne({
      where: {
        inventario_id: solicitud.inventario_asignado_id,
        personal_id: solicitud.beneficiario_personal_id,
        activo: true
      },
      transaction: t
    });
    if (asig) {
      asig.activo = false;
      asig.fecha_devolucion = new Date().toISOString().slice(0, 10);
      await asig.save({ transaction: t });
    }

    solicitud.inventario_asignado_id = null;
    solicitud.categoria_id = null;
    solicitud.infra_asignador_id = null;
    solicitud.infra_fecha = null;
    solicitud.equipo_anterior_accion = null;
  }

  async asignarEquipo(id, { inventario_id, categoria_id, observacion, equipo_anterior_accion }, contexto) {
    if (!inventario_id) throw new Error('inventario_id es requerido');

    let invParaAlert = null;

    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (s.inventario_asignado_id) {
        throw new Error('La solicitud ya tiene un equipo asignado');
      }
      // Se puede asignar en cualquier paso previo a la entrega. Esto cubre el caso
      // "compra pendiente": la solicitud pudo avanzar / aprobarse sin stock y el
      // equipo se asigna cuando entra el stock comprado.
      if (!['pendiente_infra', 'pendiente_rrhh', 'aprobada'].includes(s.estado)) {
        throw new Error(`No se puede asignar equipo desde el estado ${s.estado}`);
      }

      const inventario = await Inventario.findByPk(inventario_id, {
        include: [{ model: TipoArticulo, as: 'tipoArticulo' }],
        transaction: t
      });
      if (!inventario) throw new Error('Equipo de inventario no encontrado');
      if (!inventario.activo) throw new Error('El equipo no está activo');
      if (inventario.estado !== 'disponible') throw new Error(`El equipo no está disponible (estado: ${inventario.estado})`);

      if (!tipoArticuloCoincide(s.tipo_equipo, inventario.tipoArticulo?.nombre)) {
        throw new Error(`El equipo seleccionado es ${inventario.tipoArticulo?.nombre} pero la solicitud es de ${etiquetaTipoEquipo(s.tipo_equipo)}`);
      }

      // Gestionar equipo anterior si es reposición
      if (s.esReposicion() && s.inventario_anterior_id && equipo_anterior_accion) {
        const anterior = await Inventario.findByPk(s.inventario_anterior_id, { transaction: t });
        if (anterior) {
          anterior.estado = equipo_anterior_accion;
          if (equipo_anterior_accion === 'dado_de_baja') anterior.activo = false;
          await anterior.save({ transaction: t });
        }
        const asigAnterior = await AsignacionInventario.findOne({
          where: { inventario_id: s.inventario_anterior_id, personal_id: s.beneficiario_personal_id, activo: true },
          transaction: t
        });
        if (asigAnterior) {
          asigAnterior.activo = false;
          asigAnterior.fecha_devolucion = new Date().toISOString().slice(0, 10);
          await asigAnterior.save({ transaction: t });
        }
      }

      inventario.estado = 'en_uso';
      await inventario.save({ transaction: t });

      const hoy = new Date().toISOString().slice(0, 10);
      await AsignacionInventario.create({
        inventario_id,
        personal_id: s.beneficiario_personal_id,
        fecha_asignacion: hoy,
        motivo: `Solicitud ${s.getCodigo()} [${s.id}]`,
        activo: true
      }, { transaction: t });

      const actor = await this.resolverPersonal(contexto.email);

      s.inventario_asignado_id = inventario_id;
      s.categoria_id = categoria_id || null;
      s.infra_asignador_id = actor.id;
      s.infra_fecha = new Date();
      s.infra_observacion = observacion || null;
      s.equipo_anterior_accion = equipo_anterior_accion || null;
      // Ya hay equipo asignado: se resuelve la compra pendiente (si la había).
      // Asignar el equipo NO aprueba ni avanza el workflow; eso lo hace la
      // aprobación explícita de Infra (aprobarInfra).
      s.compra_pendiente = false;
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'equipo_asignado',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        comentario: observacion || null,
        diff: {
          inventario_id,
          marca: inventario.marca,
          modelo: inventario.modelo,
          categoria_id: categoria_id || null,
          equipo_anterior_accion: equipo_anterior_accion || null
        }
      }, { transaction: t });

      invParaAlert = inventario;
      return s;
    });

    if (invParaAlert) {
      stockAlertService.checkYNotificar(
        invParaAlert.marca,
        invParaAlert.modelo,
        invParaAlert.tipo_articulo_id
      ).catch(() => {});
    }

    const completa = await this.obtener(solicitud.id);
    // Si el equipo se asignó sobre una solicitud ya aprobada por RRHH (caso de
    // compra pendiente resuelta), queda lista para generar el remito.
    if (solicitud.estado === 'aprobada') {
      solicitudAsignacionNotificationService.notificarAprobadaRrhh(completa).catch(() => {});
    }

    return solicitud;
  }

  async aprobarRrhh(id, { observacion }, contexto) {
    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (s.estado !== 'pendiente_rrhh') {
        throw new Error(`No se puede aprobar desde el estado ${s.estado}`);
      }

      const actor = await this.resolverPersonal(contexto.email);
      s.rrhh_aprobador_id = actor.id;
      s.rrhh_fecha = new Date();
      s.rrhh_observacion = observacion || null;
      s.estado = 'aprobada';
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'aprobada_rrhh',
        actor_personal_id: actor.id,
        actor_grupo: 'rrhh',
        comentario: observacion || null
      }, { transaction: t });

      logger.info('Solicitud aprobada por RRHH', { id: s.id, numero: s.numero });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarAprobadaRrhh(completa).catch(() => {});
    return solicitud;
  }

  async lookupSoporte() {
    return Personal.findAll({
      where: { activo: true },
      include: [{
        model: Rol,
        as: 'rol',
        where: { nombre: 'Tecnico sede' },
        attributes: []
      }],
      attributes: ['id', 'nombre', 'apellido', 'email'],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']]
    });
  }

  async generarRemito(id, { tecnico_id } = {}, contexto) {
    return sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, {
        include: [
          {
            model: Inventario,
            as: 'inventarioAsignado',
            include: [{ model: Sede, as: 'sedePrincipal' }]
          },
          { model: Personal, as: 'beneficiario' }
        ],
        transaction: t
      });
      if (!s) throw new Error('Solicitud no encontrada');
      if (s.estado !== 'aprobada') throw new Error(`No se puede generar remito desde el estado ${s.estado}`);
      if (!s.inventarioAsignado) throw new Error('La solicitud no tiene equipo asignado');
      if (!s.inventarioAsignado.sede_id) {
        throw new Error('El equipo asignado no tiene sede definida. Actualizá la sede del equipo en inventario antes de generar el remito.');
      }
      if (!s.beneficiario?.sede_id) {
        throw new Error('El beneficiario no tiene sede principal asignada.');
      }

      const actor = await this.resolverPersonal(contexto.email);

      const [seqRow] = await sequelize.query(
        "SELECT NEXTVAL('remito_numero_seq') AS numero",
        { type: Sequelize.QueryTypes.SELECT, transaction: t }
      );
      const year = new Date().getFullYear();
      const numero_remito = `REM-${year}-${String(seqRow.numero).padStart(3, '0')}`;

      const remito = await Remito.create({
        numero_remito,
        fecha: new Date(),
        sede_origen_id: s.inventarioAsignado.sede_id,
        sede_destino_id: s.beneficiario.sede_id,
        solicitante_id: s.beneficiario_personal_id,
        tecnico_asignado_id: tecnico_id || null,
        observaciones: `Solicitud ${s.getCodigo()} — ${s.tipo_equipo} — ${(s.motivo || '').replaceAll('_', ' ')}`
      }, { transaction: t });

      await RemitoDetalle.create({
        remito_id: remito.id,
        inventario_id: s.inventario_asignado_id,
        es_prestamo: false
      }, { transaction: t });

      s.remito_id = remito.id;
      s.estado = 'remito_generado';
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'remito_generado',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        diff: { remito_id: remito.id, numero_remito }
      }, { transaction: t });

      logger.info('Remito generado desde solicitud', { solicitud: s.getCodigo(), numero_remito });
      return s;
    });
  }

  async finalizar(id, { observacion }, contexto) {
    return sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (s.estado !== 'remito_generado') {
        throw new Error(`No se puede finalizar desde el estado ${s.estado}. El remito debe estar generado.`);
      }

      const actor = await this.resolverPersonal(contexto.email);
      s.cierre_personal_id = actor.id;
      s.cierre_fecha = new Date();
      s.cierre_observacion = observacion || null;
      s.estado = 'finalizada';
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'finalizada',
        actor_personal_id: actor.id,
        actor_grupo: 'infraestructura',
        comentario: observacion || null
      }, { transaction: t });

      logger.info('Solicitud de asignación finalizada', { id: s.id, numero: s.numero });
      return s;
    });
  }

  async rechazar(id, { motivo }, contexto) {
    if (!motivo || !motivo.trim()) throw new Error('El motivo de rechazo es obligatorio');

    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');

      const grupoActor = contexto.roleAnalysis?.hasInfraestructura ? 'infraestructura'
        : contexto.roleAnalysis?.hasRRHH ? 'rrhh'
        : null;

      if (s.estado === 'pendiente_infra' && grupoActor !== 'infraestructura') {
        throw new Error('Solo Infraestructura puede rechazar en este estado');
      }
      if (s.estado === 'pendiente_rrhh' && grupoActor !== 'rrhh') {
        throw new Error('Solo RRHH puede rechazar en este estado');
      }
      if (!['pendiente_infra', 'pendiente_rrhh'].includes(s.estado)) {
        throw new Error(`No se puede rechazar desde el estado ${s.estado}`);
      }

      if (s.estado === 'pendiente_rrhh') {
        await this.liberarEquipo(s, t);
      }

      const actor = await this.resolverPersonal(contexto.email);
      s.rechazo_motivo = motivo.trim();
      s.rechazo_por_id = actor.id;
      s.rechazo_fecha = new Date();
      s.estado = 'rechazada';
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'rechazada',
        actor_personal_id: actor.id,
        actor_grupo: grupoActor,
        comentario: motivo.trim()
      }, { transaction: t });

      logger.info('Solicitud rechazada', { id: s.id, por: actor.email, grupo: grupoActor });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarRechazada(completa).catch(() => {});
    return solicitud;
  }

  async cancelar(id, { motivo }, contexto) {
    if (!motivo || !motivo.trim()) throw new Error('El motivo de cancelación es obligatorio');

    const solicitud = await sequelize.transaction(async (t) => {
      const s = await SolicitudAsignacion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!s) throw new Error('Solicitud no encontrada');
      if (ESTADOS_TERMINALES.includes(s.estado)) {
        throw new Error(`No se puede cancelar una solicitud en estado ${s.estado}`);
      }

      if (s.inventario_asignado_id && s.estado !== 'pendiente_infra') {
        await this.liberarEquipo(s, t);
      }

      const grupoActor = contexto.roleAnalysis?.hasInfraestructura ? 'infraestructura'
        : contexto.roleAnalysis?.hasRRHH ? 'rrhh'
        : contexto.roleAnalysis?.hasCompras ? 'compras'
        : 'desconocido';

      const actor = await this.resolverPersonal(contexto.email);
      s.cancelacion_motivo = motivo.trim();
      s.cancelado_por_id = actor.id;
      s.cancelado_fecha = new Date();
      s.estado = 'cancelada';
      await s.save({ transaction: t });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: s.id,
        accion: 'cancelada',
        actor_personal_id: actor.id,
        actor_grupo: grupoActor,
        comentario: motivo.trim()
      }, { transaction: t });

      logger.info('Solicitud cancelada', { id: s.id, por: actor.email, grupo: grupoActor });
      return s;
    });

    const completa = await this.obtener(solicitud.id);
    solicitudAsignacionNotificationService.notificarCancelada(completa).catch(() => {});
    return solicitud;
  }

  async reenviarAviso(id) {
    const solicitud = await this.obtener(id);
    if (!solicitud) throw new Error('Solicitud no encontrada');
    return solicitudAsignacionNotificationService.reenviarAviso(solicitud);
  }
}

export default new SolicitudAsignacionService();
