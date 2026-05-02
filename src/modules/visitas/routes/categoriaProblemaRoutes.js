// src/modules/visitas/routes/categoriaProblemaRoutes.js
import express from 'express';
import categoriaProblemaController from '../controllers/categoriaProblemaController.js';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requireRole, requireLegacyAccess } from '../../auth/middleware/roleMiddleware.js';
import { body, param, query } from 'express-validator';
import validate from '../../../shared/middleware/validation.js';

const router = express.Router();

// Validaciones
const validarCrearCategoria = [
    body('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('codigo').optional()
        .isLength({ max: 50 }).withMessage('El código no puede exceder 50 caracteres'),
    body('descripcion').optional().isString(),
    body('icono').optional()
        .isLength({ max: 50 }).withMessage('El icono no puede exceder 50 caracteres'),
    body('color').optional()
        .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('El color debe ser un código hexadecimal válido'),
    body('orden').optional().isInt({ min: 0 }).withMessage('El orden debe ser un número entero positivo'),
    body('activo').optional().isBoolean(),
    validate
];

const validarActualizarCategoria = [
    param('id').isUUID().withMessage('ID debe ser UUID válido'),
    body('nombre').optional()
        .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('codigo').optional()
        .isLength({ max: 50 }).withMessage('El código no puede exceder 50 caracteres'),
    body('descripcion').optional().isString(),
    body('icono').optional()
        .isLength({ max: 50 }).withMessage('El icono no puede exceder 50 caracteres'),
    body('color').optional()
        .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('El color debe ser un código hexadecimal válido'),
    body('orden').optional().isInt({ min: 0 }).withMessage('El orden debe ser un número entero positivo'),
    body('activo').optional().isBoolean(),
    validate
];

const validarReordenar = [
    body('categorias')
        .isArray({ min: 1 }).withMessage('Se requiere un array de categorías')
        .custom((categorias) => {
            return categorias.every(cat =>
                cat.id && typeof cat.orden === 'number'
            );
        }).withMessage('Cada categoría debe tener id y orden'),
    validate
];

const validarListar = [
    // Aceptar cualquier valor para activo, se convertirá en el controlador
    query('activo').optional(),
    validate
];

// Todas las rutas requieren autenticación
router.use(authenticate);
router.use(requireLegacyAccess);

/**
 * GET /api/visitas/categorias-problemas
 * Listar todas las categorías de problemas
 * Acceso: support+ (todos los usuarios autenticados pueden ver categorías)
 */
router.get('/', categoriaProblemaController.listar.bind(categoriaProblemaController));

/**
 * GET /api/visitas/categorias-problemas/:id
 * Obtener una categoría por ID
 * Acceso: helpdesk+
 */
router.get('/:id',
    requireRole('helpdesk'),
    param('id').isUUID().withMessage('ID debe ser UUID válido'),
    validate,
    categoriaProblemaController.obtener.bind(categoriaProblemaController)
);

/**
 * POST /api/visitas/categorias-problemas
 * Crear nueva categoría de problema
 * Acceso: super_admin
 */
router.post('/',
    requireRole('super_admin'),
    validarCrearCategoria,
    categoriaProblemaController.crear.bind(categoriaProblemaController)
);

/**
 * PUT /api/visitas/categorias-problemas/:id
 * Actualizar categoría de problema
 * Acceso: super_admin
 */
router.put('/:id',
    requireRole('super_admin'),
    validarActualizarCategoria,
    categoriaProblemaController.actualizar.bind(categoriaProblemaController)
);

/**
 * DELETE /api/visitas/categorias-problemas/:id
 * Eliminar categoría de problema (soft delete)
 * Acceso: super_admin
 */
router.delete('/:id',
    requireRole('super_admin'),
    param('id').isUUID().withMessage('ID debe ser UUID válido'),
    validate,
    categoriaProblemaController.eliminar.bind(categoriaProblemaController)
);

/**
 * PATCH /api/visitas/categorias-problemas/reordenar
 * Reordenar categorías de problema
 * Acceso: super_admin
 */
router.patch('/reordenar',
    requireRole('super_admin'),
    validarReordenar,
    categoriaProblemaController.reordenar.bind(categoriaProblemaController)
);

export default router;
