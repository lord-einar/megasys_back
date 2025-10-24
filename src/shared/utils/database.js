// src/shared/utils/database.js
const { Sequelize } = require('sequelize');
const logger = require('./logger');

const sequelize = new Sequelize({
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
    acquire: 30000,
    idle: 10000
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
const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conexión a la base de datos establecida correctamente');

    // Importar modelos
    require('../../models');

    // Sync deshabilitado temporalmente - hay conflictos de esquema entre modelos y migraciones
    // TODO: Crear migraciones para actualizar el esquema de INTEGER a UUID
    if (process.env.NODE_ENV === 'development' && process.env.FORCE_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      logger.info('✅ Modelos sincronizados con la base de datos');
    } else if (process.env.NODE_ENV === 'development') {
      logger.info('⚠️  Sync deshabilitado. Use FORCE_SYNC=true para sincronizar forzadamente.');
    }
  } catch (error) {
    logger.error('❌ Error al conectar con la base de datos:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDatabase
};
