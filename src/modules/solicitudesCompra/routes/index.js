// src/modules/solicitudesCompra/routes/index.js
import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, enrichUserWithRole } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import solicitudCompraController from '../controllers/solicitudCompraController.js';
import SolicitudCompra from '../../../models/SolicitudCompra.js';

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

export default router;
