// src/modules/roles/controllers/rolesController.js
const { Rol, sequelize } = require('../../../models');
const { success, paginated, error } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

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

    const nuevoRol = await Rol.create({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      activo: true
    });

    logger.info('Nuevo rol creado:', {
      rolId: nuevoRol.id,
      nombre: nuevoRol.nombre,
      creadoPor: req.user?.email || 'sistema'
    });

    success(res, nuevoRol, 'Rol creado correctamente', 201);
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

    await rol.update(cambios);

    logger.info('Rol actualizado:', {
      rolId: rol.id,
      cambios: Object.keys(cambios),
      actualizadoPor: req.user?.email || 'sistema'
    });

    success(res, rol, 'Rol actualizado correctamente');
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

    await rol.update({ activo: false });

    logger.info('Rol eliminado:', {
      rolId: rol.id,
      nombre: rol.nombre,
      eliminadoPor: req.user?.email || 'sistema'
    });

    success(res, null, 'Rol eliminado correctamente');
  });
}

module.exports = new RolesController();
