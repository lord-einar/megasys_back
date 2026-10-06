import { describe, expect, it } from '@jest/globals';
import { CREATION_STATES, validarTransicionManual } from '../../shared/constants/inventoryStates.js';

describe('validarTransicionManual', () => {
  it.each([
    ['disponible', 'mantenimiento'],
    ['disponible', 'producto_proveedor'],
    ['en_uso', 'disponible'],
    ['en_prestamo', 'disponible'],
    ['mantenimiento', 'en_uso'],
    ['producto_proveedor', 'dado_de_baja']
  ])('permite %s -> %s', (de, a) => {
    expect(validarTransicionManual(de, a)).toBeNull();
  });

  it('no permite asignar "en_prestamo" a mano', () => {
    expect(validarTransicionManual('disponible', 'en_prestamo')).toMatch(/remito de préstamo/);
  });

  it('dado de baja es definitivo', () => {
    expect(validarTransicionManual('dado_de_baja', 'disponible')).toMatch(/dado de baja/);
  });

  it('rechaza el mismo estado y estados inexistentes', () => {
    expect(validarTransicionManual('disponible', 'disponible')).toMatch(/igual al actual/);
    expect(validarTransicionManual('disponible', 'perdido')).toMatch(/no es válido/);
  });

  it('rechaza transiciones fuera de la matriz', () => {
    expect(validarTransicionManual('en_uso', 'producto_proveedor')).toMatch(/No se puede pasar/);
  });
});

describe('CREATION_STATES', () => {
  it('no permite dar de alta un artículo en préstamo', () => {
    expect(CREATION_STATES).not.toContain('en_prestamo');
    expect(CREATION_STATES).toContain('disponible');
  });
});
