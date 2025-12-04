const express = require('express');
const router = express.Router();
const visitaController = require('../controllers/visitaController');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requireRole } = require('../../auth/middleware/roleMiddleware');
const { body, param, query } = require('express-validator');
const validate = require('../../../shared/middleware/validation');

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

// Calendario y Listas (lectura - super_admin, support, helpdesk)
router.get('/calendario', requireRole('helpdesk'), visitaController.obtenerCalendario);
router.get('/checklist-items', requireRole('helpdesk'), visitaController.obtenerChecklistItems);
router.get('/estadisticas', requireRole('support'), visitaController.obtenerEstadisticas);
router.get('/', requireRole('helpdesk'), visitaController.listar);

// CRUD Visitas
router.post('/', requireRole('support'), validarCrearVisita, visitaController.crear);
router.get('/:id', requireRole('helpdesk'), param('id').isUUID(), validate, visitaController.obtener);
router.put('/:id', requireRole('support'), validarActualizarVisita, visitaController.actualizar);
router.delete('/:id', requireRole('super_admin'), param('id').isUUID(), validate, visitaController.eliminar);

// Acciones específicas
router.post('/:id/realizada', requireRole('support'), validarMarcarRealizada, visitaController.marcarRealizada);
router.post('/:id/cancelar', requireRole('support'), validarCancelar, visitaController.cancelar);
router.post('/:id/reprogramar', requireRole('support'), validarReprogramar, visitaController.reprogramar);
router.post('/:id/aviso', requireRole('support'), param('id').isUUID(), validate, visitaController.enviarAviso);

module.exports = router;
