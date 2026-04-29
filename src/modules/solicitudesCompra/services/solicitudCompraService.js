// src/modules/solicitudesCompra/services/solicitudCompraService.js
import { Op } from 'sequelize';
import {
  SolicitudCompra,
  SolicitudCompraHistorial,
  SolicitudCompraAdjunto,
  CatalogoEquipo,
  Personal,
  Inventario,
  AsignacionInventario,
  TipoArticulo,
  Sede,
  sequelize
} from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';

// Estados terminales — no se pueden editar.
const ESTADOS_TERMINALES = ['comprada', 'rechazada', 'cancelada'];

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
      const nombreTipo = (inv?.tipoArticulo?.nombre || '').toLowerCase();
      const matchCelular = tipo_equipo === 'celular' && nombreTipo.includes('cel');
      const matchNotebook = tipo_equipo === 'notebook' && nombreTipo.includes('notebook');
      if (!matchCelular && !matchNotebook) {
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

    return sequelize.transaction(async (transaction) => {
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
      const tuvoAprobacion = ['aprobada_infra', 'aprobada_rrhh'].includes(solicitud.estado);
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
}

export default new SolicitudCompraService();
