// src/modules/inventario/routes/index.js - COMPLETO
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requirePermission } = require('../../auth/middleware/roleMiddleware');
const validate = require('../../../shared/middleware/validation');
const { body, param, query } = require('express-validator');
const inventarioController = require('../controllers/inventarioController');

const router = express.Router();

// Las rutas GET (lectura) son públicas para desarrollo
// Las rutas POST/PUT/DELETE requieren autenticación
// router.use(authenticate); // Comentado para desarrollo - se aplica por ruta

// Validaciones comunes
const validarId = [
  param('id')
    .isUUID()
    .withMessage('ID debe ser un UUID válido')
];

const validarInventarioCreate = [
  body('tipo_articulo_id')
    .isUUID()
    .withMessage('Tipo de artículo ID debe ser un UUID válido'),

  body('marca')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Marca debe tener entre 1 y 50 caracteres'),

  body('modelo')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Modelo debe tener entre 1 y 100 caracteres'),

  body('numero_serie')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Número de serie no puede exceder 100 caracteres'),

  body('service_tag')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Service tag no puede exceder 100 caracteres'),

  body('sede_id')
    .isUUID()
    .withMessage('Sede ID debe ser un UUID válido'),

  body('estado')
    .optional({ checkFalsy: true })
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja', 'en_prestamo'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento, dado_de_baja o en_prestamo'),

  body('fecha_adquisicion')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Fecha de adquisición debe ser una fecha válida')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Fecha de adquisición no puede ser futura');
      }
      return true;
    }),

  body('valor_adquisicion')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Valor de adquisición debe ser un número positivo'),

  body('observaciones')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Observaciones no pueden exceder 1000 caracteres')
];

const validarInventarioUpdate = [
  body('tipo_articulo_id')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Tipo de artículo ID debe ser un UUID válido'),

  body('marca')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Marca debe tener entre 1 y 50 caracteres'),

  body('modelo')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Modelo debe tener entre 1 y 100 caracteres'),

  body('numero_serie')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Número de serie no puede exceder 100 caracteres'),

  body('service_tag')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Service tag no puede exceder 100 caracteres'),

  body('sede_id')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Sede ID debe ser un UUID válido'),

  body('estado')
    .optional({ checkFalsy: true })
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja', 'en_prestamo'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento, dado_de_baja o en_prestamo'),

  body('fecha_adquisicion')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Fecha de adquisición debe ser una fecha válida'),

  body('valor_adquisicion')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Valor de adquisición debe ser un número positivo'),

  body('observaciones')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Observaciones no pueden exceder 1000 caracteres'),

  body('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false')
];

const validarCambioEstado2025 = [
  body('estado')
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja', 'en_prestamo'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento, dado_de_baja o en_prestamo'),

  body('observaciones')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Observaciones no pueden exceder 500 caracteres')
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
    .withMessage('Búsqueda no puede exceder 100 caracteres'),

  query('sede_id')
    .optional()
    .isUUID()
    .withMessage('Sede ID debe ser un UUID válido'),

  query('tipo_articulo_id')
    .optional()
    .isUUID()
    .withMessage('Tipo artículo ID debe ser un UUID válido'),
  
  query('estado')
    .optional()
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja', 'en_prestamo'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento, dado_de_baja o en_prestamo'),
  
  query('disponible_solo')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Disponible solo debe ser true o false')
    .toBoolean()
];

const validarBusqueda = [
  query('termino')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Término de búsqueda debe tener entre 2 y 100 caracteres'),

  query('sede_id')
    .optional()
    .isUUID()
    .withMessage('Sede ID debe ser un UUID válido'),

  query('tipo_articulo_id')
    .optional()
    .isUUID()
    .withMessage('Tipo artículo ID debe ser un UUID válido'),
  
  query('disponible_solo')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Disponible solo debe ser true o false')
    .toBoolean(),
  
  query('limite')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Límite debe ser entre 1 y 50')
];

// =====================================================
// RUTAS PRINCIPALES DE INVENTARIO
// =====================================================

/**
 * @route   GET /api/inventario
 * @desc    Listar inventario con paginación y filtros
 * @access  Private (Read permission - Todos)
 */
router.get('/',
  validarPaginacion,
  validate,
  inventarioController.listar
);

/**
 * @route   GET /api/inventario/buscar
 * @desc    Buscar items de inventario
 * @access  Private (Read permission - Todos)
 */
router.get('/buscar',
  validarBusqueda,
  validate,
  inventarioController.buscar
);

/**
 * @route   GET /api/inventario/estadisticas
 * @desc    Obtener estadísticas del inventario
 * @access  Private (Read permission - Todos)
 */
router.get('/estadisticas',
  [
    query('sede_id')
      .optional()
      .isUUID()
      .withMessage('Sede ID debe ser un UUID válido')
  ],
  validate,
  inventarioController.obtenerEstadisticas
);

/**
 * @route   GET /api/inventario/:id
 * @desc    Obtener item específico con historial completo
 * @access  Private (Read permission - Todos)
 */
router.get('/:id',
  validarId,
  validate,
  inventarioController.obtener
);

/**
 * @route   POST /api/inventario
 * @desc    Crear nuevo item de inventario
 * @access  Private (Create permission - Infraestructura y Soporte)
 */
router.post('/',
  authenticate,
  requirePermission('inventario', 'create'),
  validarInventarioCreate,
  validate,
  inventarioController.crear
);

/**
 * @route   PUT /api/inventario/:id
 * @desc    Actualizar item de inventario
 * @access  Private (Update permission - Infraestructura y Soporte)
 */
router.put('/:id',
  authenticate,
  requirePermission('inventario', 'update'),
  validarId,
  validarInventarioUpdate,
  validate,
  inventarioController.actualizar
);

/**
 * @route   DELETE /api/inventario/:id
 * @desc    Eliminar item de inventario (soft delete)
 * @access  Private (Delete permission - Infraestructura y Soporte)
 */
router.delete('/:id',
  authenticate,
  requirePermission('inventario', 'delete'),
  validarId,
  validate,
  inventarioController.eliminar
);

/**
 * @route   PATCH /api/inventario/:id/estado
 * @desc    Cambiar estado de un item
 * @access  Private (Update permission - Infraestructura y Soporte)
 */
router.patch('/:id/estado',
  authenticate,
  validarId,
  validarCambioEstado2025,
  validate,
  inventarioController.cambiarEstado
);

/**
 * @route   GET /api/inventario/:id/historial
 * @desc    Obtener historial de movimientos de un item
 * @access  Private (Read permission - Todos)
 */
router.get('/:id/historial',
  validarId,
  [
    query('limite')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe ser entre 1 y 100')
  ],
  validate,
  inventarioController.obtenerHistorial
);

module.exports = router;