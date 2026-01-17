// src/shared/middleware/validation.js
import { validationResult } from 'express-validator';
import { error } from '../utils/response.js';

/**
 * Middleware para validar los resultados de express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    
    return error(res, 'Errores de validación', 400, formattedErrors);
  }
  
  next();
};

export default validate;