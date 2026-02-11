// src/modules/proveedores/services/reclamoService.js
import { Reclamo, Servicio, Sede, EquipoServicio, Personal, sequelize } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class ReclamoService {
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      servicio_id = null,
      sede_id = null,
      estado = null,
      prioridad = null,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { numero_reclamo: { [Op.iLike]: `%${search}%` } },
        { titulo: { [Op.iLike]: `%${search}%` } },
        { descripcion: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (servicio_id) whereClause.servicio_id = servicio_id;
    if (sede_id) whereClause.sede_id = sede_id;
    if (estado) whereClause.estado = estado;
    if (prioridad) whereClause.prioridad = prioridad;
    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await Reclamo.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [
        ['prioridad', 'DESC'],
        ['fecha_apertura', 'DESC']
      ],
      include: [
        {
          model: Servicio,
          as: 'servicio',
          attributes: ['id', 'nombre', 'id_servicio']
        },
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede', 'localidad']
        },
        {
          model: EquipoServicio,
          as: 'equipo',
          attributes: ['id', 'mac', 'modelo', 'marca'],
          required: false
        },
        {
          model: Personal,
          as: 'creador',
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Personal,
          as: 'tecnicoAsignado',
          attributes: ['id', 'nombre', 'apellido', 'email'],
          required: false
        }
      ]
    });

    return {
      rows,
      count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    };
  }

  async obtenerConDetalles(reclamoId) {
    const reclamo = await Reclamo.findByPk(reclamoId, {
      include: [
        {
          model: Servicio,
          as: 'servicio',
          include: ['proveedor', 'tipoServicio']
        },
        {
          model: Sede,
          as: 'sede'
        },
        {
          model: EquipoServicio,
          as: 'equipo',
          include: ['servicio'],
          required: false
        },
        {
          model: Personal,
          as: 'creador'
        },
        {
          model: Personal,
          as: 'tecnicoAsignado',
          required: false
        }
      ]
    });

    return reclamo ? reclamo.toJSON() : null;
  }

  async crear(datosReclamo, usuarioId, options = {}) {
    const {
      servicio_id,
      sede_id,
      equipo_id,
      titulo,
      descripcion,
      prioridad = 'media',
      asignado_a_id
    } = datosReclamo;

    const servicio = await Servicio.findByPk(servicio_id, options);
    if (!servicio) throw new Error('Servicio no encontrado');

    const sede = await Sede.findByPk(sede_id, options);
    if (!sede) throw new Error('Sede no encontrada');

    if (equipo_id) {
      const equipo = await EquipoServicio.findByPk(equipo_id, options);
      if (!equipo) throw new Error('Equipo no encontrado');
    }

    if (asignado_a_id) {
      const tecnico = await Personal.findByPk(asignado_a_id, options);
      if (!tecnico) throw new Error('Técnico asignado no encontrado');
    }

    // Generar número de reclamo único
    const count = await Reclamo.count();
    const numero_reclamo = `REC-${String(count + 1).padStart(6, '0')}`;

    const nuevoReclamo = await Reclamo.create({
      numero_reclamo,
      servicio_id,
      sede_id,
      equipo_id,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      prioridad,
      creado_por_id: usuarioId,
      asignado_a_id
    }, options);

    logger.info('Nuevo reclamo creado:', {
      reclamoId: nuevoReclamo.id,
      numero_reclamo,
      prioridad
    });

    return nuevoReclamo;
  }

  async actualizar(reclamoId, datosActualizacion, options = {}) {
    const reclamo = await Reclamo.findByPk(reclamoId, options);
    if (!reclamo) throw new Error('Reclamo no encontrado');

    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      datosLimpios[key] = typeof datosActualizacion[key] === 'string'
        ? datosActualizacion[key].trim()
        : datosActualizacion[key];
    });

    await reclamo.update(datosLimpios, options);
    logger.info('Reclamo actualizado:', {
      reclamoId: reclamo.id,
      cambios: Object.keys(datosLimpios)
    });
    return reclamo;
  }

  async cambiarEstado(reclamoId, nuevoEstado, options = {}) {
    const reclamo = await Reclamo.findByPk(reclamoId, options);
    if (!reclamo) throw new Error('Reclamo no encontrado');

    await reclamo.update({ estado: nuevoEstado }, options);

    logger.info('Estado de reclamo actualizado:', {
      reclamoId: reclamo.id,
      numero_reclamo: reclamo.numero_reclamo,
      estadoAnterior: reclamo.estado,
      nuevoEstado
    });

    return reclamo;
  }

  async asignarTecnico(reclamoId, tecnicoId, options = {}) {
    const reclamo = await Reclamo.findByPk(reclamoId, options);
    if (!reclamo) throw new Error('Reclamo no encontrado');

    const tecnico = await Personal.findByPk(tecnicoId, options);
    if (!tecnico) throw new Error('Técnico no encontrado');

    await reclamo.update({
      asignado_a_id: tecnicoId,
      estado: 'en_proceso'
    }, options);

    logger.info('Técnico asignado a reclamo:', {
      reclamoId: reclamo.id,
      tecnicoId
    });

    return reclamo;
  }

  async obtenerEstadisticas() {
    const [estadoStats, prioridadStats] = await Promise.all([
      Reclamo.findAll({
        attributes: [
          'estado',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total']
        ],
        where: { activo: true },
        group: ['estado'],
        raw: true
      }),
      Reclamo.findAll({
        attributes: [
          'prioridad',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total']
        ],
        where: { activo: true },
        group: ['prioridad'],
        raw: true
      })
    ]);

    return {
      porEstado: estadoStats.reduce((acc, item) => {
        acc[item.estado] = parseInt(item.total);
        return acc;
      }, {}),
      porPrioridad: prioridadStats.reduce((acc, item) => {
        acc[item.prioridad] = parseInt(item.total);
        return acc;
      }, {})
    };
  }
}

export default new ReclamoService();
