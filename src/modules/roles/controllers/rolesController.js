// src/modules/roles/controllers/rolesController.js
import { Rol, sequelize } from '../../../models/index.js';
import { success, paginated, error } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class RolesController {
  /**
   * Listar todos los roles con paginación y filtros
   */
  listar = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 100,
      search = '',
      activo = true
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filtro de búsqueda
    if (search) {
      whereClause[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { descripcion: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Filtro activo
    if (activo !== null && activo !== undefined) {
      whereClause.activo = activo === 'true' || activo === true;
    }

    const { count, rows } = await Rol.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['nombre', 'ASC']]
    });

    paginated(res, rows, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count
    }, 'Roles obtenidos correctamente');
  });

  /**
   * Obtener un rol específico
   */
  obtener = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rol = await Rol.findByPk(id);

    if (!rol) {
      return error(res, 'Rol no encontrado', 404);
    }

    success(res, rol, 'Rol obtenido correctamente');
  });

  /**
   * Crear nuevo rol
   */
  crear = asyncHandler(async (req, res) => {
    const {
      nombre,
      descripcion
    } = req.body;

    // Verificar si el rol ya existe
    const rolExistente = await Rol.findOne({
      where: { nombre: nombre.trim() }
    });

    if (rolExistente) {
      return error(res, 'Este rol ya existe', 409);
    }

    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        return await Rol.create({
          nombre: nombre.trim(),
          descripcion: descripcion?.trim() || null,
          activo: true
        }, { transaction });
      },
      usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
      usuarioId: req.user?.id,
      modulo: 'roles',
      accion: 'create',
      recurso: 'Rol',
      recursoId: null,
      descripcion: `Creación de rol: ${nombre}`,
      valoresAnteriores: null,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Nuevo rol creado:', {
      rolId: resultado.data.id,
      nombre: resultado.data.nombre,
      creadoPor: req.user?.email || 'sistema'
    });

    success(res, resultado.data, 'Rol creado correctamente', 201);
  });

  /**
   * Actualizar rol existente
   */
  actualizar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const rol = await Rol.findByPk(id);

    if (!rol) {
      return error(res, 'Rol no encontrado', 404);
    }

    // Get previous values for audit
    const previousData = rol.toJSON();

    const cambios = {};

    if (nombre) {
      cambios.nombre = nombre.trim();
    }

    if (descripcion !== undefined) {
      cambios.descripcion = descripcion?.trim() || null;
    }

    if (activo !== undefined) {
      cambios.activo = activo;
    }

    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        await rol.update(cambios, { transaction });
        return rol;
      },
      usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
      usuarioId: req.user?.id,
      modulo: 'roles',
      accion: 'update',
      recurso: 'Rol',
      recursoId: id,
      descripcion: `Actualización de rol: ${rol.nombre}`,
      valoresAnteriores: previousData,
      valoresNuevos: cambios,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Rol actualizado:', {
      rolId: rol.id,
      cambios: Object.keys(cambios),
      actualizadoPor: req.user?.email || 'sistema'
    });

    success(res, resultado.data, 'Rol actualizado correctamente');
  });

  /**
   * Eliminar rol (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rol = await Rol.findByPk(id);

    if (!rol) {
      return error(res, 'Rol no encontrado', 404);
    }

    // Get previous values for audit
    const previousData = rol.toJSON();

    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        await rol.update({ activo: false }, { transaction });
        return rol;
      },
      usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
      usuarioId: req.user?.id,
      modulo: 'roles',
      accion: 'delete',
      recurso: 'Rol',
      recursoId: id,
      descripcion: `Eliminación de rol: ${rol.nombre}`,
      valoresAnteriores: previousData,
      valoresNuevos: null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Rol eliminado:', {
      rolId: rol.id,
      nombre: rol.nombre,
      eliminadoPor: req.user?.email || 'sistema'
    });

    success(res, null, 'Rol eliminado correctamente');
  });
}

export default new RolesController();
