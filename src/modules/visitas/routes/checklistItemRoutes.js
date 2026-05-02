// src/modules/visitas/routes/checklistItemRoutes.js
import express from 'express';
import checklistItemController from '../controllers/checklistItemController.js';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requireRole, requireLegacyAccess } from '../../auth/middleware/roleMiddleware.js';
import { body, param } from 'express-validator';
import validate from '../../../shared/middleware/validation.js';

const router = express.Router();

// Validaciones
const validarCrearItem = [
    body('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('descripcion').optional().isString(),
    body('orden').optional().isInt({ min: 0 }).withMessage('El orden debe ser un número entero positivo'),
    body('activo').optional().isBoolean(),
    validate
];

const validarActualizarItem = [
    param('id').isUUID().withMessage('ID debe ser UUID válido'),
    body('nombre').optional()
        .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('descripcion').optional().isString(),
    body('orden').optional().isInt({ min: 0 }).withMessage('El orden debe ser un número entero positivo'),
    body('activo').optional().isBoolean(),
    validate
];

const validarReordenar = [
    body('items')
        .isArray({ min: 1 }).withMessage('Se requiere un array de items')
        .custom((items) => {
            return items.every(item =>
                item.id && typeof item.orden === 'number'
            );
        }).withMessage('Cada item debe tener id y orden'),
    validate
];

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireLegacyAccess);

/**
 * GET /api/visitas/checklist-items
 * Listar todos los items del checklist
 * Acceso: helpdesk+
 */
router.get('/', requireRole('helpdesk'), checklistItemController.listar.bind(checklistItemController));

/**
 * GET /api/visitas/checklist-items/:id
 * Obtener un item por ID
 * Acceso: helpdesk+
 */
router.get('/:id',
    requireRole('helpdesk'),
    param('id').isUUID().withMessage('ID debe ser UUID válido'),
    validate,
    checklistItemController.obtener.bind(checklistItemController)
);

/**
 * POST /api/visitas/checklist-items
 * Crear nuevo item de checklist
 * Acceso: super_admin
 */
router.post('/',
    requireRole('super_admin'),
    validarCrearItem,
    checklistItemController.crear.bind(checklistItemController)
);

/**
 * PUT /api/visitas/checklist-items/:id
 * Actualizar item de checklist
 * Acceso: super_admin
 */
router.put('/:id',
    requireRole('super_admin'),
    validarActualizarItem,
    checklistItemController.actualizar.bind(checklistItemController)
);

/**
 * DELETE /api/visitas/checklist-items/:id
 * Eliminar item de checklist (soft delete)
 * Acceso: super_admin
 */
router.delete('/:id',
    requireRole('super_admin'),
    param('id').isUUID().withMessage('ID debe ser UUID válido'),
    validate,
    checklistItemController.eliminar.bind(checklistItemController)
);

/**
 * PATCH /api/visitas/checklist-items/reordenar
 * Reordenar items de checklist
 * Acceso: super_admin
 */
router.patch('/reordenar',
    requireRole('super_admin'),
    validarReordenar,
    checklistItemController.reordenar.bind(checklistItemController)
);

export default router;
