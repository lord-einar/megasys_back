// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules: obtener __dirname equivalente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

import logger from './shared/utils/logger.js';
import errorHandler from './shared/middleware/errorHandler.js';
import notFoundHandler from './shared/middleware/notFoundHandler.js';
import { generalLimiter, authLimiter } from './shared/middleware/rateLimiter.js';

const app = express();

// Confiar en el proxy (necesario para Azure, Nginx, etc.)
app.set('trust proxy', true);

// Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);

    // En desarrollo, permitir cualquier localhost
    if (process.env.NODE_ENV !== 'production') {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:4173'
      ];
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
    }

    // En producción, usar lista de orígenes permitidos (separados por coma)
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map(o => o.trim());

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('Origen bloqueado por CORS:', { origin, allowedOrigins });
    callback(new Error('Not allowed by CORS'));
  },
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

// Nota: Los PDFs ahora se almacenan en Cloudflare R2, no localmente
// Las rutas /storage/* ya no se sirven desde el servidor
// Los PDFs se acceden directamente desde R2 via URLs públicas
logger.info('✅ Storage configurado: PDFs en Cloudflare R2');

// Función para cargar rutas de forma segura (async para ES Modules)
const loadRoutes = async (routePath, mountPath) => {
  try {
    logger.info(`🔄 Cargando rutas: ${routePath} -> ${mountPath}`);
    const routeModule = await import(routePath);
    const routes = routeModule.default || routeModule;
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

// Cargar todas las rutas de la API (async)
const initializeRoutes = async () => {
  logger.info('🚀 Iniciando carga de rutas...');

  // Rutas de autenticación (CRÍTICAS)
  await loadRoutes('./modules/auth/routes/index.js', '/api/auth');

  // Rutas de empresas
  await loadRoutes('./modules/empresas/routes/index.js', '/api/empresas');

  // Rutas de roles
  await loadRoutes('./modules/roles/routes/index.js', '/api/roles');

  // Rutas de personal
  await loadRoutes('./modules/personal/routes/index.js', '/api/personal');

  // Rutas de inventario (ANTES que sedes para que /:id/estado no colisione)
  await loadRoutes('./modules/inventario/routes/index.js', '/api/inventario');

  // Rutas de sedes
  await loadRoutes('./modules/sedes/routes/index.js', '/api/sedes');

  // Rutas de tipos de artículos
  await loadRoutes('./modules/inventario/routes/tipoArticuloRoutes.js', '/api/tipo-articulo');

  // Rutas de remitos
  await loadRoutes('./modules/remitos/routes/index.js', '/api/remitos');

  // Rutas de proveedores
  await loadRoutes('./modules/proveedores/routes/index.js', '/api/proveedores');

  // IMPORTANTE: Cargar rutas específicas ANTES de la ruta general de visitas
  // para evitar que /:id capture estas rutas como parámetros

  // Rutas de checklist items de visitas (ANTES de /api/visitas)
  await loadRoutes('./modules/visitas/routes/checklistItemRoutes.js', '/api/visitas/checklist-items');

  // Rutas de categorías de problemas de visitas (ANTES de /api/visitas)
  await loadRoutes('./modules/visitas/routes/categoriaProblemaRoutes.js', '/api/visitas/categorias-problemas');

  // Rutas de visitas (DESPUÉS de las rutas específicas)
  await loadRoutes('./modules/visitas/routes/index.js', '/api/visitas');

  logger.info('✅ Todas las rutas han sido procesadas');
};

// Inicializar rutas
await initializeRoutes();

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

export default app;