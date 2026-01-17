// src/shared/middleware/notFoundHandler.js
import { error } from '../utils/response.js';

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res, next) => {
  error(res, `Ruta ${req.originalUrl} no encontrada`, 404);
};

export default notFoundHandler;
