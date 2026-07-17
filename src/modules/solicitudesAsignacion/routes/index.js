import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, enrichUserWithRole } from '../../auth/middleware/roleMiddleware.js';
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
    query('tipo_equipo').optional().isIn(SolicitudAsignacion.TIPOS_EQUIPO).withMessage('tipo_equipo inválido'),
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

const validarEditar = [
  body('tipo_equipo').optional().isIn(SolicitudAsignacion.TIPOS_EQUIPO).withMessage('tipo_equipo inválido'),
  body('motivo').optional().isIn(SolicitudAsignacion.MOTIVOS).withMessage('motivo inválido'),
  body('observacion_solicitante').optional().isString(),
  body('beneficiario_personal_id').optional().isUUID().withMessage('beneficiario_personal_id debe ser un UUID válido'),
  body('inventario_anterior_id').optional({ nullable: true }).isUUID(),
  body('denuncia_presentada').optional({ nullable: true }).isBoolean(),
  body('comentario_edicion').optional({ nullable: true }).isString()
];

router.put('/:id',
  requirePermission('solicitudes_asignacion', 'update'),
  [...validarId, ...validarEditar], validate,
  solicitudAsignacionController.editar
);

// === WORKFLOW ===

router.post('/:id/solicitar-compra',
  requirePermission('solicitudes_asignacion', 'asignar_equipo'),
  [...validarId, body('observacion').optional({ nullable: true }).isString()], validate,
  solicitudAsignacionController.solicitarCompra
);

router.post('/:id/asignar-equipo',
  requirePermission('solicitudes_asignacion', 'asignar_equipo'),
  [...validarId, ...validarAsignar], validate,
  solicitudAsignacionController.asignarEquipo
);

router.post('/:id/aprobar-infra',
  requirePermission('solicitudes_asignacion', 'asignar_equipo'),
  [...validarId, body('observacion').optional({ nullable: true }).isString()], validate,
  solicitudAsignacionController.aprobarInfra
);

router.post('/:id/aprobar-rrhh',
  requirePermission('solicitudes_asignacion', 'aprobar_rrhh'),
  [...validarId, body('observacion').optional({ nullable: true }).isString()], validate,
  solicitudAsignacionController.aprobarRrhh
);

router.get('/lookups/soporte',
  requirePermission('solicitudes_asignacion', 'read'),
  validate,
  solicitudAsignacionController.lookupSoporte
);

router.post('/:id/generar-remito',
  requirePermission('solicitudes_asignacion', 'generar_remito'),
  [...validarId, body('tecnico_id').optional({ nullable: true }).isUUID()], validate,
  solicitudAsignacionController.generarRemito
);

router.post('/:id/finalizar',
  requirePermission('solicitudes_asignacion', 'finalizar'),
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
  requirePermission('solicitudes_asignacion', 'rechazar'),
  [...validarId, body('motivo').trim().notEmpty().withMessage('El motivo es obligatorio')], validate,
  solicitudAsignacionController.rechazar
);

router.post('/:id/cancelar',
  requirePermission('solicitudes_asignacion', 'cancelar'),
  [...validarId, body('motivo').trim().notEmpty().withMessage('El motivo es obligatorio')], validate,
  solicitudAsignacionController.cancelar
);

router.post('/:id/reenviar-aviso',
  requirePermission('solicitudes_asignacion', 'reenviar_aviso'),
  validarId, validate,
  solicitudAsignacionController.reenviarAviso
);

export default router;
