// src/shared/middleware/errorHandler.js
const logger = require('../utils/logger');
const { error } = require('../utils/response');

/**
 * Middleware global para manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Error capturado:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Error de validación de Sequelize
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    return error(res, 'Errores de validación', 400, errors);
  }

  // Error de restricción única de Sequelize
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0].path;
    return error(res, `El ${field} ya existe`, 409);
  }

  // Error de clave foránea
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return error(res, 'Error de referencia en la base de datos', 400);
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Token inválido', 401);
  }

  // JWT expirado
  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expirado', 401);
  }

  // Error de sintaxis JSON
  if (err.type === 'entity.parse.failed') {
    return error(res, 'JSON inválido', 400);
  }

  // Error personalizado con status
  if (err.statusCode) {
    return error(res, err.message, err.statusCode);
  }

  // Error genérico
  return error(res, 'Error interno del servidor', 500);
};

module.exports = errorHandler;