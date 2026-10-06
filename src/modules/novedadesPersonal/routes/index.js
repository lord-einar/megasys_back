// src/modules/novedadesPersonal/routes/index.js
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requireRole } from '../../auth/middleware/roleMiddleware.js';
import { body, param, query } from 'express-validator';
import validate from '../../../shared/middleware/validation.js';
import novedadMovimientoController from '../controllers/novedadMovimientoController.js';

const router = express.Router();

// Novedades de cambio de sede detectadas por la sync con Entra ID: solo super_admin
router.use(authenticate);
router.use(requireRole('super_admin'));

const validarId = [param('id').isUUID().withMessage('ID debe ser un UUID válido')];

router.get('/resumen', novedadMovimientoController.resumen);

router.get('/',
  [query('estado').optional().isIn(['pendiente', 'confirmada', 'descartada', 'todas'])],
  validate,
  novedadMovimientoController.listar
);

router.post('/:id/confirmar', validarId, validate, novedadMovimientoController.confirmar);

router.post('/:id/descartar',
  [...validarId, body('observaciones').optional().isString().trim()],
  validate,
  novedadMovimientoController.descartar
);

export default router;
