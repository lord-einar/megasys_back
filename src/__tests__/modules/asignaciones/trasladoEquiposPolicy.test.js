import { describe, expect, it } from '@jest/globals';
import {
  evaluarRemitoActivo,
  planificarTraslado
} from '../../../modules/asignaciones/services/trasladoEquiposPolicy.js';
import { tipoEquipoPersonalDeArticulo } from '../../../shared/constants/tipoEquipo.js';

const SEDE_ORIGEN = 'sede-deposito';
const SEDE_VIEJA = 'sede-almagro';
const SEDE_NUEVA = 'sede-belgrano';

const remito = (overrides = {}) => ({
  id: 'r1',
  numero_remito: 'REM-2026-001',
  estado: 'preparado',
  sede_origen_id: SEDE_ORIGEN,
  sede_destino_id: SEDE_VIEJA,
  detalles: [{ inventario_id: 'cel-1' }],
  ...overrides
});

describe('tipoEquipoPersonalDeArticulo', () => {
  it.each([
    ['Celular', 'celular'],
    ['Notebook', 'notebook'],
    ['Notebooks', 'notebook'],
    ['PC', null],
    ['Monitor', null],
    [null, null]
  ])('"%s" -> %s', (nombre, esperado) => {
    expect(tipoEquipoPersonalDeArticulo(nombre)).toBe(esperado);
  });
});

describe('evaluarRemitoActivo', () => {
  it.each(['borrador', 'preparado'])('redirige un remito en estado %s', (estado) => {
    expect(evaluarRemitoActivo(remito({ estado }), ['cel-1'], SEDE_NUEVA)).toEqual({ accion: 'redirigir' });
  });

  it('bloquea un remito en tránsito', () => {
    const decision = evaluarRemitoActivo(remito({ estado: 'en_transito' }), ['cel-1'], SEDE_NUEVA);
    expect(decision.accion).toBe('bloquear');
    expect(decision.motivo).toMatch(/en tránsito/);
  });

  it('bloquea si el remito sale de la sede nueva', () => {
    const decision = evaluarRemitoActivo(remito({ sede_origen_id: SEDE_NUEVA }), ['cel-1'], SEDE_NUEVA);
    expect(decision.accion).toBe('bloquear');
    expect(decision.motivo).toMatch(/sale de la sede nueva/);
  });

  it('bloquea si el remito lleva equipos de otras personas', () => {
    const r = remito({ detalles: [{ inventario_id: 'cel-1' }, { inventario_id: 'monitor-9' }] });
    const decision = evaluarRemitoActivo(r, ['cel-1'], SEDE_NUEVA);
    expect(decision.accion).toBe('bloquear');
    expect(decision.motivo).toMatch(/no son de esta persona/);
  });

  it('redirige un remito con celular y notebook de la misma persona', () => {
    const r = remito({ detalles: [{ inventario_id: 'cel-1' }, { inventario_id: 'nb-1' }] });
    expect(evaluarRemitoActivo(r, ['cel-1', 'nb-1'], SEDE_NUEVA)).toEqual({ accion: 'redirigir' });
  });
});

describe('planificarTraslado', () => {
  it('mueve los equipos sin remito activo y deja los que ya están en la sede nueva', () => {
    const equipos = [
      { inventario_id: 'cel-1', sede_id: SEDE_VIEJA, remitosActivos: [] },
      { inventario_id: 'nb-1', sede_id: SEDE_NUEVA, remitosActivos: [] }
    ];
    const plan = planificarTraslado(equipos, SEDE_NUEVA);
    expect(plan.mover.map(e => e.inventario_id)).toEqual(['cel-1']);
    expect(plan.sinCambios.map(e => e.inventario_id)).toEqual(['nb-1']);
    expect(plan.bloqueos).toEqual([]);
  });

  it('redirige una sola vez un remito compartido por celular y notebook', () => {
    const r = remito({ detalles: [{ inventario_id: 'cel-1' }, { inventario_id: 'nb-1' }] });
    const equipos = [
      { inventario_id: 'cel-1', sede_id: SEDE_ORIGEN, remitosActivos: [r] },
      { inventario_id: 'nb-1', sede_id: SEDE_ORIGEN, remitosActivos: [r] }
    ];
    const plan = planificarTraslado(equipos, SEDE_NUEVA);
    expect(plan.redirigir).toHaveLength(1);
    expect(plan.mover).toEqual([]);
  });

  it('informa bloqueos sin mover nada del equipo bloqueado', () => {
    const equipos = [
      { inventario_id: 'cel-1', sede_id: SEDE_ORIGEN, remitosActivos: [remito({ estado: 'en_transito' })] },
      { inventario_id: 'nb-1', sede_id: SEDE_VIEJA, remitosActivos: [] }
    ];
    const plan = planificarTraslado(equipos, SEDE_NUEVA);
    expect(plan.bloqueos).toEqual([{ inventario_id: 'cel-1', motivo: expect.stringMatching(/en tránsito/) }]);
    expect(plan.mover.map(e => e.inventario_id)).toEqual(['nb-1']);
  });

  it('sin equipos asignados no hay nada que hacer', () => {
    expect(planificarTraslado([], SEDE_NUEVA)).toEqual({ mover: [], redirigir: [], sinCambios: [], bloqueos: [] });
  });
});
