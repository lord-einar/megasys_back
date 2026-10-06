// src/__tests__/setup/testSetup.js
import { jest, afterEach } from '@jest/globals';

// Exponer jest globalmente para los tests
global.jest = jest;

// Configurar timezone para tests consistentes
process.env.TZ = 'UTC';

// Algunos módulos importan modelos o database.js directamente (sin pasar por el
// mock de models/index.js). Sequelize exige un dialecto al instanciarse, pero no
// se conecta hasta la primera consulta. Se fuerza un puerto cerrado: si algún
// test olvida un mock, la conexión falla al instante y nunca llega a una BD real.
process.env.DB_DIALECT = 'postgres';
process.env.DB_NAME = 'tests_sin_bd';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_USER = 'tests';
process.env.DB_PASSWORD = 'tests';

// Timeout global para tests (30 segundos)
jest.setTimeout(30000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
