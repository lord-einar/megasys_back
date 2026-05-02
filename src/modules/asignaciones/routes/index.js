// src/modules/asignaciones/routes/index.js
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requireLegacyAccess } from '../../auth/middleware/roleMiddleware.js';
import { body, param, query } from 'express-validator';
import validate from '../../../shared/middleware/validation.js';
import asignacionInventarioController from '../controllers/asignacionInventarioController.js';

const router = express.Router();

router.use(authenticate);
router.use(requireLegacyAccess);

const validarId = [
  param('id').isUUID().withMessage('ID debe ser un UUID válido')
];

const validarCrear = [
  body('inventario_id').isUUID().withMessage('inventario_id debe ser un UUID válido'),
  body('personal_id').isUUID().withMessage('personal_id debe ser un UUID válido'),
  body('motivo').trim().notEmpty().withMessage('El motivo es requerido'),
  body('fecha_asignacion').optional().isISO8601().withMessage('fecha_asignacion debe ser una fecha válida')
];

const validarActualizar = [
  body('fecha_asignacion').optional().isISO8601().withMessage('fecha_asignacion debe ser una fecha válida'),
  body('fecha_devolucion').optional({ nullable: true }).isISO8601().withMessage('fecha_devolucion debe ser una fecha válida'),
  body('motivo').optional().trim().notEmpty().withMessage('El motivo no puede estar vacío')
];

const validarCerrar = [
  body('fecha_devolucion').optional().isISO8601().withMessage('fecha_devolucion debe ser una fecha válida')
];

const validarListar = [
  query('personal_id').optional().isUUID(),
  query('inventario_id').optional().isUUID(),
  query('activo').optional().isBoolean(),
  query('tipo_articulo').optional().isString()
];

router.get('/', validarListar, validate, asignacionInventarioController.listar);
router.get('/:id', validarId, validate, asignacionInventarioController.obtener);
router.post('/', validarCrear, validate, asignacionInventarioController.crear);
router.patch('/:id/cerrar', [...validarId, ...validarCerrar], validate, asignacionInventarioController.cerrar);
router.put('/:id', [...validarId, ...validarActualizar], validate, asignacionInventarioController.actualizar);

export default router;
