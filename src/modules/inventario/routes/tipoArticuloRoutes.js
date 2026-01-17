// src/modules/inventario/routes/tipoArticuloRoutes.js
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import { body, param, query } from 'express-validator';
import tipoArticuloController from '../controllers/tipoArticuloController.js';

const router = express.Router();

// Las rutas GET son públicas para cargar tipos en dropdowns
// Las rutas de modificación (POST, PUT, DELETE) requieren autenticación
// router.use(authenticate);

// Validaciones comunes
const validarId = [
  param('id')
    .isUUID()
    .withMessage('ID debe ser un UUID válido')
];

const validarTipoCreate = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('Nombre es requerido')
    .isLength({ min: 2, max: 50 })
    .withMessage('Nombre debe tener entre 2 y 50 caracteres'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descripción no puede exceder 500 caracteres')
];

const validarTipoUpdate = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nombre debe tener entre 2 y 50 caracteres'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descripción no puede exceder 500 caracteres')
];

const validarPaginacion = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número entero positivo'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite debe ser entre 1 y 100'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Búsqueda no puede exceder 100 caracteres')
];

// =====================================================
// RUTAS DE TIPO DE ARTÍCULO
// =====================================================

/**
 * @route   GET /api/tipo-articulo
 * @desc    Listar tipos de artículos con paginación (PÚBLICO para cargar en dropdowns)
 * @access  Public
 */
router.get('/',
  validarPaginacion,
  validate,
  tipoArticuloController.listar
);

/**
 * @route   GET /api/tipo-articulo/todos
 * @desc    Obtener todos los tipos sin paginación (PÚBLICO para selects)
 * @access  Public
 */
router.get('/todos',
  tipoArticuloController.obtenerTodos
);

/**
 * @route   GET /api/tipo-articulo/:id
 * @desc    Obtener un tipo de artículo específico (PÚBLICO)
 * @access  Public
 */
router.get('/:id',
  validarId,
  validate,
  tipoArticuloController.obtener
);

/**
 * @route   POST /api/tipo-articulo
 * @desc    Crear nuevo tipo de artículo
 * @access  Private (Create permission - Infraestructura y Soporte)
 */
router.post('/',
  authenticate,
  requirePermission('inventario', 'create'),
  validarTipoCreate,
  validate,
  tipoArticuloController.crear
);

/**
 * @route   PUT /api/tipo-articulo/:id
 * @desc    Actualizar tipo de artículo
 * @access  Private (Update permission - Infraestructura y Soporte)
 */
router.put('/:id',
  authenticate,
  requirePermission('inventario', 'update'),
  validarId,
  validarTipoUpdate,
  validate,
  tipoArticuloController.actualizar
);

/**
 * @route   DELETE /api/tipo-articulo/:id
 * @desc    Eliminar tipo de artículo (soft delete)
 * @access  Private (Delete permission - Infraestructura y Soporte)
 */
router.delete('/:id',
  authenticate,
  requirePermission('inventario', 'delete'),
  validarId,
  validate,
  tipoArticuloController.eliminar
);

export default router;
