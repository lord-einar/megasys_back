import { describe, expect, it } from '@jest/globals';
import {
  comprasPuedeAsignarEquipo,
  debeCrearBorradorCompras,
  esCompraPendiente,
  pendienteDeEntrega,
  puedeGenerarRemito
} from '../../../modules/solicitudesAsignacion/services/solicitudAsignacionPolicy.js';

describe('solicitudAsignacionPolicy', () => {
  it.each(['pendiente_infra', 'pendiente_rrhh', 'aprobada'])(
    'permite a Compras asignar celulares en estado %s sin exigir compra pendiente',
    (estado) => {
      expect(comprasPuedeAsignarEquipo({
        estado,
        tipo_equipo: 'celular',
        compra_pendiente: false,
        inventario_asignado_id: null,
        remito_id: null
      })).toBe(true);
    }
  );

  it('admite temporalmente el estado legado pendiente_compra', () => {
    const solicitud = {
      estado: 'pendiente_compra',
      tipo_equipo: 'celular',
      compra_pendiente: false,
      inventario_asignado_id: null,
      remito_id: null
    };

    expect(esCompraPendiente(solicitud)).toBe(true);
    expect(comprasPuedeAsignarEquipo(solicitud)).toBe(true);
  });

  it('no permite a Compras asignar notebooks o PC', () => {
    expect(comprasPuedeAsignarEquipo({
      estado: 'pendiente_infra',
      tipo_equipo: 'notebook',
      inventario_asignado_id: null,
      remito_id: null
    })).toBe(false);

    expect(comprasPuedeAsignarEquipo({
      estado: 'pendiente_rrhh',
      tipo_equipo: 'pc_escritorio',
      inventario_asignado_id: null,
      remito_id: null
    })).toBe(false);
  });

  it('no permite asignar celulares cerrados o ya fijados', () => {
    // Con equipo ya asignado: no se puede reasignar.
    expect(comprasPuedeAsignarEquipo({
      estado: 'pendiente_infra',
      tipo_equipo: 'celular',
      inventario_asignado_id: 'inventario-1',
      remito_id: null
    })).toBe(false);

    // Con remito ya generado: fijada.
    expect(comprasPuedeAsignarEquipo({
      estado: 'aprobada',
      tipo_equipo: 'celular',
      inventario_asignado_id: null,
      remito_id: 'remito-1'
    })).toBe(false);

    // Estado terminal.
    expect(comprasPuedeAsignarEquipo({
      estado: 'cancelada',
      tipo_equipo: 'celular',
      inventario_asignado_id: null,
      remito_id: null
    })).toBe(false);
  });

  it('crea borrador solo con aprobaciones completas y equipo asignado por Compras', () => {
    const base = {
      estado: 'aprobada',
      equipo_asignado_por_compras: true,
      inventario_asignado_id: 'inventario-1',
      remito_id: null
    };

    expect(debeCrearBorradorCompras(base)).toBe(true);
    expect(debeCrearBorradorCompras({ ...base, estado: 'pendiente_rrhh' })).toBe(false);
    expect(debeCrearBorradorCompras({ ...base, equipo_asignado_por_compras: false })).toBe(false);
    expect(debeCrearBorradorCompras({ ...base, inventario_asignado_id: null })).toBe(false);
    expect(debeCrearBorradorCompras({ ...base, remito_id: 'remito-1' })).toBe(false);
  });

  it('espera las aprobaciones cuando Compras asigna primero', () => {
    const solicitud = {
      estado: 'pendiente_infra',
      equipo_asignado_por_compras: true,
      inventario_asignado_id: 'inventario-1',
      remito_id: null
    };

    expect(debeCrearBorradorCompras(solicitud)).toBe(false);
    solicitud.estado = 'pendiente_rrhh';
    expect(debeCrearBorradorCompras(solicitud)).toBe(false);
    solicitud.estado = 'aprobada';
    expect(debeCrearBorradorCompras(solicitud)).toBe(true);
  });

  it('marca pendiente de entrega con la solicitud aprobada y el equipo asignado', () => {
    const base = { estado: 'aprobada', inventario_asignado_id: 'inventario-1' };

    expect(pendienteDeEntrega(base)).toBe(true);
    // El borrador automático de Compras tampoco está entregado todavía.
    expect(pendienteDeEntrega({ ...base, estado: 'remito_generado' })).toBe(true);
    // Sin equipo asignado no hay nada que entregar.
    expect(pendienteDeEntrega({ ...base, inventario_asignado_id: null })).toBe(false);
    // Aprobaciones incompletas o ya entregada.
    expect(pendienteDeEntrega({ ...base, estado: 'pendiente_rrhh' })).toBe(false);
    expect(pendienteDeEntrega({ ...base, estado: 'finalizada' })).toBe(false);
  });

  it('permite generar el remito antes o después de la entrega, y solo una vez', () => {
    const base = { estado: 'aprobada', inventario_asignado_id: 'inventario-1', remito_id: null };

    expect(puedeGenerarRemito(base)).toBe(true);
    // La entrega va primero: con la solicitud finalizada el remito sigue pendiente.
    expect(puedeGenerarRemito({ ...base, estado: 'finalizada' })).toBe(true);
    // Ya tiene remito.
    expect(puedeGenerarRemito({ ...base, remito_id: 'remito-1' })).toBe(false);
    expect(puedeGenerarRemito({ ...base, estado: 'remito_generado', remito_id: 'remito-1' })).toBe(false);
    // Sin equipo asignado o sin aprobar.
    expect(puedeGenerarRemito({ ...base, inventario_asignado_id: null })).toBe(false);
    expect(puedeGenerarRemito({ ...base, estado: 'pendiente_rrhh' })).toBe(false);
    expect(puedeGenerarRemito({ ...base, estado: 'cancelada' })).toBe(false);
  });

});
