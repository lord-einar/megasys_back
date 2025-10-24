// src/modules/auth/routes/index.js - REFACTORIZADO PARA SOLID
const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { requirePermission, requireRole, enrichUserWithRole } = require('../middleware/roleMiddleware');
const validate = require('../../../shared/middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

/**
 * @route   GET /api/auth/login
 * @desc    Iniciar proceso de autenticación con Microsoft
 * @access  Public
 */
router.get('/login', authController.login);

/**
 * @route   GET /api/auth/callback
 * @desc    Procesar callback de autenticación
 * @access  Public
 */
router.get('/callback', authController.callback);

/**
 * @route   GET /api/auth/me
 * @desc    Obtener información del usuario actual con roles
 * @access  Private
 */
router.get('/me', authenticate, enrichUserWithRole, authController.me);

/**
 * @route   GET /api/auth/status
 * @desc    Verificar estado de autenticación
 * @access  Private
 */
router.get('/status', authenticate, enrichUserWithRole, authController.status);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refrescar token de acceso
 * @access  Public
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token es requerido'),
  validate
], authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/photo/:userId
 * @desc    Obtener foto del perfil por URL
 * @access  Private
 */
router.get('/photo/:userId', authenticate, authController.getPhoto);

/**
 * @route   GET /api/auth/photo-base64
 * @desc    Obtener foto en base64 (para casos específicos)
 * @access  Private
 */
router.get('/photo-base64', authenticate, authController.getPhotoBase64);

/**
 * @route   GET /api/auth/permissions
 * @desc    Obtener permisos del usuario actual
 * @access  Private
 */
router.get('/permissions', authenticate, enrichUserWithRole, authController.getPermissions);

/**
 * @route   GET /api/auth/debug-groups
 * @desc    Analizar grupos del usuario para debugging (solo en desarrollo)
 * @access  Private
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/debug-groups', authenticate, authController.debugGroups);
}

/**
 * @route   GET /api/auth/test
 * @desc    Endpoint de prueba básico
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Ruta de auth funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;