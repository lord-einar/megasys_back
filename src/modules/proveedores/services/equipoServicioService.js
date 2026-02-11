// src/modules/proveedores/services/equipoServicioService.js
import { EquipoServicio, Servicio, Sede, Reclamo } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class EquipoServicioService {
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      servicio_id = null,
      sede_id = null,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { mac: { [Op.iLike]: `%${search}%` } },
        { modelo: { [Op.iLike]: `%${search}%` } },
        { marca: { [Op.iLike]: `%${search}%` } },
        { numero_serie: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (servicio_id) whereClause.servicio_id = servicio_id;
    if (sede_id) whereClause.sede_id = sede_id;
    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await EquipoServicio.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
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

  async obtenerConDetalles(equipoId) {
    const equipo = await EquipoServicio.findByPk(equipoId, {
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
          model: Reclamo,
          as: 'reclamos',
          where: { activo: true },
          required: false,
          order: [['created_at', 'DESC']],
          limit: 10
        }
      ]
    });

    return equipo ? equipo.toJSON() : null;
  }

  async crear(datosEquipo, options = {}) {
    const { servicio_id, sede_id, mac, modelo, marca, numero_serie, observaciones } = datosEquipo;

    const servicio = await Servicio.findByPk(servicio_id, options);
    if (!servicio) throw new Error('Servicio no encontrado');

    const sede = await Sede.findByPk(sede_id, options);
    if (!sede) throw new Error('Sede no encontrada');

    const nuevoEquipo = await EquipoServicio.create({
      servicio_id,
      sede_id,
      mac: mac?.trim(),
      modelo: modelo?.trim(),
      marca: marca?.trim(),
      numero_serie: numero_serie?.trim(),
      observaciones: observaciones?.trim()
    }, options);

    logger.info('Nuevo equipo de servicio creado:', {
      equipoId: nuevoEquipo.id,
      servicioId: servicio_id,
      sedeId: sede_id
    });

    return nuevoEquipo;
  }

  async actualizar(equipoId, datosActualizacion, options = {}) {
    const equipo = await EquipoServicio.findByPk(equipoId, options);
    if (!equipo) throw new Error('Equipo no encontrado');

    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      datosLimpios[key] = typeof datosActualizacion[key] === 'string'
        ? datosActualizacion[key].trim()
        : datosActualizacion[key];
    });

    await equipo.update(datosLimpios, options);
    logger.info('Equipo actualizado:', { equipoId: equipo.id });
    return equipo;
  }

  async eliminar(equipoId, options = {}) {
    const equipo = await EquipoServicio.findByPk(equipoId, options);
    if (!equipo) throw new Error('Equipo no encontrado');

    const reclamosAbiertos = await Reclamo.count({
      where: {
        equipo_id: equipoId,
        estado: { [Op.in]: ['abierto', 'en_proceso'] },
        activo: true
      },
      ...options
    });

    if (reclamosAbiertos > 0) {
      throw new Error(`No se puede eliminar. Tiene ${reclamosAbiertos} reclamo(s) abierto(s)`);
    }

    await equipo.update({ activo: false }, options);
    logger.info('Equipo eliminado (soft delete):', { equipoId: equipo.id });
    return true;
  }
}

export default new EquipoServicioService();
