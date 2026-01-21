// src/__tests__/setup/testSetup.js
import { jest, afterEach } from '@jest/globals';

// Exponer jest globalmente para los tests
global.jest = jest;

// Configurar timezone para tests consistentes
process.env.TZ = 'UTC';

// Timeout global para tests (30 segundos)
jest.setTimeout(30000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
