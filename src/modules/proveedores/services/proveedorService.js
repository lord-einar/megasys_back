// src/modules/proveedores/services/proveedorService.js
import { Proveedor, EjecutivoCuentas, Servicio, TipoServicio, SoporteNivel, Sede, Empresa, sequelize } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';

class ProveedorService {
  /**
   * Listar proveedores con filtros y paginación
   */
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { empresa: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (activo !== null && activo !== undefined) {
      whereClause.activo = activo === 'true' || activo === true;
    } else {
      whereClause.activo = true;
    }

    const { count, rows } = await Proveedor.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['empresa', 'ASC']],
      include: [
        {
          model: EjecutivoCuentas,
          as: 'ejecutivos',
          where: { activo: true },
          required: false,
          attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
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
   * Obtener proveedor con detalles completos
   */
  async obtenerConDetalles(proveedorId) {
    const proveedor = await Proveedor.findByPk(proveedorId, {
      include: [
        {
          model: EjecutivoCuentas,
          as: 'ejecutivos',
          where: { activo: true },
          required: false,
          include: [
            {
              model: TipoServicio,
              as: 'tipoServicio',
              attributes: ['id', 'nombre']
            }
          ]
        },
        {
          model: Servicio,
          as: 'servicios',
          where: { activo: true },
          required: false,
          include: [
            {
              model: TipoServicio,
              as: 'tipoServicio',
              attributes: ['id', 'nombre']
            },
            {
              model: Sede,
              as: 'sedesServicio',
              attributes: ['id', 'nombre_sede'],
              through: { attributes: [] },
              include: [
                {
                  model: Empresa,
                  as: 'empresa',
                  attributes: ['id', 'nombre_empresa']
                }
              ]
            }
          ]
        },
        {
          model: SoporteNivel,
          as: 'soporteNiveles',
          where: { activo: true },
          required: false,
          include: [
            {
              model: TipoServicio,
              as: 'tipoServicio',
              attributes: ['id', 'nombre']
            }
          ],
          order: [['nivel', 'ASC']]
        }
      ]
    });

    return proveedor ? proveedor.toJSON() : null;
  }

  /**
   * Crear nuevo proveedor (solo empresa y dirección opcional)
   */
  async crear(datosProveedor, options = {}) {
    const { empresa, direccion } = datosProveedor;

    // Verificar si ya existe (activo o inactivo)
    const proveedorExistente = await Proveedor.findOne({
      where: { empresa: empresa.trim() },
      ...options
    });

    if (proveedorExistente) {
      if (!proveedorExistente.activo) {
        throw new Error('Este proveedor existe pero está inactivo. Puede reactivarlo desde el listado de proveedores.');
      }
      throw new Error('Ya existe un proveedor activo con este nombre de empresa');
    }

    const nuevoProveedor = await Proveedor.create({
      empresa: empresa.trim(),
      direccion: direccion?.trim()
    }, options);

    logger.info('Nuevo proveedor creado:', {
      proveedorId: nuevoProveedor.id,
      empresa: nuevoProveedor.empresa
    });

    return nuevoProveedor;
  }

  /**
   * Actualizar proveedor
   */
  async actualizar(proveedorId, datosActualizacion, options = {}) {
    const proveedor = await Proveedor.findByPk(proveedorId, options);

    if (!proveedor) {
      throw new Error('Proveedor no encontrado');
    }

    // Verificar unicidad si se cambia el nombre
    if (datosActualizacion.empresa) {
      const proveedorExistente = await Proveedor.findOne({
        where: {
          empresa: datosActualizacion.empresa.trim(),
          id: { [Op.ne]: proveedorId }
        },
        ...options
      });

      if (proveedorExistente) {
        throw new Error('Ya existe un proveedor con este nombre de empresa');
      }
    }

    // Limpiar datos
    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      if (typeof datosActualizacion[key] === 'string') {
        datosLimpios[key] = datosActualizacion[key].trim();
      } else {
        datosLimpios[key] = datosActualizacion[key];
      }
    });

    await proveedor.update(datosLimpios, options);

    logger.info('Proveedor actualizado:', {
      proveedorId: proveedor.id,
      cambios: Object.keys(datosLimpios)
    });

    return proveedor;
  }

  /**
   * Eliminar proveedor (soft delete)
   */
  async eliminar(proveedorId, options = {}) {
    const proveedor = await Proveedor.findByPk(proveedorId, options);

    if (!proveedor) {
      throw new Error('Proveedor no encontrado');
    }

    // Verificar si tiene servicios activos
    const serviciosActivos = await Servicio.count({
      where: {
        proveedor_id: proveedorId,
        activo: true
      },
      ...options
    });

    if (serviciosActivos > 0) {
      throw new Error(
        `No se puede eliminar el proveedor. Tiene ${serviciosActivos} servicio(s) activo(s)`
      );
    }

    await proveedor.update({ activo: false }, options);

    logger.info('Proveedor eliminado (soft delete):', {
      proveedorId: proveedor.id,
      empresa: proveedor.empresa
    });

    return true;
  }

  /**
   * Obtener estadísticas de proveedores
   */
  async obtenerEstadisticas() {
    const [proveedoresStats, serviciosStats] = await Promise.all([
      Proveedor.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('Proveedor.id')), 'total'],
          [sequelize.fn('COUNT', sequelize.literal("CASE WHEN \"Proveedor\".\"activo\" = true THEN 1 END")), 'activos']
        ],
        raw: true
      }),
      Servicio.count({
        where: { activo: true }
      })
    ]);

    return {
      proveedores: {
        total: parseInt(proveedoresStats[0].total) || 0,
        activos: parseInt(proveedoresStats[0].activos) || 0
      },
      servicios: {
        total: serviciosStats
      }
    };
  }
}

export default new ProveedorService();
