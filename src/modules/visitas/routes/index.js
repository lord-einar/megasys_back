import express from 'express';
const router = express.Router();
import visitaController from '../controllers/visitaController.js';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requireRole } from '../../auth/middleware/roleMiddleware.js';
import { publicEndpointLimiter } from '../../../shared/middleware/rateLimiter.js';
import { body, param, query } from 'express-validator';
import validate from '../../../shared/middleware/validation.js';

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

const validarFeedbackToken = [
  param('token').notEmpty().isLength({ min: 24, max: 48 }).withMessage('Token inválido'),
  validate
];

const validarAgregarFeedback = [
  param('token').notEmpty().isLength({ min: 24, max: 48 }).withMessage('Token inválido'),
  body('comentarios').notEmpty().trim().withMessage('Los comentarios son requeridos'),
  body('nombre').notEmpty().trim().withMessage('El nombre es requerido'),
  validate
];

// Rutas Públicas (con rate limiting restrictivo)
router.post('/solicitudes', publicEndpointLimiter, validarSolicitudPublica, visitaController.agregarSolicitud);
router.get('/feedback/:token', publicEndpointLimiter, validarFeedbackToken, visitaController.obtenerInfoFeedback);
router.post('/feedback/:token', publicEndpointLimiter, validarAgregarFeedback, visitaController.agregarFeedback);

// Rutas Protegidas
router.use(authenticate);

// Calendario y Listas (lectura - super_admin, support, helpdesk)
router.get('/calendario', requireRole('helpdesk'), visitaController.obtenerCalendario);
router.get('/checklist-items', requireRole('helpdesk'), visitaController.obtenerChecklistItems);
router.get('/estadisticas', requireRole('support'), visitaController.obtenerEstadisticas);
router.get('/reportes/dashboard', requireRole('super_admin', 'support', 'helpdesk'), visitaController.obtenerDashboard);
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

export default router;
