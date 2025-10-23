// src/server.js
require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./shared/utils/database');

const PORT = process.env.PORT || 4000;

console.log('🔍 Verificando configuración de BD:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_DIALECT:', process.env.DB_DIALECT);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);


// Función para inicializar el servidor
const initializeServer = async () => {
  try {
    console.log('🔄 Intentando conectar a la base de datos...');
    
    // Conectar a la base de datos
    await connectDatabase();
    
    // Crear directorio de logs si no existe
    const fs = require('fs');
    const logsDir = 'logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      console.log(`📊 Entorno: ${process.env.NODE_ENV}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });

    // Manejo de errores del servidor
    server.on('error', (error) => {
      console.error('Error del servidor:', error);
    });

    // Manejo de cierre graceful
    const gracefulShutdown = () => {
      console.log('Señal de terminación recibida, cerrando servidor...');
      server.close(async () => {
        try {
          await require('./shared/utils/database').sequelize.close();
          console.log('Conexión a la base de datos cerrada');
          console.log('Servidor cerrado correctamente');
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