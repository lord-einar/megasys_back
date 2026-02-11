// src/modules/proveedores/services/soporteNivelService.js
import { SoporteNivel, Servicio } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class SoporteNivelService {
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 50,
      servicio_id = null,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (servicio_id) whereClause.servicio_id = servicio_id;
    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await SoporteNivel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['servicio_id', 'ASC'], ['nivel', 'ASC']],
      include: [
        {
          model: Servicio,
          as: 'servicio',
          attributes: ['id', 'nombre', 'id_servicio']
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

  async obtenerPorId(nivelId) {
    const nivel = await SoporteNivel.findByPk(nivelId, {
      include: [
        {
          model: Servicio,
          as: 'servicio'
        }
      ]
    });

    return nivel ? nivel.toJSON() : null;
  }

  async crear(datosNivel, options = {}) {
    const { servicio_id, nivel, email, telefono, web } = datosNivel;

    const servicio = await Servicio.findByPk(servicio_id, options);
    if (!servicio) throw new Error('Servicio no encontrado');

    const nivelExistente = await SoporteNivel.findOne({
      where: { servicio_id, nivel },
      ...options
    });

    if (nivelExistente) {
      throw new Error(`Ya existe el nivel ${nivel} para este servicio`);
    }

    const nuevoNivel = await SoporteNivel.create({
      servicio_id,
      nivel,
      email: email.trim(),
      telefono: telefono?.trim(),
      web: web?.trim()
    }, options);

    logger.info('Nuevo nivel de soporte creado:', {
      nivelId: nuevoNivel.id,
      servicioId: servicio_id,
      nivel
    });

    return nuevoNivel;
  }

  async actualizar(nivelId, datosActualizacion, options = {}) {
    const nivelSoporte = await SoporteNivel.findByPk(nivelId, options);
    if (!nivelSoporte) throw new Error('Nivel de soporte no encontrado');

    if (datosActualizacion.nivel) {
      const nivelExistente = await SoporteNivel.findOne({
        where: {
          servicio_id: nivelSoporte.servicio_id,
          nivel: datosActualizacion.nivel,
          id: { [Op.ne]: nivelId }
        },
        ...options
      });

      if (nivelExistente) {
        throw new Error(`Ya existe el nivel ${datosActualizacion.nivel} para este servicio`);
      }
    }

    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      datosLimpios[key] = typeof datosActualizacion[key] === 'string'
        ? datosActualizacion[key].trim()
        : datosActualizacion[key];
    });

    await nivelSoporte.update(datosLimpios, options);
    logger.info('Nivel de soporte actualizado:', { nivelId: nivelSoporte.id });
    return nivelSoporte;
  }

  async eliminar(nivelId, options = {}) {
    const nivel = await SoporteNivel.findByPk(nivelId, options);
    if (!nivel) throw new Error('Nivel de soporte no encontrado');

    await nivel.update({ activo: false }, options);
    logger.info('Nivel de soporte eliminado (soft delete):', { nivelId: nivel.id });
    return true;
  }
}

export default new SoporteNivelService();
