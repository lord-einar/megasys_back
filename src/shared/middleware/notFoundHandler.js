// src/shared/middleware/notFoundHandler.js
const { error } = require('../utils/response');

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res, next) => {
  error(res, `Ruta ${req.originalUrl} no encontrada`, 404);
};

module.exports = notFoundHandler;
