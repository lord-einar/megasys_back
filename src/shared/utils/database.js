// src/shared/utils/database.js
import { Sequelize } from 'sequelize';
import logger from './logger.js';
import { runMigrations } from './runMigrations.js';

export const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialect: process.env.DB_DIALECT,
  logging: process.env.NODE_ENV === 'development' ?
    (msg) => logger.debug(msg) : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 60000,
    idle: 10000
  },
  dialectOptions: {
    ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') ? { require: true, rejectUnauthorized: false } : false,
    connectTimeout: 60000
  },
  define: {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  }
});

/**
 * Función para conectar a la base de datos
 */
export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conexión a la base de datos establecida correctamente');

    // Importar modelos dinámicamente
    await import('../../models/index.js');

    // Ejecutar migraciones en production y staging
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
      await runMigrations();
    } else if (process.env.FORCE_SYNC === 'true') {
      // Sync en development si se especifica FORCE_SYNC
      await sequelize.sync({ alter: true });
      logger.info('✅ Modelos sincronizados con la base de datos');
    } else if (process.env.NODE_ENV === 'development') {
      logger.info('⚠️  Sync deshabilitado. Use FORCE_SYNC=true para sincronizar forzadamente.');
    }
  } catch (error) {
    logger.error('❌ Error al conectar con la base de datos:', error);
    logger.warn('⚠️ El servidor continuará sin BD. Intenta reconectar más adelante.');
    // NO hacer process.exit(1) para permitir que el servidor continúe
  }
};
