// src/modules/proveedores/services/ejecutivoCuentasService.js
import { EjecutivoCuentas, Proveedor, TipoServicio } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class EjecutivoCuentasService {
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
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (proveedor_id) {
      whereClause.proveedor_id = proveedor_id;
    }

    if (tipo_servicio_id) {
      whereClause.tipo_servicio_id = tipo_servicio_id;
    }

    if (activo !== null && activo !== undefined) {
      whereClause.activo = activo === 'true' || activo === true;
    } else {
      whereClause.activo = true;
    }

    const { count, rows } = await EjecutivoCuentas.findAndCountAll({
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
          attributes: ['id', 'nombre'],
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

  async obtenerPorId(ejecutivoId) {
    const ejecutivo = await EjecutivoCuentas.findByPk(ejecutivoId, {
      include: [
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: TipoServicio,
          as: 'tipoServicio',
          required: false
        }
      ]
    });

    return ejecutivo ? ejecutivo.toJSON() : null;
  }

  async crear(datosEjecutivo, options = {}) {
    const { proveedor_id, tipo_servicio_id, nombre, apellido, email, telefono } = datosEjecutivo;

    // Verificar que el proveedor existe
    const proveedor = await Proveedor.findByPk(proveedor_id, options);
    if (!proveedor) {
      throw new Error('Proveedor no encontrado');
    }

    // Verificar tipo de servicio si se proporciona
    if (tipo_servicio_id) {
      const tipoServicio = await TipoServicio.findByPk(tipo_servicio_id, options);
      if (!tipoServicio) {
        throw new Error('Tipo de servicio no encontrado');
      }
    }

    const nuevoEjecutivo = await EjecutivoCuentas.create({
      proveedor_id,
      tipo_servicio_id,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim(),
      telefono: telefono?.trim()
    }, options);

    logger.info('Nuevo ejecutivo de cuentas creado:', {
      ejecutivoId: nuevoEjecutivo.id,
      nombre: nuevoEjecutivo.nombre,
      proveedorId: proveedor_id
    });

    return nuevoEjecutivo;
  }

  async actualizar(ejecutivoId, datosActualizacion, options = {}) {
    const ejecutivo = await EjecutivoCuentas.findByPk(ejecutivoId, options);

    if (!ejecutivo) {
      throw new Error('Ejecutivo de cuentas no encontrado');
    }

    // Verificar proveedor si se cambia
    if (datosActualizacion.proveedor_id) {
      const proveedor = await Proveedor.findByPk(datosActualizacion.proveedor_id, options);
      if (!proveedor) {
        throw new Error('Proveedor no encontrado');
      }
    }

    // Verificar tipo de servicio si se cambia
    if (datosActualizacion.tipo_servicio_id) {
      const tipoServicio = await TipoServicio.findByPk(datosActualizacion.tipo_servicio_id, options);
      if (!tipoServicio) {
        throw new Error('Tipo de servicio no encontrado');
      }
    }

    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      if (typeof datosActualizacion[key] === 'string') {
        datosLimpios[key] = datosActualizacion[key].trim();
      } else {
        datosLimpios[key] = datosActualizacion[key];
      }
    });

    await ejecutivo.update(datosLimpios, options);

    logger.info('Ejecutivo de cuentas actualizado:', {
      ejecutivoId: ejecutivo.id,
      cambios: Object.keys(datosLimpios)
    });

    return ejecutivo;
  }

  async eliminar(ejecutivoId, options = {}) {
    const ejecutivo = await EjecutivoCuentas.findByPk(ejecutivoId, options);

    if (!ejecutivo) {
      throw new Error('Ejecutivo de cuentas no encontrado');
    }

    await ejecutivo.update({ activo: false }, options);

    logger.info('Ejecutivo de cuentas eliminado (soft delete):', {
      ejecutivoId: ejecutivo.id,
      nombre: ejecutivo.nombre
    });

    return true;
  }
}

export default new EjecutivoCuentasService();
