// src/shared/utils/asyncHandler.js
/**
 * Wrapper para manejar errores async/await automáticamente
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;