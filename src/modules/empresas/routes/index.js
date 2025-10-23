// src/modules/empresas/routes/index.js
const express = require('express');
const empresaController = require('../controllers/empresaController');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requirePermission } = require('../../auth/middleware/roleMiddleware');
const validate = require('../../../shared/middleware/validation');
const { body, param } = require('express-validator');

const router = express.Router();

/**
 * @route   GET /api/empresas/activas
 * @desc    Obtener todas las empresas activas (para combobox)
 * @access  Public
 */
router.get('/activas', empresaController.activas);

/**
 * @route   GET /api/empresas
 * @desc    Obtener todas las empresas
 * @access  Private
 */
router.get('/', authenticate, empresaController.todas);

/**
 * @route   GET /api/empresas/:id
 * @desc    Obtener empresa por ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('ID de empresa inválido')],
  validate,
  empresaController.obtenerPorId
);

/**
 * @route   POST /api/empresas
 * @desc    Crear nueva empresa
 * @access  Public (for development/testing)
 */
router.post(
  '/',
  [
    body('nombre')
      .notEmpty().withMessage('El nombre es requerido')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('razonSocial')
      .optional()
      .trim()
      .isLength({ max: 150 }).withMessage('La razón social no puede exceder 150 caracteres'),
    body('rfc')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('El RFC no puede exceder 50 caracteres'),
    body('email')
      .optional()
      .isEmail().withMessage('Email inválido'),
    body('telefono')
      .optional()
      .trim(),
    body('sitioWeb')
      .optional()
      .trim()
  ],
  validate,
  empresaController.crear
);

/**
 * @route   PUT /api/empresas/:id
 * @desc    Actualizar empresa
 * @access  Private - Requiere permiso de admin
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('admin', 'system_settings'),
  [
    param('id').isUUID().withMessage('ID de empresa inválido'),
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('razonSocial')
      .optional()
      .trim()
      .isLength({ max: 150 }).withMessage('La razón social no puede exceder 150 caracteres'),
    body('rfc')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('El RFC no puede exceder 50 caracteres'),
    body('email')
      .optional()
      .isEmail().withMessage('Email inválido'),
    body('activo')
      .optional()
      .isBoolean().withMessage('El estado debe ser booleano')
  ],
  validate,
  empresaController.actualizar
);

/**
 * @route   DELETE /api/empresas/:id
 * @desc    Eliminar empresa
 * @access  Private - Requiere permiso de admin
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('admin', 'system_settings'),
  [param('id').isUUID().withMessage('ID de empresa inválido')],
  validate,
  empresaController.eliminar
);

module.exports = router;
