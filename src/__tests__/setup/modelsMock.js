// src/__tests__/setup/modelsMock.js
// Los tests mockean models/index.js con solo los modelos que usan. Si un
// servicio importa un modelo que el mock no define, ESM falla con
// "does not provide an export named X" y la suite entera no corre.
// conTodosLosModelos() completa el mock con un stub para cada export real,
// leyendo la lista desde models/index.js para que no se desactualice.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { jest } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.resolve(__dirname, '../../models/index.js'), 'utf8');

// Bloque "export { ... };" de named exports al final de models/index.js
const bloqueExports = indexSource.match(/export\s*\{([^}]*)\};?\s*$/);
export const NOMBRES_MODELOS = bloqueExports
  ? bloqueExports[1].split(',').map(n => n.trim()).filter(Boolean)
  : [];

// Stub para los modelos que el test no define: responde "vacío" (sin filas)
const crearStubModelo = () => ({
  findAll: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(() => Promise.resolve(null)),
  findByPk: jest.fn(() => Promise.resolve(null)),
  findAndCountAll: jest.fn(() => Promise.resolve({ count: 0, rows: [] })),
  findOrCreate: jest.fn(() => Promise.resolve([null, false])),
  create: jest.fn(() => Promise.resolve({})),
  bulkCreate: jest.fn(() => Promise.resolve([])),
  update: jest.fn(() => Promise.resolve([0])),
  destroy: jest.fn(() => Promise.resolve(0)),
  count: jest.fn(() => Promise.resolve(0)),
  addHook: jest.fn()
});

/**
 * Devuelve un mock de models/index.js con todos los exports reales.
 * @param {Object} modelos - modelos definidos por el test (tienen prioridad)
 */
export function conTodosLosModelos(modelos = {}) {
  const base = Object.fromEntries(NOMBRES_MODELOS.map(nombre => [nombre, crearStubModelo()]));
  return { ...base, default: { ...base, ...modelos }, ...modelos };
}
