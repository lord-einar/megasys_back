// src/shared/utils/logger.js
const winston = require('winston');
const path = require('path');

// Configuración del logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'sistema-gestion-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Archivo para errores
    new winston.transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Archivo para todos los logs
    new winston.transports.File({ 
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// SIEMPRE mostrar en consola (Railway captura logs desde stdout/stderr)
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()  // JSON en producción para Railway
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            let output = `${timestamp} [${level}]: ${message}`;

            // Agregar información adicional si existe
            if (Object.keys(meta).length > 0) {
              output += `\n${JSON.stringify(meta, null, 2)}`;
            }

            return output;
          })
        )
  )
}));

// Manejo de excepciones no capturadas
logger.exceptions.handle(
  new winston.transports.File({ filename: path.join('logs', 'exceptions.log') })
);

// Manejo de rechazos de promesas no capturadas
logger.rejections.handle(
  new winston.transports.File({ filename: path.join('logs', 'rejections.log') })
);

module.exports = logger;