// src/modules/personal/routes/index.js - COMPLETO
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import { body, param, query } from 'express-validator';
import personalController from '../controllers/personalController.js';
import personalSedeController from '../controllers/personalSedeController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones comunes
const validarId = [
  param('id')
    .isUUID()
    .withMessage('ID debe ser un UUID válido')
];

const validarPersonalCreate = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Nombre solo puede contener letras y espacios'),

  body('apellido')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Apellido solo puede contener letras y espacios'),

  body('email')
    .isEmail()
    .withMessage('Email debe ser válido')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email no puede exceder 100 caracteres'),

  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Formato de teléfono no válido'),

  body('sedes')
    .isArray({ min: 1 })
    .withMessage('Sedes debe ser un array con al menos 1 elemento')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(id => !id || typeof id !== 'string')) {
        throw new Error('Cada sede debe ser un UUID válido');
      }
      return true;
    }),

  body('rol_id')
    .isUUID()
    .withMessage('Rol ID debe ser un UUID válido'),

  body('fecha_ingreso')
    .optional()
    .isISO8601()
    .withMessage('Fecha de ingreso debe ser una fecha válida')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Fecha de ingreso no puede ser futura');
      }
      return true;
    })
];

const validarPersonalUpdate = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Nombre solo puede contener letras y espacios'),

  body('apellido')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Apellido solo puede contener letras y espacios'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Email debe ser válido')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email no puede exceder 100 caracteres'),

  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Formato de teléfono no válido'),

  body('rol_id')
    .optional()
    .isUUID()
    .withMessage('Rol ID debe ser un UUID válido'),

  body('fecha_ingreso')
    .optional()
    .isISO8601()
    .withMessage('Fecha de ingreso debe ser una fecha válida')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Fecha de ingreso no puede ser futura');
      }
      return true;
    }),

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
    .isInt({ min: 1, max: 1000 })
    .withMessage('Límite debe ser entre 1 y 1000'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Búsqueda no puede exceder 100 caracteres'),

  query('sede_id')
    .optional()
    .isUUID()
    .withMessage('Sede ID debe ser un UUID válido'),

  query('rol_id')
    .optional()
    .isUUID()
    .withMessage('Rol ID debe ser un UUID válido'),

  query('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false')
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

  query('rol_id')
    .optional()
    .isUUID()
    .withMessage('Rol ID debe ser un UUID válido'),

  query('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false'),

  query('limite')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Límite debe ser entre 1 y 50')
];

// =====================================================
// RUTAS PRINCIPALES DE PERSONAL
// =====================================================

/**
 * @route   GET /api/personal
 * @desc    Listar personal con paginación y filtros
 * @access  Private (Read permission - Todos)
 */
router.get('/',
  requirePermission('personal', 'read'),
  validarPaginacion,
  validate,
  personalController.listar
);

/**
 * @route   GET /api/personal/buscar
 * @desc    Buscar personal por criterios específicos
 * @access  Private (Read permission - Todos)
 */
router.get('/buscar',
  requirePermission('personal', 'read'),
  validarBusqueda,
  validate,
  personalController.buscar
);

/**
 * @route   GET /api/personal/estadisticas
 * @desc    Obtener estadísticas generales del personal
 * @access  Private (Read permission - Todos)
 */
router.get('/estadisticas',
  requirePermission('personal', 'read'),
  personalController.obtenerEstadisticasGenerales
);

/**
 * @route   GET /api/personal/:id
 * @desc    Obtener persona específica con detalles completos
 * @access  Private (Read permission - Todos)
 */
router.get('/:id',
  requirePermission('personal', 'read'),
  validarId,
  validate,
  personalController.obtener
);

/**
 * @route   POST /api/personal
 * @desc    Crear nueva persona
 * @access  Private (Create permission - Infraestructura y Mesa de ayuda)
 */
router.post('/',
  requirePermission('personal', 'create'),
  validarPersonalCreate,
  validate,
  personalController.crear
);

/**
 * @route   PUT /api/personal/:id
 * @desc    Actualizar persona existente
 * @access  Private (Update permission - Infraestructura y Mesa de ayuda)
 */
router.put('/:id',
  requirePermission('personal', 'update'),
  validarId,
  validarPersonalUpdate,
  validate,
  personalController.actualizar
);

/**
 * @route   DELETE /api/personal/:id
 * @desc    Eliminar persona (soft delete)
 * @access  Private (Delete permission - Infraestructura y Mesa de ayuda)
 */
router.delete('/:id',
  requirePermission('personal', 'delete'),
  validarId,
  validate,
  personalController.eliminar
);

// =====================================================
// RUTAS DE RELACIONES DE PERSONAL
// =====================================================

/**
 * @route   GET /api/personal/:id/remitos
 * @desc    Obtener remitos de una persona específica
 * @access  Private (Read permission - Todos)
 */
router.get('/:id/remitos',
  requirePermission('personal', 'read'),
  validarId,
  [
    query('tipo')
      .optional()
      .isIn(['todos', 'solicitados', 'asignados'])
      .withMessage('Tipo debe ser: todos, solicitados o asignados'),

    query('estado')
      .optional()
      .isIn(['preparado', 'en_transito', 'entregado', 'completado', 'devuelto', 'cancelado'])
      .withMessage('Estado debe ser: preparado, en_transito, entregado, completado, devuelto o cancelado'),

    query('limite')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe ser entre 1 y 100')
  ],
  validate,
  personalController.obtenerRemitos
);

// =====================================================
// RUTAS DE ASIGNACIÓN DE PERSONAL A SEDES
// =====================================================

/**
 * @route   GET /api/personal/sedes/asignaciones
 * @desc    Listar asignaciones de personal a sedes
 * @access  Private (Read permission - Todos)
 */
router.get('/sedes/asignaciones',
  requirePermission('personal', 'read'),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Página debe ser un número entero positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe ser entre 1 y 100'),
    query('personal_id')
      .optional()
      .isUUID()
      .withMessage('Personal ID debe ser un UUID válido'),
    query('sede_id')
      .optional()
      .isUUID()
      .withMessage('Sede ID debe ser un UUID válido'),
    query('rol_id')
      .optional()
      .isUUID()
      .withMessage('Rol ID debe ser un UUID válido'),
    query('activo')
      .optional()
      .isBoolean()
      .withMessage('Activo debe ser true o false')
  ],
  validate,
  personalSedeController.listar
);

/**
 * @route   GET /api/personal/:id/sedes
 * @desc    Obtener sedes asignadas a una persona
 * @access  Private (Read permission - Todos)
 */
router.get('/:id/sedes',
  requirePermission('personal', 'read'),
  [
    param('id')
      .isUUID()
      .withMessage('ID debe ser un UUID válido')
  ],
  validate,
  personalSedeController.obtenerPorPersonal
);

/**
 * @route   POST /api/personal/sedes/asignaciones
 * @desc    Crear asignación de personal a sede
 * @access  Private (Create permission - Infraestructura)
 */
router.post('/sedes/asignaciones',
  requirePermission('personal', 'create'),
  [
    body('personal_id')
      .isUUID()
      .withMessage('Personal ID debe ser un UUID válido'),
    body('sede_id')
      .isUUID()
      .withMessage('Sede ID debe ser un UUID válido'),
    body('rol_id')
      .isUUID()
      .withMessage('Rol ID debe ser un UUID válido'),
    body('fecha_inicio')
      .optional()
      .isISO8601()
      .withMessage('Fecha de inicio debe ser una fecha válida'),
    body('fecha_fin')
      .optional()
      .isISO8601()
      .withMessage('Fecha de fin debe ser una fecha válida')
  ],
  validate,
  personalSedeController.crear
);

/**
 * @route   PUT /api/personal/sedes/asignaciones/:id
 * @desc    Actualizar asignación de personal a sede
 * @access  Private (Update permission - Infraestructura)
 */
router.put('/sedes/asignaciones/:id',
  requirePermission('personal', 'update'),
  [
    param('id')
      .isUUID()
      .withMessage('ID debe ser un UUID válido'),
    body('rol_id')
      .optional()
      .isUUID()
      .withMessage('Rol ID debe ser un UUID válido'),
    body('fecha_fin')
      .optional()
      .isISO8601()
      .withMessage('Fecha de fin debe ser una fecha válida'),
    body('activo')
      .optional()
      .isBoolean()
      .withMessage('Activo debe ser true o false')
  ],
  validate,
  personalSedeController.actualizar
);

/**
 * @route   DELETE /api/personal/sedes/asignaciones/:id
 * @desc    Dar de baja asignación de personal a sede (soft delete)
 * @access  Private (Delete permission - Infraestructura)
 */
router.delete('/sedes/asignaciones/:id',
  requirePermission('personal', 'delete'),
  [
    param('id')
      .isUUID()
      .withMessage('ID debe ser un UUID válido')
  ],
  validate,
  personalSedeController.eliminar
);

/**
 * @route   GET /api/personal/sedes/:id
 * @desc    Obtener personal asignado a una sede específica
 * @access  Private (Read permission - Todos)
 */
router.get('/sedes/:id',
  requirePermission('personal', 'read'),
  [
    param('id')
      .isUUID()
      .withMessage('ID debe ser un UUID válido')
  ],
  validate,
  personalSedeController.obtenerPorSede
);

/**
 * @route   GET /api/personal/sedes/estadisticas
 * @desc    Obtener estadísticas de asignaciones
 * @access  Private (Read permission - Todos)
 */
router.get('/sedes/estadisticas',
  requirePermission('personal', 'read'),
  personalSedeController.obtenerEstadisticas
);

export default router;