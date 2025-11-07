// src/app.js - CORREGIDO
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = require('./shared/utils/logger');
const errorHandler = require('./shared/middleware/errorHandler');
const notFoundHandler = require('./shared/middleware/notFoundHandler');
const { generalLimiter, authLimiter } = require('./shared/middleware/rateLimiter');

const app = express();

// Confiar en el proxy (necesario para Azure, Nginx, etc.)
app.set('trust proxy', true);

// Configuración de CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Middlewares globales
app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors(corsOptions));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - más permisivo para autenticación
app.use('/api/auth/', authLimiter);
// Rate limiting general para otras rutas
app.use('/api/', generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Servir archivos estáticos (PDFs generados)
const storageRemitosPath = path.join(__dirname, '..', 'storage', 'remitos');
const storageConfirmacionesPath = path.join(__dirname, '..', 'storage', 'confirmaciones');

// Asegurar que los directorios existan
[storageRemitosPath, storageConfirmacionesPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Directorio de almacenamiento creado: ${dir}`);
  }
});

// Servir PDFs de remitos
app.use('/storage/remitos', express.static(storageRemitosPath));

// Servir PDFs de confirmaciones
app.use('/storage/confirmaciones', express.static(storageConfirmacionesPath));

logger.info('✅ Almacenamiento de archivos estáticos configurado');

// Función para cargar rutas de forma segura
const loadRoutes = (routePath, mountPath) => {
  try {
    logger.info(`🔄 Cargando rutas: ${routePath} -> ${mountPath}`);
    const routes = require(routePath);
    app.use(mountPath, routes);
    logger.info(`✅ Rutas cargadas exitosamente: ${mountPath}`);
  } catch (error) {
    logger.error(`❌ Error cargando rutas ${routePath}:`, {
      error: error.message,
      stack: error.stack
    });
    
    // Crear una ruta de fallback que responda con el error
    app.use(mountPath, (req, res) => {
      res.status(500).json({
        success: false,
        message: `Módulo ${mountPath} no disponible`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }
};

// Cargar todas las rutas de la API
logger.info('🚀 Iniciando carga de rutas...');

// Rutas de autenticación (CRÍTICAS)
loadRoutes('./modules/auth/routes', '/api/auth');

// Rutas de empresas
loadRoutes('./modules/empresas/routes', '/api/empresas');

// Rutas de roles
loadRoutes('./modules/roles/routes', '/api/roles');

// Rutas de personal
loadRoutes('./modules/personal/routes', '/api/personal');

// Rutas de inventario (ANTES que sedes para que /:id/estado no colisione)
loadRoutes('./modules/inventario/routes', '/api/inventario');

// Rutas de sedes
loadRoutes('./modules/sedes/routes', '/api/sedes');

// Rutas de tipos de artículos
loadRoutes('./modules/inventario/routes/tipoArticuloRoutes', '/api/tipo-articulo');

// Rutas de remitos
loadRoutes('./modules/remitos/routes', '/api/remitos');

// Rutas de proveedores
loadRoutes('./modules/proveedores/routes', '/api/proveedores');

logger.info('✅ Todas las rutas han sido procesadas');

// Test endpoint para verificar que la app funciona
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});


// Middleware de manejo de errores (debe ir al final)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;