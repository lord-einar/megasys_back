// src/shared/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

/**
 * Función para extraer la IP real del cliente desde los headers de proxy de Azure
 * Azure envía: X-Forwarded-For: "ip1, ip2, ip3" o X-Real-IP: "ip"
 */
const getClientIp = (req) => {
  try {
    const xForwardedFor = req.get('x-forwarded-for');
    if (xForwardedFor) {
      const ip = xForwardedFor.split(',')[0].trim();
      return ip.split(':')[0];
    }
    const xRealIp = req.get('x-real-ip');
    if (xRealIp) {
      return xRealIp.split(':')[0];
    }
    const reqIp = req.ip || 'unknown';
    return reqIp.split(':')[0];
  } catch (error) {
    logger.error('Error extracting client IP:', error.message);
    return 'unknown';
  }
};

/**
 * Extrae el identificador de usuario del JWT para limitar por usuario en vez de por IP.
 * Se decodifica sin verificar (la verificación real ocurre en authMiddleware).
 * Fallback a IP si no hay token válido (rutas públicas).
 */
const getUserKey = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(authHeader.substring(7));
      const userId = decoded?.preferred_username || decoded?.email || decoded?.sub;
      if (userId) return `user:${userId}`;
    } catch { /* fall through */ }
  }
  return `ip:${getClientIp(req)}`;
};

/**
 * Rate limiter general - para la mayoría de rutas autenticadas.
 * Limita por usuario (extraído del JWT) para evitar que usuarios en la misma
 * red corporativa (misma IP pública) compartan el límite entre sí.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 2000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserKey,
  handler: (req, res) => {
    const key = getUserKey(req);
    logger.warn(`Rate limit general excedido para ${key} en ruta: ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Demasiadas peticiones, intenta de nuevo en 15 minutos.',
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