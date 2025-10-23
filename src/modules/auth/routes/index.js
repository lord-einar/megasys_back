// src/modules/auth/routes/index.js - CORREGIDO
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
router.get('/permissions', authenticate, enrichUserWithRole, (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        name: req.user?.name || 'Usuario',
        email: req.user?.email || 'email@test.com',
        role: req.user?.role || 'user',
        roleInfo: req.user?.roleInfo || {}
      },
      permissions: req.user?.permissions || {}
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/auth/debug-groups
 * @desc    Analizar grupos del usuario para debugging
 * @access  Private
 */
router.get('/debug-groups', authenticate, (req, res) => {
  const roleService = require('../services/roleService');
  
  const analysis = roleService.analyzeUserGroups(req.user.groups || []);
  
  res.json({
    success: true,
    message: 'Análisis de grupos del usuario',
    data: {
      user: {
        name: req.user.name,
        email: req.user.email
      },
      groupAnalysis: analysis,
      rawGroups: req.user.groups,
      guidMapping: {
        'edc49d22-9ee8-4d90-a8b2-41cf64db1eed': 'Infraestructura',
        '2a16d910-c440-41a3-a896-eb6287185fef': 'Soporte',
        '88c0f708-14a1-4081-bcc6-4b3ab33a7ca6': 'Mesa de ayuda'
      }
    },
    timestamp: new Date().toISOString()
  });
});

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