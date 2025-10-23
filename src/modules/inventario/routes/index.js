// src/modules/inventario/routes/index.js - COMPLETO
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requirePermission } = require('../../auth/middleware/roleMiddleware');
const validate = require('../../../shared/middleware/validation');
const { body, param, query } = require('express-validator');
const inventarioController = require('../controllers/inventarioController');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones comunes
const validarId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo')
];

const validarInventarioCreate = [
  body('tipo_articulo_id')
    .isInt({ min: 1 })
    .withMessage('Tipo de artículo ID debe ser un número entero positivo'),
  
  body('marca')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Marca debe tener entre 1 y 50 caracteres'),
  
  body('modelo')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Modelo debe tener entre 1 y 100 caracteres'),
  
  body('numero_serie')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Número de serie no puede exceder 100 caracteres'),
  
  body('service_tag')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Service tag no puede exceder 100 caracteres'),
  
  body('sede_id')
    .isInt({ min: 1 })
    .withMessage('Sede ID debe ser un número entero positivo'),
  
  body('estado')
    .optional()
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento o dado_de_baja'),
  
  body('fecha_adquisicion')
    .optional()
    .isISO8601()
    .withMessage('Fecha de adquisición debe ser una fecha válida')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Fecha de adquisición no puede ser futura');
      }
      return true;
    }),
  
  body('valor_adquisicion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor de adquisición debe ser un número positivo'),
  
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Observaciones no pueden exceder 1000 caracteres')
];

const validarInventarioUpdate = [
  body('tipo_articulo_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Tipo de artículo ID debe ser un número entero positivo'),
  
  body('marca')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Marca debe tener entre 1 y 50 caracteres'),
  
  body('modelo')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Modelo debe tener entre 1 y 100 caracteres'),
  
  body('numero_serie')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Número de serie no puede exceder 100 caracteres'),
  
  body('service_tag')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Service tag no puede exceder 100 caracteres'),
  
  body('sede_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sede ID debe ser un número entero positivo'),
  
  body('estado')
    .optional()
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento o dado_de_baja'),
  
  body('fecha_adquisicion')
    .optional()
    .isISO8601()
    .withMessage('Fecha de adquisición debe ser una fecha válida'),
  
  body('valor_adquisicion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor de adquisición debe ser un número positivo'),
  
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Observaciones no pueden exceder 1000 caracteres'),
  
  body('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false')
];

const validarCambioEstado = [
  body('estado')
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento o dado_de_baja'),
  
  body('observaciones')
    .optional()
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
    .isInt({ min: 1 })
    .withMessage('Sede ID debe ser un número entero positivo'),
  
  query('tipo_articulo_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Tipo artículo ID debe ser un número entero positivo'),
  
  query('estado')
    .optional()
    .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'])
    .withMessage('Estado debe ser: disponible, en_uso, mantenimiento o dado_de_baja'),
  
  query('disponible_solo')
    .optional()
    .isBoolean()
    .withMessage('Disponible solo debe ser true o false')
];

const validarBusqueda = [
  query('termino')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Término de búsqueda debe tener entre 2 y 100 caracteres'),
  
  query('sede_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sede ID debe ser un número entero positivo'),
  
  query('tipo_articulo_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Tipo artículo ID debe ser un número entero positivo'),
  
  query('disponible_solo')
    .optional()
    .isBoolean()
    .withMessage('Disponible solo debe ser true o false'),
  
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
  requirePermission('inventario', 'read'),
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
  requirePermission('inventario', 'read'),
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
  requirePermission('inventario', 'read'),
  [
    query('sede_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Sede ID debe ser un número entero positivo')
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
  requirePermission('inventario', 'read'),
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
  requirePermission('inventario', 'update'),
  validarId,
  validarCambioEstado,
  validate,
  inventarioController.cambiarEstado
);

/**
 * @route   GET /api/inventario/:id/historial
 * @desc    Obtener historial de movimientos de un item
 * @access  Private (Read permission - Todos)
 */
router.get('/:id/historial',
  requirePermission('inventario', 'read'),
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