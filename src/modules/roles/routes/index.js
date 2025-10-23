// src/modules/roles/routes/index.js
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requirePermission } = require('../../auth/middleware/roleMiddleware');
const validate = require('../../../shared/middleware/validation');
const { body, param, query } = require('express-validator');
const rolesController = require('../controllers/rolesController');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones comunes
const validarId = [
  param('id')
    .isUUID()
    .withMessage('ID debe ser un UUID válido')
];

const validarRolCreate = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre debe tener entre 2 y 100 caracteres'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descripción no puede exceder 500 caracteres')
];

const validarRolUpdate = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre debe tener entre 2 y 100 caracteres'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descripción no puede exceder 500 caracteres'),

  body('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false')
];

const validarPaginacion = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número entero positivo'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Límite debe ser entre 1 y 500'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Búsqueda no puede exceder 100 caracteres'),

  query('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false')
];

/**
 * @route   GET /api/roles
 * @desc    Listar roles con paginación y filtros
 * @access  Private (Read permission - Todos)
 */
router.get('/',
  validarPaginacion,
  validate,
  rolesController.listar
);

/**
 * @route   GET /api/roles/:id
 * @desc    Obtener un rol específico
 * @access  Private (Read permission - Todos)
 */
router.get('/:id',
  validarId,
  validate,
  rolesController.obtener
);

/**
 * @route   POST /api/roles
 * @desc    Crear nuevo rol
 * @access  Private (Create permission - Admin)
 */
router.post('/',
  requirePermission('roles', 'create'),
  validarRolCreate,
  validate,
  rolesController.crear
);

/**
 * @route   PUT /api/roles/:id
 * @desc    Actualizar rol existente
 * @access  Private (Update permission - Admin)
 */
router.put('/:id',
  requirePermission('roles', 'update'),
  validarId,
  validarRolUpdate,
  validate,
  rolesController.actualizar
);

/**
 * @route   DELETE /api/roles/:id
 * @desc    Eliminar rol (soft delete)
 * @access  Private (Delete permission - Admin)
 */
router.delete('/:id',
  requirePermission('roles', 'delete'),
  validarId,
  validate,
  rolesController.eliminar
);

module.exports = router;
