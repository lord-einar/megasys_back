// src/__tests__/setup/testSetup.js
// Configuración global para tests

// Mock de logger para evitar logs durante tests
jest.mock('../../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Configurar timezone para tests consistentes
process.env.TZ = 'UTC';

// Timeout global para tests (30 segundos)
jest.setTimeout(30000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
