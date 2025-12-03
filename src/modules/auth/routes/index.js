const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Rutas de autenticación
router.get('/login', authController.login);
router.get('/callback', authController.callback);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

// Rutas de usuario
router.get('/me', authenticate, authController.me);
router.get('/status', authenticate, authController.status);
router.get('/permissions', authenticate, authController.getPermissions);
router.get('/photo/:userId', authenticate, authController.getPhoto);
router.get('/photo-base64', authenticate, authController.getPhotoBase64);

// DEV ONLY: Bypass login
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-login', authController.devLogin);
}

module.exports = router;