// src/modules/solicitudesCompra/routes/index.js
import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, requireGroup, enrichUserWithRole } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import solicitudCompraController, { uploadAdjuntoMiddleware } from '../controllers/solicitudCompraController.js';
import stockEquiposController from '../controllers/stockEquiposController.js';
import SolicitudCompra from '../../../models/SolicitudCompra.js';
import { VALID_STATES } from '../../../shared/constants/inventoryStates.js';

const router = express.Router();

router.use(authenticate);
router.use(enrichUserWithRole);

const validarId = [
  param('id').isUUID().withMessage('ID debe ser un UUID válido')
];

const validarCrear = [
  body('tipo_equipo').isIn(SolicitudCompra.TIPOS_EQUIPO).withMessage('tipo_equipo inválido'),
  body('motivo').isIn(SolicitudCompra.MOTIVOS).withMessage('motivo inválido'),
  body('observacion_solicitante').trim().notEmpty().withMessage('La observación / razón técnica es requerida'),
  body('beneficiario_personal_id').isUUID().withMessage('beneficiario_personal_id debe ser un UUID válido'),
  body('inventario_actual_id').optional({ nullable: true }).isUUID().withMessage('inventario_actual_id debe ser un UUID válido'),
  body('denuncia_presentada').optional({ nullable: true }).isBoolean()
];

const validarActualizar = [
  body('tipo_equipo').optional().isIn(SolicitudCompra.TIPOS_EQUIPO),
  body('motivo').optional().isIn(SolicitudCompra.MOTIVOS),
  body('observacion_solicitante').optional().trim().notEmpty(),
  body('beneficiario_personal_id').optional().isUUID(),
  body('inventario_actual_id').optional({ nullable: true }).isUUID(),
  body('denuncia_presentada').optional({ nullable: true }).isBoolean(),
  body('comentario').optional().isString()
];

const validarListar = [
  query('estado').optional().custom((value) => {
    const estados = Array.isArray(value) ? value : [value];
    return estados.every(e => SolicitudCompra.ESTADOS.includes(e));
  }).withMessage('estado inválido'),
  query('tipo_equipo').optional().isIn(SolicitudCompra.TIPOS_EQUIPO),
  query('motivo').optional().isIn(SolicitudCompra.MOTIVOS),
  query('beneficiario_personal_id').optional().isUUID(),
  query('desde').optional().isISO8601(),
  query('hasta').optional().isISO8601(),
  query('q').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

router.get('/lookups/personal',
  requirePermission('solicitudes_compra', 'read'),
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate,
  solicitudCompraController.lookupPersonal
);

router.get('/lookups/sedes',
  requirePermission('solicitudes_compra', 'read'),
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 300 }),
  validate,
  solicitudCompraController.lookupSedes
);

router.get('/lookups/inventario-asignado',
  requirePermission('solicitudes_compra', 'read'),
  query('personal_id').isUUID().withMessage('personal_id debe ser un UUID válido'),
  query('tipo_equipo').optional().isIn(SolicitudCompra.TIPOS_EQUIPO),
  validate,
  solicitudCompraController.lookupInventarioAsignado
);

// === STOCK DE EQUIPOS (Notebooks y Celulares) ===
// Visibilidad: cualquier usuario con permiso de lectura de solicitudes de compra
// (super_admin, RRHH y Compras), más Infraestructura para soporte a equipo.
router.get('/stock-equipos',
  requirePermission('solicitudes_compra', 'read'),
  [
    query('tipo').optional().isIn(['notebook', 'celular']).withMessage('tipo debe ser notebook o celular'),
    query('estado').optional().isIn(VALID_STATES).withMessage('estado inválido'),
    query('q').optional().isString()
  ],
  validate,
  stockEquiposController.listarStock
);

router.get('/historial-equipos/personal/:personalId',
  requirePermission('solicitudes_compra', 'read'),
  param('personalId').isUUID().withMessage('personalId debe ser un UUID válido'),
  validate,
  stockEquiposController.historialPorPersonal
);

router.get('/historial-equipos/sede/:sedeId',
  requirePermission('solicitudes_compra', 'read'),
  param('sedeId').isUUID().withMessage('sedeId debe ser un UUID válido'),
  validate,
  stockEquiposController.historialPorSede
);

router.get('/',
  requirePermission('solicitudes_compra', 'read'),
  validarListar, validate,
  solicitudCompraController.listar
);

router.get('/:id',
  requirePermission('solicitudes_compra', 'read'),
  validarId, validate,
  solicitudCompraController.obtener
);

router.post('/',
  requirePermission('solicitudes_compra', 'create'),
  validarCrear, validate,
  solicitudCompraController.crear
);

router.put('/:id',
  requirePermission('solicitudes_compra', 'update'),
  [...validarId, ...validarActualizar], validate,
  solicitudCompraController.actualizar
);

// === WORKFLOW ===

const validarAprobarInfra = [
  body('catalogo_equipo_id').isUUID().withMessage('catalogo_equipo_id es requerido'),
  body('observacion').optional({ nullable: true }).isString()
];

const validarAprobarRrhh = [
  body('observacion').optional({ nullable: true }).isString()
];

const validarRegistrarCompra = [
  body('numero_oc').trim().notEmpty().withMessage('numero_oc es requerido')
    .isLength({ max: 50 }).withMessage('numero_oc no puede exceder 50 caracteres'),
  body('observacion').optional({ nullable: true }).isString()
];

const validarEstadoCompra = [
  body('estado').isIn(['pedido', 'recibido', 'entregado_sistemas', 'entregado_destinatario'])
    .withMessage('estado de compra inválido'),
  body('observacion').optional({ nullable: true }).isString()
];

const validarFinalizarSistemas = [
  body('imei').optional({ nullable: true }).isString().isLength({ max: 50 }),
  body('numero_serie').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('fecha_adquisicion').optional({ nullable: true }).isISO8601(),
  body('valor_adquisicion').optional({ nullable: true }).isFloat({ min: 0 }),
  body('observacion').optional({ nullable: true }).isString()
];

const validarMotivo = [
  body('motivo').trim().notEmpty().withMessage('El motivo es obligatorio')
];

router.post('/:id/aprobar-infra',
  requireGroup('Infraestructura'),
  [...validarId, ...validarAprobarInfra], validate,
  solicitudCompraController.aprobarInfra
);

router.post('/:id/aprobar-rrhh',
  requireGroup('RRHH'),
  [...validarId, ...validarAprobarRrhh], validate,
  solicitudCompraController.aprobarRrhh
);

router.post('/:id/registrar-compra',
  requireGroup('Compras'),
  [...validarId, ...validarRegistrarCompra], validate,
  solicitudCompraController.registrarCompra
);

router.post('/:id/estado-compra',
  requireGroup('Compras'),
  [...validarId, ...validarEstadoCompra], validate,
  solicitudCompraController.actualizarEstadoCompra
);

router.post('/:id/finalizar-sistemas',
  requireGroup('Infraestructura'),
  [...validarId, ...validarFinalizarSistemas], validate,
  solicitudCompraController.finalizarSistemas
);

router.post('/:id/adjuntos',
  requirePermission('solicitudes_compra', 'update'),
  validarId, validate,
  uploadAdjuntoMiddleware,
  solicitudCompraController.subirAdjunto
);

router.post('/:id/rechazar',
  requireGroup('Infraestructura', 'RRHH'),
  [...validarId, ...validarMotivo], validate,
  solicitudCompraController.rechazar
);

router.post('/:id/cancelar',
  requireGroup('Infraestructura', 'RRHH', 'Compras'),
  [...validarId, ...validarMotivo], validate,
  solicitudCompraController.cancelar
);

export default router;
