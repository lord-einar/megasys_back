// src/shared/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * Función para extraer la IP real del cliente desde los headers de proxy de Azure
 * Azure envía: X-Forwarded-For: "ip1, ip2, ip3" o X-Real-IP: "ip"
 */
const getClientIp = (req) => {
  try {
    // Intentar obtener de X-Forwarded-For (puede ser una lista)
    const xForwardedFor = req.get('x-forwarded-for');
    if (xForwardedFor) {
      // Tomar la primera IP de la lista y eliminar puerto si existe
      const ip = xForwardedFor.split(',')[0].trim();
      return ip.split(':')[0];
    }

    // Intentar obtener de X-Real-IP
    const xRealIp = req.get('x-real-ip');
    if (xRealIp) {
      return xRealIp.split(':')[0];
    }

    // Fallback a req.ip
    const reqIp = req.ip || 'unknown';
    return reqIp.split(':')[0];
  } catch (error) {
    logger.error('Error extracting client IP:', error.message);
    return 'unknown';
  }
};

/**
 * Rate limiter general - para la mayoría de rutas autenticadas
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // desarrollo: 1000, producción: 100
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Usar la función para extraer IP limpia
    return getClientIp(req);
  },
  handler: (req, res) => {
    const clientIp = getClientIp(req);
    logger.warn(`Rate limit general excedido para IP: ${clientIp} en ruta: ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rate limiter específico para autenticación - más permisivo para desarrollo
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 50, // máximo 50 requests por IP por minuto
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Usar la función para extraer IP limpia
    return getClientIp(req);
  },
  handler: (req, res) => {
    const clientIp = getClientIp(req);
    logger.warn(`Rate limit en auth para IP: ${clientIp}`);
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rate limiter específico para endpoints públicos (sin autenticación)
 * Más restrictivo para prevenir abuso:
 * - Confirmación de recepción de remitos
 * - Solicitudes de visitas
 * - Feedback de visitas
 */
export const publicEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 100 : 20, // desarrollo: 100, producción: 20
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP. Por favor intenta de nuevo en 15 minutos.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return getClientIp(req);
  },
  handler: (req, res) => {
    const clientIp = getClientIp(req);
    logger.warn(`Rate limit en endpoint público excedido para IP: ${clientIp} en ruta: ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Demasiadas peticiones desde esta IP. Por favor intenta de nuevo en 15 minutos.',
      timestamp: new Date().toISOString()
    });
  }
});