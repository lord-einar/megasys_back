// src/modules/proveedores/services/soporteNivelService.js
import { SoporteNivel, Proveedor, TipoServicio } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class SoporteNivelService {
  /**
   * Listar niveles de soporte de un proveedor para un tipo de servicio
   */
  async listarPorProveedorYTipo(proveedorId, tipoServicioId, filters = {}) {
    const {
      page = 1,
      limit = 50,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {
      proveedor_id: proveedorId,
      tipo_servicio_id: tipoServicioId
    };

    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await SoporteNivel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['nivel', 'ASC']],
      include: [
        {
          model: TipoServicio,
          as: 'tipoServicio',
          attributes: ['id', 'nombre']
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

  /**
   * Listar todos los niveles de soporte de un proveedor (agrupados por tipo de servicio)
   */
  async listarPorProveedor(proveedorId, filters = {}) {
    const {
      page = 1,
      limit = 50,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {
      proveedor_id: proveedorId
    };

    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await SoporteNivel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['tipo_servicio_id', 'ASC'], ['nivel', 'ASC']],
      include: [
        {
          model: TipoServicio,
          as: 'tipoServicio',
          attributes: ['id', 'nombre']
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
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'empresa']
        },
        {
          model: TipoServicio,
          as: 'tipoServicio',
          attributes: ['id', 'nombre']
        }
      ]
    });

    return nivel ? nivel.toJSON() : null;
  }

  async crear(proveedorId, tipoServicioId, datosNivel, options = {}) {
    const { nivel, email, telefono, web } = datosNivel;

    // Verificar que el proveedor existe
    const proveedor = await Proveedor.findByPk(proveedorId, options);
    if (!proveedor) throw new Error('Proveedor no encontrado');

    // Verificar que el tipo de servicio existe
    const tipoServicio = await TipoServicio.findByPk(tipoServicioId, options);
    if (!tipoServicio) throw new Error('Tipo de servicio no encontrado');

    // Verificar que no exista ya este nivel para este proveedor + tipo
    const nivelExistente = await SoporteNivel.findOne({
      where: {
        proveedor_id: proveedorId,
        tipo_servicio_id: tipoServicioId,
        nivel
      },
      ...options
    });

    if (nivelExistente) {
      throw new Error(`Ya existe el nivel ${nivel} de soporte de ${tipoServicio.nombre} para este proveedor`);
    }

    const nuevoNivel = await SoporteNivel.create({
      proveedor_id: proveedorId,
      tipo_servicio_id: tipoServicioId,
      nivel,
      email: email?.trim(),
      telefono: telefono?.trim(),
      web: web?.trim()
    }, options);

    logger.info('Nuevo nivel de soporte creado:', {
      nivelId: nuevoNivel.id,
      proveedorId,
      tipoServicioId,
      nivel
    });

    return nuevoNivel;
  }

  async actualizar(nivelId, datosActualizacion, options = {}) {
    const nivelSoporte = await SoporteNivel.findByPk(nivelId, options);
    if (!nivelSoporte) throw new Error('Nivel de soporte no encontrado');

    // Si se cambia el nivel, verificar unicidad
    if (datosActualizacion.nivel) {
      const nivelExistente = await SoporteNivel.findOne({
        where: {
          proveedor_id: nivelSoporte.proveedor_id,
          tipo_servicio_id: nivelSoporte.tipo_servicio_id,
          nivel: datosActualizacion.nivel,
          id: { [Op.ne]: nivelId }
        },
        ...options
      });

      if (nivelExistente) {
        throw new Error(`Ya existe el nivel ${datosActualizacion.nivel} para este proveedor y tipo de servicio`);
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
