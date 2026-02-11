// src/modules/proveedores/services/tipoServicioService.js
import { TipoServicio, Servicio } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class TipoServicioService {
  async listar(filters = {}) {
    const { page = 1, limit = 50, search = '', activo = null } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause.nombre = { [Op.iLike]: `%${search}%` };
    }

    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await TipoServicio.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['nombre', 'ASC']]
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

  async obtenerPorId(tipoId) {
    return await TipoServicio.findByPk(tipoId);
  }

  async crear(datosTipo, options = {}) {
    const { nombre, descripcion } = datosTipo;

    const tipoExistente = await TipoServicio.findOne({
      where: { nombre: nombre.trim() },
      ...options
    });

    if (tipoExistente) {
      throw new Error('Ya existe un tipo de servicio con este nombre');
    }

    const nuevoTipo = await TipoServicio.create({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim()
    }, options);

    logger.info('Nuevo tipo de servicio creado:', {
      tipoId: nuevoTipo.id,
      nombre: nuevoTipo.nombre
    });

    return nuevoTipo;
  }

  async actualizar(tipoId, datosActualizacion, options = {}) {
    const tipo = await TipoServicio.findByPk(tipoId, options);
    if (!tipo) throw new Error('Tipo de servicio no encontrado');

    if (datosActualizacion.nombre) {
      const tipoExistente = await TipoServicio.findOne({
        where: {
          nombre: datosActualizacion.nombre.trim(),
          id: { [Op.ne]: tipoId }
        },
        ...options
      });

      if (tipoExistente) {
        throw new Error('Ya existe un tipo de servicio con este nombre');
      }
    }

    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      datosLimpios[key] = typeof datosActualizacion[key] === 'string'
        ? datosActualizacion[key].trim()
        : datosActualizacion[key];
    });

    await tipo.update(datosLimpios, options);
    logger.info('Tipo de servicio actualizado:', { tipoId: tipo.id });
    return tipo;
  }

  async eliminar(tipoId, options = {}) {
    const tipo = await TipoServicio.findByPk(tipoId, options);
    if (!tipo) throw new Error('Tipo de servicio no encontrado');

    const serviciosActivos = await Servicio.count({
      where: { tipo_servicio_id: tipoId, activo: true },
      ...options
    });

    if (serviciosActivos > 0) {
      throw new Error(`No se puede eliminar. Tiene ${serviciosActivos} servicio(s) activo(s)`);
    }

    await tipo.update({ activo: false }, options);
    logger.info('Tipo de servicio eliminado:', { tipoId: tipo.id });
    return true;
  }
}

export default new TipoServicioService();
