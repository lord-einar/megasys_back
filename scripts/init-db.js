const { sequelize } = require('../src/shared/utils/database');
require('../src/models');

async function initDatabase() {
  try {
    // Sincronizar todas los modelos con la BD
    await sequelize.sync({ force: true });
    console.log('✅ Base de datos sincronizada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sincronizando base de datos:', error);
    process.exit(1);
  }
}

initDatabase();
