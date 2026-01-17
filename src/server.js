// src/server.js
import 'dotenv/config';
import fs from 'fs';
import app from './app.js';
import { connectDatabase, sequelize } from './shared/utils/database.js';
import logger from './shared/utils/logger.js';

const PORT = process.env.PORT || 4000;

// Función para inicializar el servidor
const initializeServer = async () => {
  try {
    logger.info('🔄 Intentando conectar a la base de datos...');

    // Conectar a la base de datos (con timeout y fallback)
    try {
      await Promise.race([
        connectDatabase(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB connection timeout')), 15000)
        )
      ]);
    } catch (dbError) {
      console.warn('⚠️ Advertencia: No se pudo conectar a la base de datos inicialmente:', dbError.message);
      console.warn('⚠️ El servidor continuará iniciándose. La BD puede estar disponible en breve.');
    }

    // Crear directorio de logs si no existe
    const logsDir = 'logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Iniciar servidor
    const server = app.listen(PORT, async () => {
      logger.info(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      logger.info(`📊 Entorno: ${process.env.NODE_ENV}`);
      logger.info(`🔗 URL: http://localhost:${PORT}`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/health`);

      // Iniciar Scheduler de Visitas
      try {
        const { default: visitasScheduler } = await import('./modules/visitas/jobs/visitasScheduler.js');
        visitasScheduler.iniciar();
      } catch (schedulerError) {
        console.error('❌ Error iniciando scheduler de visitas:', schedulerError);
      }
    });

    // Manejo de errores del servidor
    server.on('error', (error) => {
      console.error('Error del servidor:', error);
    });

    // Manejo de cierre graceful
    const gracefulShutdown = () => {
      logger.info('Señal de terminación recibida, cerrando servidor...');
      server.close(async () => {
        try {
          await sequelize.close();
          logger.info('Conexión a la base de datos cerrada');
          logger.info('Servidor cerrado correctamente');
          process.exit(0);
        } catch (error) {
          console.error('Error al cerrar conexiones:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    return server;
  } catch (error) {
    console.error('❌ Error al inicializar el servidor:', error);
    process.exit(1);
  }
};

// Inicializar servidor
initializeServer();