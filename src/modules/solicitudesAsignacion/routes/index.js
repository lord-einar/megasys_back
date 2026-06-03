import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, requireGroup, enrichUserWithRole } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import solicitudAsignacionController, { uploadAdjuntoMiddleware } from '../controllers/solicitudAsignacionController.js';
import SolicitudAsignacion from '../../../models/SolicitudAsignacion.js';

const router = express.Router();

router.use(authenticate);
router.use(enrichUserWithRole);

const validarId = [param('id').isUUID().withMessage('ID debe ser un UUID válido')];

const validarCrear = [
  body('tipo_equipo').isIn(SolicitudAsignacion.TIPOS_EQUIPO).withMessage('tipo_equipo inválido'),
  body('motivo').isIn(SolicitudAsignacion.MOTIVOS).withMessage('motivo inválido'),
  body('observacion_solicitante').trim().notEmpty().withMessage('La observación / razón técnica es requerida'),
  body('beneficiario_personal_id').isUUID().withMessage('beneficiario_personal_id debe ser un UUID válido'),
  body('inventario_anterior_id').optional({ nullable: true }).isUUID(),
  body('denuncia_presentada').optional({ nullable: true }).isBoolean()
];

const validarListar = [
  query('estado').optional().custom((value) => {
    const estados = Array.isArray(value) ? value : [value];
    return estados.every(e => SolicitudAsignacion.ESTADOS.includes(e));
  }).withMessage('estado inválido'),
  query('tipo_equipo').optional().isIn(SolicitudAsignacion.TIPOS_EQUIPO),
  query('motivo').optional().isIn(SolicitudAsignacion.MOTIVOS),
  query('beneficiario_personal_id').optional().isUUID(),
  query('desde').optional().isISO8601(),
  query('hasta').optional().isISO8601(),
  query('q').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validarAsignar = [
  body('inventario_id').isUUID().withMessage('inventario_id es requerido y debe ser un UUID válido'),
  body('categoria_id').optional({ nullable: true }).isUUID(),
  body('observacion').optional({ nullable: true }).isString(),
  body('equipo_anterior_accion').optional({ nullable: true }).isIn(['mantenimiento', 'dado_de_baja'])
];

// === LOOKUPS — antes de /:id para evitar captura del param ===

router.get('/lookups/personal',
  requirePermission('solicitudes_asignacion', 'read'),
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate,
  solicitudAsignacionController.lookupPersonal
);

router.get('/lookups/inventario-disponible',
  requirePermission('solicitudes_asignacion', 'read'),
  [
    query('tipo_equipo').optional().isIn(['notebook', 'celular']).withMessage('tipo_equipo debe ser notebook o celular'),
    query('categoria_id').optional().isUUID()
  ],
  validate,
  solicitudAsignacionController.lookupInventarioDisponible
);

// === CRUD ===

router.get('/',
  requirePermission('solicitudes_asignacion', 'read'),
  validarListar, validate,
  solicitudAsignacionController.listar
);

router.get('/:id',
  requirePermission('solicitudes_asignacion', 'read'),
  validarId, validate,
  solicitudAsignacionController.obtener
);

router.post('/',
  requirePermission('solicitudes_asignacion', 'create'),
  validarCrear, validate,
  solicitudAsignacionController.crear
);

// === WORKFLOW ===

router.post('/:id/asignar-equipo',
  requireGroup('Infraestructura'),
  [...validarId, ...validarAsignar], validate,
  solicitudAsignacionController.asignarEquipo
);

router.post('/:id/aprobar-rrhh',
  requireGroup('RRHH'),
  [...validarId, body('observacion').optional({ nullable: true }).isString()], validate,
  solicitudAsignacionController.aprobarRrhh
);

router.post('/:id/generar-remito',
  requireGroup('Infraestructura'),
  validarId, validate,
  solicitudAsignacionController.generarRemito
);

router.post('/:id/finalizar',
  requireGroup('Infraestructura', 'RRHH'),
  [...validarId, body('observacion').optional({ nullable: true }).isString()], validate,
  solicitudAsignacionController.finalizar
);

router.post('/:id/adjuntos',
  requirePermission('solicitudes_asignacion', 'update'),
  validarId, validate,
  uploadAdjuntoMiddleware,
  solicitudAsignacionController.subirAdjunto
);

router.post('/:id/rechazar',
  requireGroup('Infraestructura', 'RRHH'),
  [...validarId, body('motivo').trim().notEmpty().withMessage('El motivo es obligatorio')], validate,
  solicitudAsignacionController.rechazar
);

router.post('/:id/cancelar',
  requireGroup('Infraestructura', 'RRHH', 'Compras'),
  [...validarId, body('motivo').trim().notEmpty().withMessage('El motivo es obligatorio')], validate,
  solicitudAsignacionController.cancelar
);

export default router;
