const express = require('express');
const router = express.Router();
const visitaController = require('../controllers/visitaController');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { body, param, query } = require('express-validator');
const validate = require('../../../shared/middleware/validation');

// Middleware de autorización simple (placeholder hasta que se implemente authorize real)
const authorize = (roles) => (req, res, next) => next();

// Validaciones
const validarCrearVisita = [
  body('sede_id').isUUID().withMessage('Sede ID debe ser UUID válido'),
  body('tecnico_asignado_id').isUUID().withMessage('Técnico ID debe ser UUID válido'),
  body('fecha').isISO8601().withMessage('Fecha debe ser válida'),
  body('tipo').isIn(['urgencia', 'solicitud', 'programada']).withMessage('Tipo inválido'),
  body('casos_tickets').optional().isArray().withMessage('Casos/tickets debe ser un array'),
  body('es_recurrente').optional().isBoolean().withMessage('Es recurrente debe ser booleano'),
  body('motivo').optional().isString(),
  body('observaciones').optional().isString(),
  validate
];

const validarActualizarVisita = [
  param('id').isUUID().withMessage('ID debe ser UUID válido'),
  body('sede_id').optional().isUUID().withMessage('Sede ID debe ser UUID válido'),
  body('tecnico_asignado_id').optional().isUUID().withMessage('Técnico ID debe ser UUID válido'),
  body('fecha').optional().isISO8601().withMessage('Fecha debe ser válida'),
  body('tipo').optional().isIn(['urgencia', 'solicitud', 'programada']).withMessage('Tipo inválido'),
  validate
];

const validarMarcarRealizada = [
  param('id').isUUID().withMessage('ID debe ser UUID válido'),
  body('checklist_items').isArray().withMessage('Checklist items debe ser un array'),
  body('observaciones').optional().isString(),
  validate
];

const validarSolicitudPublica = [
  body('token').notEmpty().withMessage('Token es requerido'),
  body('email').isEmail().withMessage('Email debe ser válido'),
  body('descripcion').notEmpty().withMessage('Descripción es requerida'),
  body('nombre').optional().isString(),
  validate
];

const validarCancelar = [
  param('id').isUUID().withMessage('ID debe ser UUID válido'),
  body('motivo').notEmpty().withMessage('Motivo de cancelación es requerido'),
  validate
];

const validarReprogramar = [
  param('id').isUUID().withMessage('ID debe ser UUID válido'),
  body('nueva_fecha').isISO8601().withMessage('Nueva fecha debe ser válida'),
  validate
];

// Rutas Públicas
router.post('/solicitudes', validarSolicitudPublica, visitaController.agregarSolicitud);

// Rutas Protegidas
router.use(authenticate);

// Calendario y Listas
router.get('/calendario', authorize(['Infraestructura', 'Soporte']), visitaController.obtenerCalendario);
router.get('/checklist-items', authorize(['Infraestructura', 'Soporte']), visitaController.obtenerChecklistItems);
router.get('/estadisticas', authorize(['Infraestructura', 'Soporte']), visitaController.obtenerEstadisticas);
router.get('/', authorize(['Infraestructura', 'Soporte']), visitaController.listar);

// CRUD Visitas
router.post('/', authorize(['Infraestructura', 'Soporte']), validarCrearVisita, visitaController.crear);
router.get('/:id', authorize(['Infraestructura', 'Soporte']), param('id').isUUID(), validate, visitaController.obtener);
router.put('/:id', authorize(['Infraestructura', 'Soporte']), validarActualizarVisita, visitaController.actualizar);

// Acciones específicas
router.post('/:id/realizada', authorize(['Infraestructura', 'Soporte']), validarMarcarRealizada, visitaController.marcarRealizada);
router.post('/:id/cancelar', authorize(['Infraestructura', 'Soporte']), validarCancelar, visitaController.cancelar);
router.post('/:id/reprogramar', authorize(['Infraestructura', 'Soporte']), validarReprogramar, visitaController.reprogramar);

module.exports = router;
