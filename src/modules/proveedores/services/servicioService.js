// src/modules/proveedores/services/servicioService.js
import { Servicio, Proveedor, TipoServicio, SoporteNivel, EquipoServicio, Sede } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class ServicioService {
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      proveedor_id = null,
      tipo_servicio_id = null,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { id_servicio: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (proveedor_id) whereClause.proveedor_id = proveedor_id;
    if (tipo_servicio_id) whereClause.tipo_servicio_id = tipo_servicio_id;
    whereClause.activo = activo !== null ? (activo === 'true' || activo === true) : true;

    const { count, rows } = await Servicio.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['nombre', 'ASC']],
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

  async obtenerConDetalles(servicioId) {
    const servicio = await Servicio.findByPk(servicioId, {
      include: [
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: TipoServicio,
          as: 'tipoServicio'
        },
        {
          model: SoporteNivel,
          as: 'nivelessoporte',
          where: { activo: true },
          required: false
        },
        {
          model: EquipoServicio,
          as: 'equipos',
          where: { activo: true },
          required: false,
          include: [
            {
              model: Sede,
              as: 'sede',
              attributes: ['id', 'nombre_sede', 'localidad']
            }
          ]
        },
        {
          model: Sede,
          as: 'sedesServicio',
          through: {
            attributes: ['fecha_contratacion', 'fecha_vencimiento', 'activo']
          },
          attributes: ['id', 'nombre_sede', 'localidad']
        }
      ]
    });

    return servicio ? servicio.toJSON() : null;
  }

  async crear(datosServicio, options = {}) {
    const { nombre, tipo_servicio_id, proveedor_id, id_servicio, descripcion } = datosServicio;

    const proveedor = await Proveedor.findByPk(proveedor_id, options);
    if (!proveedor) throw new Error('Proveedor no encontrado');

    const tipoServicio = await TipoServicio.findByPk(tipo_servicio_id, options);
    if (!tipoServicio) throw new Error('Tipo de servicio no encontrado');

    if (id_servicio) {
      const servicioExistente = await Servicio.findOne({
        where: { id_servicio: id_servicio.trim() },
        ...options
      });
      if (servicioExistente) {
        throw new Error('Ya existe un servicio con este ID de servicio');
      }
    }

    const nuevoServicio = await Servicio.create({
      nombre: nombre.trim(),
      tipo_servicio_id,
      proveedor_id,
      id_servicio: id_servicio?.trim(),
      descripcion: descripcion?.trim()
    }, options);

    logger.info('Nuevo servicio creado:', {
      servicioId: nuevoServicio.id,
      nombre: nuevoServicio.nombre
    });

    return nuevoServicio;
  }

  async actualizar(servicioId, datosActualizacion, options = {}) {
    const servicio = await Servicio.findByPk(servicioId, options);
    if (!servicio) throw new Error('Servicio no encontrado');

    if (datosActualizacion.id_servicio) {
      const servicioExistente = await Servicio.findOne({
        where: {
          id_servicio: datosActualizacion.id_servicio.trim(),
          id: { [Op.ne]: servicioId }
        },
        ...options
      });
      if (servicioExistente) {
        throw new Error('Ya existe un servicio con este ID de servicio');
      }
    }

    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      datosLimpios[key] = typeof datosActualizacion[key] === 'string'
        ? datosActualizacion[key].trim()
        : datosActualizacion[key];
    });

    await servicio.update(datosLimpios, options);
    logger.info('Servicio actualizado:', { servicioId: servicio.id });
    return servicio;
  }

  async eliminar(servicioId, options = {}) {
    const servicio = await Servicio.findByPk(servicioId, options);
    if (!servicio) throw new Error('Servicio no encontrado');

    await servicio.update({ activo: false }, options);
    logger.info('Servicio eliminado (soft delete):', { servicioId: servicio.id });
    return true;
  }
}

export default new ServicioService();
