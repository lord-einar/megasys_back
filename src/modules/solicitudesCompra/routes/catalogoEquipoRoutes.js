// src/modules/solicitudesCompra/routes/catalogoEquipoRoutes.js
import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, enrichUserWithRole } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import catalogoEquipoController from '../controllers/catalogoEquipoController.js';

const router = express.Router();

router.use(authenticate);
router.use(enrichUserWithRole);

const validarId = [
  param('id').isUUID().withMessage('ID debe ser un UUID válido')
];

const validarCrear = [
  body('tipo').isIn(['celular', 'notebook']).withMessage('tipo debe ser celular o notebook'),
  body('marca').trim().isLength({ min: 1, max: 50 }).withMessage('marca es requerida (1-50 caracteres)'),
  body('modelo').trim().isLength({ min: 1, max: 100 }).withMessage('modelo es requerido (1-100 caracteres)'),
  body('descripcion').optional({ nullable: true }).isString()
];

const validarActualizar = [
  body('tipo').optional().isIn(['celular', 'notebook']).withMessage('tipo debe ser celular o notebook'),
  body('marca').optional().trim().isLength({ min: 1, max: 50 }),
  body('modelo').optional().trim().isLength({ min: 1, max: 100 }),
  body('descripcion').optional({ nullable: true }).isString(),
  body('activo').optional().isBoolean()
];

const validarListar = [
  query('tipo').optional().isIn(['celular', 'notebook']),
  query('activo').optional().isBoolean()
];

router.get('/',
  requirePermission('catalogo_equipos', 'read'),
  validarListar, validate,
  catalogoEquipoController.listar
);

router.get('/:id',
  requirePermission('catalogo_equipos', 'read'),
  validarId, validate,
  catalogoEquipoController.obtener
);

router.post('/',
  requirePermission('catalogo_equipos', 'create'),
  validarCrear, validate,
  catalogoEquipoController.crear
);

router.put('/:id',
  requirePermission('catalogo_equipos', 'update'),
  [...validarId, ...validarActualizar], validate,
  catalogoEquipoController.actualizar
);

router.delete('/:id',
  requirePermission('catalogo_equipos', 'delete'),
  validarId, validate,
  catalogoEquipoController.eliminar
);

export default router;
