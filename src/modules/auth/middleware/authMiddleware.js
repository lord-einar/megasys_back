// src/modules/auth/middleware/authMiddleware.js
const authService = require('../services/authService');
const { error } = require('../../../shared/utils/response');
const logger = require('../../../shared/utils/logger');

/**
 * Middleware para verificar autenticación
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return error(res, 'Token de autorización requerido', 401);
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return error(res, 'Formato de token inválido. Use: Bearer <token>', 401);
    }
    
    const token = parts[1];
    
    const decoded = authService.verifyJWT(token);
    
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('Error en authenticate middleware:', {
      error: err.message,
      stack: err.stack
    });
    
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expirado', 401);
    }
    
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Token inválido', 401);
    }
    
    return error(res, 'Error de autenticación', 401);
  }
};

module.exports = {
  authenticate
};