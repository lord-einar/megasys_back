// src/modules/proveedores/routes/index.js
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import { body, param, query } from 'express-validator';

// Controllers
import proveedorController from '../controllers/ProveedorController.js';
import ejecutivoCuentasController from '../controllers/EjecutivoCuentasController.js';
import tipoServicioController from '../controllers/TipoServicioController.js';
import servicioController from '../controllers/ServicioController.js';
import soporteNivelController from '../controllers/SoporteNivelController.js';
import equipoServicioController from '../controllers/EquipoServicioController.js';
import reclamoController from '../controllers/ReclamoController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones comunes
const validarUUID = [param('id').isUUID().withMessage('ID debe ser un UUID válido')];
const validarProveedorUUID = [param('proveedorId').isUUID().withMessage('ID de proveedor debe ser un UUID válido')];
const validarTipoServicioUUID = [param('tipoServicioId').isUUID().withMessage('ID de tipo de servicio debe ser un UUID válido')];

// =====================================================
// RUTAS ESPECÍFICAS (DEBEN IR ANTES DE LAS GENÉRICAS)
// =====================================================

// =====================================================
// EJECUTIVOS DE CUENTAS
// =====================================================

router.get('/ejecutivos',
  requirePermission('proveedores', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('activo').optional().isBoolean(),
    query('proveedor_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    query('tipo_servicio_id').optional({ nullable: true, checkFalsy: true }).isUUID()
  ],
  validate,
  ejecutivoCuentasController.listar
);

router.get('/ejecutivos/:id',
  requirePermission('proveedores', 'read'),
  validarUUID,
  validate,
  ejecutivoCuentasController.obtener
);

router.post('/ejecutivos',
  requirePermission('proveedores', 'create'),
  [
    body('proveedor_id').notEmpty().isUUID(),
    body('tipo_servicio_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    body('nombre').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('apellido').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('email').trim().notEmpty().isEmail(),
    body('telefono').optional().trim().matches(/^[\+]?[0-9\s\-\(\)]+$/)
  ],
  validate,
  ejecutivoCuentasController.crear
);

router.put('/ejecutivos/:id',
  requirePermission('proveedores', 'update'),
  validarUUID,
  [
    body('proveedor_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    body('tipo_servicio_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    body('nombre').optional().trim().isLength({ min: 2, max: 100 }),
    body('apellido').optional().trim().isLength({ min: 2, max: 100 }),
    body('email').optional().trim().isEmail(),
    body('telefono').optional().trim().matches(/^[\+]?[0-9\s\-\(\)]+$/),
    body('activo').optional().isBoolean()
  ],
  validate,
  ejecutivoCuentasController.actualizar
);

router.delete('/ejecutivos/:id',
  requirePermission('proveedores', 'delete'),
  validarUUID,
  validate,
  ejecutivoCuentasController.eliminar
);

// =====================================================
// TIPOS DE SERVICIO
// =====================================================

router.get('/tipos-servicio',
  requirePermission('proveedores', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('activo').optional().isBoolean()
  ],
  validate,
  tipoServicioController.listar
);

router.get('/tipos-servicio/:id',
  requirePermission('proveedores', 'read'),
  validarUUID,
  validate,
  tipoServicioController.obtener
);

router.post('/tipos-servicio',
  requirePermission('proveedores', 'create'),
  [
    body('nombre').trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('descripcion').optional().trim()
  ],
  validate,
  tipoServicioController.crear
);

router.put('/tipos-servicio/:id',
  requirePermission('proveedores', 'update'),
  validarUUID,
  validate,
  tipoServicioController.actualizar
);

router.delete('/tipos-servicio/:id',
  requirePermission('proveedores', 'delete'),
  validarUUID,
  validate,
  tipoServicioController.eliminar
);

// =====================================================
// SERVICIOS
// =====================================================

router.get('/servicios',
  requirePermission('proveedores', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('activo').optional().isBoolean(),
    query('proveedor_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    query('tipo_servicio_id').optional({ nullable: true, checkFalsy: true }).isUUID()
  ],
  validate,
  servicioController.listar
);

router.get('/servicios/:id',
  requirePermission('proveedores', 'read'),
  validarUUID,
  validate,
  servicioController.obtener
);

router.post('/servicios',
  requirePermission('proveedores', 'create'),
  [
    body('nombre').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('tipo_servicio_id').notEmpty().isUUID(),
    body('proveedor_id').notEmpty().isUUID(),
    body('id_servicio').optional().trim().isLength({ min: 2, max: 50 }),
    body('descripcion').optional().trim()
  ],
  validate,
  servicioController.crear
);

router.put('/servicios/:id',
  requirePermission('proveedores', 'update'),
  validarUUID,
  validate,
  servicioController.actualizar
);

router.delete('/servicios/:id',
  requirePermission('proveedores', 'delete'),
  validarUUID,
  validate,
  servicioController.eliminar
);

// =====================================================
// NIVELES DE SOPORTE (anidados bajo proveedor)
// Ruta base: /:proveedorId/soporte
// =====================================================

// Listar todos los niveles de soporte de un proveedor
router.get('/:proveedorId/soporte',
  requirePermission('proveedores', 'read'),
  validarProveedorUUID,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('activo').optional().isBoolean()
  ],
  validate,
  soporteNivelController.listarPorProveedor
);

// Obtener un nivel de soporte por ID (debe ir ANTES de /:tipoServicioId para evitar conflicto de rutas)
router.get('/:proveedorId/soporte/nivel/:id',
  requirePermission('proveedores', 'read'),
  validarProveedorUUID,
  validarUUID,
  validate,
  soporteNivelController.obtener
);

// Listar niveles de soporte de un proveedor para un tipo de servicio específico
router.get('/:proveedorId/soporte/:tipoServicioId',
  requirePermission('proveedores', 'read'),
  validarProveedorUUID,
  validarTipoServicioUUID,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('activo').optional().isBoolean()
  ],
  validate,
  soporteNivelController.listarPorProveedorYTipo
);

// Crear nivel de soporte para un proveedor + tipo de servicio
router.post('/:proveedorId/soporte/:tipoServicioId',
  requirePermission('proveedores', 'create'),
  validarProveedorUUID,
  validarTipoServicioUUID,
  [
    body('nivel').notEmpty().isInt({ min: 1, max: 10 }),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Email debe ser válido'),
    body('telefono').optional({ checkFalsy: true }).trim(),
    body('web').optional({ checkFalsy: true }).trim().isURL().withMessage('Web debe ser una URL válida'),
    body('comentario').optional({ checkFalsy: true }).trim(),
    body().custom((value, { req }) => {
      const { email, telefono, web } = req.body;
      if (!email && !telefono && !web) {
        throw new Error('Debe proporcionar al menos un medio de contacto: email, teléfono o web');
      }
      return true;
    })
  ],
  validate,
  soporteNivelController.crear
);

// Actualizar nivel de soporte
router.put('/:proveedorId/soporte/nivel/:id',
  requirePermission('proveedores', 'update'),
  validarProveedorUUID,
  validarUUID,
  [
    body('nivel').optional().isInt({ min: 1, max: 10 }),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Email debe ser válido'),
    body('telefono').optional({ checkFalsy: true }).trim(),
    body('web').optional({ checkFalsy: true }).trim().isURL().withMessage('Web debe ser una URL válida'),
    body('comentario').optional({ checkFalsy: true }).trim(),
    body().custom((value, { req }) => {
      const { email, telefono, web } = req.body;
      if ((email !== undefined || telefono !== undefined || web !== undefined) && !email && !telefono && !web) {
        throw new Error('Debe proporcionar al menos un medio de contacto: email, teléfono o web');
      }
      return true;
    })
  ],
  validate,
  soporteNivelController.actualizar
);

// Eliminar nivel de soporte (soft delete)
router.delete('/:proveedorId/soporte/nivel/:id',
  requirePermission('proveedores', 'delete'),
  validarProveedorUUID,
  validarUUID,
  validate,
  soporteNivelController.eliminar
);

// =====================================================
// EQUIPOS DE SERVICIO
// =====================================================

router.get('/equipos',
  requirePermission('proveedores', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('activo').optional().isBoolean(),
    query('servicio_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    query('sede_id').optional({ nullable: true, checkFalsy: true }).isUUID()
  ],
  validate,
  equipoServicioController.listar
);

router.get('/equipos/:id',
  requirePermission('proveedores', 'read'),
  validarUUID,
  validate,
  equipoServicioController.obtener
);

router.post('/equipos',
  requirePermission('proveedores', 'create'),
  [
    body('servicio_id').notEmpty().isUUID(),
    body('sede_id').notEmpty().isUUID(),
    body('mac').optional().trim().matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
    body('modelo').optional().trim().isLength({ max: 100 }),
    body('marca').optional().trim().isLength({ max: 100 }),
    body('numero_serie').optional().trim().isLength({ max: 100 }),
    body('observaciones').optional().trim()
  ],
  validate,
  equipoServicioController.crear
);

router.put('/equipos/:id',
  requirePermission('proveedores', 'update'),
  validarUUID,
  validate,
  equipoServicioController.actualizar
);

router.delete('/equipos/:id',
  requirePermission('proveedores', 'delete'),
  validarUUID,
  validate,
  equipoServicioController.eliminar
);

// =====================================================
// RECLAMOS
// =====================================================

router.get('/reclamos/estadisticas',
  requirePermission('proveedores', 'read'),
  reclamoController.obtenerEstadisticas
);

router.get('/reclamos',
  requirePermission('proveedores', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('activo').optional().isBoolean(),
    query('servicio_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    query('sede_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    query('estado').optional().isIn(['abierto', 'en_proceso', 'resuelto', 'cerrado', 'cancelado']),
    query('prioridad').optional().isIn(['baja', 'media', 'alta', 'critica'])
  ],
  validate,
  reclamoController.listar
);

router.get('/reclamos/:id',
  requirePermission('proveedores', 'read'),
  validarUUID,
  validate,
  reclamoController.obtener
);

router.post('/reclamos',
  requirePermission('proveedores', 'create'),
  [
    body('servicio_id').notEmpty().isUUID(),
    body('sede_id').notEmpty().isUUID(),
    body('equipo_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    body('titulo').trim().notEmpty().isLength({ min: 3, max: 200 }),
    body('descripcion').trim().notEmpty(),
    body('prioridad').optional().isIn(['baja', 'media', 'alta', 'critica']),
    body('asignado_a_id').optional({ nullable: true, checkFalsy: true }).isUUID()
  ],
  validate,
  reclamoController.crear
);

router.put('/reclamos/:id/estado',
  requirePermission('proveedores', 'update'),
  validarUUID,
  [body('estado').notEmpty().isIn(['abierto', 'en_proceso', 'resuelto', 'cerrado', 'cancelado'])],
  validate,
  reclamoController.cambiarEstado
);

router.put('/reclamos/:id/asignar',
  requirePermission('proveedores', 'update'),
  validarUUID,
  [body('tecnico_id').notEmpty().isUUID()],
  validate,
  reclamoController.asignarTecnico
);

router.put('/reclamos/:id',
  requirePermission('proveedores', 'update'),
  validarUUID,
  validate,
  reclamoController.actualizar
);

// =====================================================
// PROVEEDORES (RUTAS GENÉRICAS AL FINAL)
// =====================================================

router.get('/estadisticas',
  requirePermission('proveedores', 'read'),
  proveedorController.obtenerEstadisticas
);

router.get('/',
  requirePermission('proveedores', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('activo').optional().isBoolean()
  ],
  validate,
  proveedorController.listar
);

router.get('/:id',
  requirePermission('proveedores', 'read'),
  validarUUID,
  validate,
  proveedorController.obtener
);

router.post('/',
  requirePermission('proveedores', 'create'),
  [
    body('empresa').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('direccion').optional().trim().isLength({ max: 200 })
  ],
  validate,
  proveedorController.crear
);

router.put('/:id',
  requirePermission('proveedores', 'update'),
  validarUUID,
  [
    body('empresa').optional().trim().isLength({ min: 2, max: 100 }),
    body('direccion').optional().trim().isLength({ max: 200 }),
    body('activo').optional().isBoolean()
  ],
  validate,
  proveedorController.actualizar
);

router.delete('/:id',
  requirePermission('proveedores', 'delete'),
  validarUUID,
  validate,
  proveedorController.eliminar
);

export default router;
