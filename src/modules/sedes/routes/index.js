// src/modules/sedes/routes/index.js - COMPLETO
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import { body, param, query } from 'express-validator';
import sedeController from '../controllers/SedeController.js';
import sedeAsignacionController from '../controllers/sedeAsignacionController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones comunes
const validarId = [
  param('id')
    .isUUID()
    .withMessage('ID debe ser un UUID válido')
];

const validarSedeCreate = [
  body('empresa_id')
    .notEmpty()
    .withMessage('ID de empresa es requerido')
    .isUUID()
    .withMessage('ID de empresa debe ser un UUID válido'),

  body('nombre_sede')
    .trim()
    .notEmpty()
    .withMessage('Nombre de sede es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre de sede debe tener entre 2 y 100 caracteres'),

  body('direccion')
    .trim()
    .notEmpty()
    .withMessage('Dirección es requerida')
    .isLength({ min: 5, max: 200 })
    .withMessage('Dirección debe tener entre 5 y 200 caracteres'),

  body('localidad')
    .trim()
    .notEmpty()
    .withMessage('Localidad es requerida')
    .isLength({ min: 2, max: 100 })
    .withMessage('Localidad debe tener entre 2 y 100 caracteres'),

  body('provincia')
    .trim()
    .notEmpty()
    .withMessage('Provincia es requerida')
    .isLength({ min: 2, max: 100 })
    .withMessage('Provincia debe tener entre 2 y 100 caracteres'),

  body('pais')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('País debe tener entre 2 y 100 caracteres'),

  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Formato de teléfono no válido'),

  body('ip_sede')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(\d{1,3}\.){3}\d{1,3}$/)
    .withMessage('Debe ser una dirección IP válida')
];

const validarSedeUpdate = [
  body('empresa_id')
    .optional()
    .isUUID()
    .withMessage('ID de empresa debe ser un UUID válido'),

  body('nombre_sede')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre de sede debe tener entre 2 y 100 caracteres'),

  body('direccion')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Dirección debe tener entre 5 y 200 caracteres'),

  body('localidad')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Localidad debe tener entre 2 y 100 caracteres'),

  body('provincia')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Provincia debe tener entre 2 y 100 caracteres'),

  body('pais')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('País debe tener entre 2 y 100 caracteres'),

  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Formato de teléfono no válido'),

  body('ip_sede')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(\d{1,3}\.){3}\d{1,3}$/)
    .withMessage('Debe ser una dirección IP válida'),

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

  query('activo')
    .optional()
    .isBoolean()
    .withMessage('Activo debe ser true o false')
];

// =====================================================
// RUTAS PRINCIPALES DE SEDES
// =====================================================

/**
 * @route   GET /api/sedes
 * @desc    Listar sedes con paginación y filtros
 * @access  Private (Read permission)
 */
router.get('/',
  requirePermission('sedes', 'read'),
  validarPaginacion,
  validate,
  sedeController.listar
);

/**
 * @route   GET /api/sedes/estadisticas
 * @desc    Obtener estadísticas generales de sedes
 * @access  Private (Read permission)
 */
router.get('/estadisticas',
  requirePermission('sedes', 'read'),
  sedeController.obtenerEstadisticas
);

/**
 * @route   GET /api/sedes/:id
 * @desc    Obtener sede específica con detalles completos
 * @access  Private (Read permission)
 */
router.get('/:id',
  requirePermission('sedes', 'read'),
  validarId,
  validate,
  sedeController.obtener
);

/**
 * @route   POST /api/sedes
 * @desc    Crear nueva sede
 * @access  Private (Create permission - Solo Infraestructura)
 */
router.post('/',
  requirePermission('sedes', 'create'),
  validarSedeCreate,
  validate,
  sedeController.crear
);

/**
 * @route   PUT /api/sedes/:id
 * @desc    Actualizar sede existente
 * @access  Private (Update permission - Solo Infraestructura)
 */
router.put('/:id',
  requirePermission('sedes', 'update'),
  validarId,
  validarSedeUpdate,
  validate,
  sedeController.actualizar
);

/**
 * @route   DELETE /api/sedes/:id
 * @desc    Eliminar sede (soft delete)
 * @access  Private (Delete permission - Solo Infraestructura)
 */
router.delete('/:id',
  requirePermission('sedes', 'delete'),
  validarId,
  validate,
  sedeController.eliminar
);

// =====================================================
// RUTAS DE RELACIONES DE SEDES
// =====================================================

/**
 * @route   GET /api/sedes/:id/personal
 * @desc    Obtener personal de una sede específica
 * @access  Private (Read permission)
 */
router.get('/:id/personal',
  requirePermission('sedes', 'read'),
  validarId,
  [
    query('activo')
      .optional()
      .isBoolean()
      .withMessage('Activo debe ser true o false')
  ],
  validate,
  sedeController.obtenerPersonal
);

/**
 * @route   GET /api/sedes/:id/inventario
 * @desc    Obtener inventario de una sede específica
 * @access  Private (Read permission)
 */
router.get('/:id/inventario',
  requirePermission('sedes', 'read'),
  validarId,
  [
    query('estado')
      .optional()
      .isIn(['disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'])
      .withMessage('Estado debe ser: disponible, en_uso, mantenimiento o dado_de_baja'),

    query('tipo_articulo')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Tipo de artículo debe ser un ID válido'),

    query('disponible_solo')
      .optional()
      .isBoolean()
      .withMessage('Disponible solo debe ser true o false')
  ],
  validate,
  sedeController.obtenerInventario
);

/**
 * @route   GET /api/sedes/:id/servicios
 * @desc    Obtener servicios de una sede específica
 * @access  Private (Read permission)
 */
router.get('/:id/servicios',
  requirePermission('sedes', 'read'),
  validarId,
  [
    query('activo')
      .optional()
      .isBoolean()
      .withMessage('Activo debe ser true o false')
  ],
  validate,
  sedeController.obtenerServicios
);

/**
 * @route   POST /api/sedes/:id/servicios
 * @desc    Asignar servicio a una sede
 * @access  Private (Update permission - Solo Infraestructura)
 */
router.post('/:id/servicios',
  requirePermission('sedes', 'update'),
  validarId,
  [
    body('servicio_id')
      .isInt({ min: 1 })
      .withMessage('ID de servicio requerido y debe ser válido'),

    body('fecha_contratacion')
      .optional()
      .isISO8601()
      .withMessage('Fecha de contratación debe ser una fecha válida'),

    body('fecha_vencimiento')
      .optional()
      .isISO8601()
      .withMessage('Fecha de vencimiento debe ser una fecha válida')
      .custom((value, { req }) => {
        if (value && req.body.fecha_contratacion &&
          new Date(value) <= new Date(req.body.fecha_contratacion)) {
          throw new Error('Fecha de vencimiento debe ser posterior a la contratación');
        }
        return true;
      })
  ],
  validate,
  sedeController.asignarServicio
);

// =====================================================
// RUTAS DE ASIGNACIÓN DE TÉCNICOS DE SOPORTE A SEDES
// =====================================================

/**
 * @route   POST /api/sedes/:id/asignaciones
 * @desc    Asignar un técnico de soporte a una sede
 * @access  Private (Only Infraestructura - super_admin)
 */
router.post('/:id/asignaciones',
  requirePermission('sedes', 'update'),
  validarId,
  [
    body('personal_id')
      .notEmpty()
      .withMessage('El ID del personal es requerido')
      .isUUID()
      .withMessage('El ID del personal debe ser un UUID válido'),

    body('notas')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Las notas no pueden exceder 500 caracteres')
  ],
  validate,
  sedeAsignacionController.asignarTecnico
);

/**
 * @route   GET /api/sedes/:id/asignaciones
 * @desc    Obtener asignaciones de una sede (activas e históricas)
 * @access  Private (Read permission)
 */
router.get('/:id/asignaciones',
  requirePermission('sedes', 'read'),
  validarId,
  [
    query('historicas')
      .optional()
      .isBoolean()
      .withMessage('Históricas debe ser true o false')
  ],
  validate,
  sedeAsignacionController.obtenerAsignacionesSede
);

/**
 * @route   GET /api/sedes/:id/asignaciones/tecnico/activo
 * @desc    Obtener el técnico asignado actualmente a una sede
 * @access  Private (Read permission)
 */
router.get('/:id/asignaciones/tecnico/activo',
  requirePermission('sedes', 'read'),
  validarId,
  validate,
  sedeAsignacionController.obtenerTecnicoActivo
);

/**
 * @route   DELETE /api/sedes/:id/asignaciones/:personalId
 * @desc    Desasignar un técnico de una sede
 * @access  Private (Only Infraestructura - super_admin)
 */
router.delete('/:id/asignaciones/:personalId',
  requirePermission('sedes', 'update'),
  [
    param('id')
      .isUUID()
      .withMessage('ID de sede debe ser un UUID válido'),
    param('personalId')
      .isUUID()
      .withMessage('ID de personal debe ser un UUID válido')
  ],
  validate,
  sedeAsignacionController.desasignarTecnico
);

/**
 * @route   GET /api/sedes/asignaciones/tecnicos/disponibles
 * @desc    Listar todos los técnicos disponibles del grupo Soporte
 * @access  Private (Read permission)
 */
router.get('/asignaciones/tecnicos/disponibles',
  requirePermission('sedes', 'read'),
  sedeAsignacionController.obtenerTecnicosDisponibles
);

/**
 * @route   GET /api/sedes/asignaciones/personal/:personalId
 * @desc    Obtener todas las sedes asignadas a un técnico
 * @access  Private (Read permission)
 */
router.get('/asignaciones/personal/:personalId',
  requirePermission('sedes', 'read'),
  [
    param('personalId')
      .isUUID()
      .withMessage('ID de personal debe ser un UUID válido'),
    query('historicas')
      .optional()
      .isBoolean()
      .withMessage('Históricas debe ser true o false')
  ],
  validate,
  sedeAsignacionController.obtenerSedesAsignadas
);

export default router;