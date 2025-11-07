// src/shared/utils/runMigrations.js
const { execSync } = require('child_process');
const path = require('path');
const logger = require('./logger');

/**
 * Run Sequelize migrations with enhanced debugging
 */
const runMigrations = async () => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('⏭️  Migraciones deshabilitadas en ambiente no-producción');
    return;
  }

  try {
    logger.info('🔄 Iniciando migraciones de base de datos...');
    logger.debug('Ambiente:', process.env.NODE_ENV);
    logger.debug('Directorio actual:', process.cwd());
    logger.debug('Base de datos:', process.env.DB_NAME);
    logger.debug('Host BD:', process.env.DB_HOST);

    // Set environment variables explicitly for the child process
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PATH: process.env.PATH
    };

    logger.info('Ejecutando: npx sequelize-cli db:migrate');

    const result = execSync('npx sequelize-cli db:migrate', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    logger.info('✅ Migraciones ejecutadas exitosamente');

    if (result && result.trim()) {
      logger.debug('Salida de migraciones:');
      result.split('\n').forEach(line => {
        if (line.trim()) {
          logger.debug('  ' + line);
        }
      });
    }
  } catch (error) {
    logger.error('❌ Error al ejecutar migraciones:', error.message);

    if (error.stdout) {
      logger.error('STDOUT:', error.stdout.toString());
    }

    if (error.stderr) {
      logger.error('STDERR:', error.stderr.toString());
    }

    logger.warn('⚠️ El servidor continuará sin ejecutar migraciones. Intenta manualmente con: npx sequelize-cli db:migrate');
    // No hacer throw aquí para que el servidor continúe
  }
};

module.exports = { runMigrations };
