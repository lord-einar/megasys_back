// src/shared/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter general - para la mayoría de rutas
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // desarrollo: 1000, producción: 100
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit excedido para IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.',
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    // No aplicar rate limit a rutas de autenticación y confirmación pública
    return req.path.startsWith('/api/auth') || req.path.includes('/confirmar-recepcion');
  }
});

/**
 * Rate limiter específico para autenticación - más permisivo para desarrollo
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 50, // máximo 50 requests por IP por minuto
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit en auth para IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter
};