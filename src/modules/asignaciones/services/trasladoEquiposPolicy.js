// src/modules/asignaciones/services/trasladoEquiposPolicy.js
// Reglas puras (sin acceso a BD) para trasladar los equipos personales
// (celular / notebook) cuando una persona cambia de sede.

// Remitos que todavía no salieron: se pueden redirigir a la sede nueva.
export const ESTADOS_REMITO_REDIRIGIBLES = ['borrador', 'preparado'];
// Remito en viaje: no se puede cambiar el destino, hay que esperar la entrega.
export const ESTADOS_REMITO_BLOQUEANTES = ['en_transito'];
export const ESTADOS_REMITO_ACTIVOS = [...ESTADOS_REMITO_REDIRIGIBLES, ...ESTADOS_REMITO_BLOQUEANTES];

/**
 * Decide qué hacer con un remito activo que lleva equipos de la persona.
 * @param {Object} remito - { numero_remito, estado, sede_origen_id, detalles: [{ inventario_id }] }
 * @param {string[]} inventarioIdsPersona - equipos personales asignados a la persona
 * @param {string} sedeNuevaId
 * @returns {{ accion: 'redirigir' } | { accion: 'bloquear', motivo: string }}
 */
export function evaluarRemitoActivo(remito, inventarioIdsPersona, sedeNuevaId) {
  if (ESTADOS_REMITO_BLOQUEANTES.includes(remito.estado)) {
    return {
      accion: 'bloquear',
      motivo: `El remito ${remito.numero_remito} está en tránsito. Esperá a que se entregue para cambiar la sede.`
    };
  }

  if (remito.sede_origen_id === sedeNuevaId) {
    return {
      accion: 'bloquear',
      motivo: `El remito ${remito.numero_remito} sale de la sede nueva. Cancelalo o ajustalo antes de cambiar la sede.`
    };
  }

  const llevaOtrosEquipos = (remito.detalles || [])
    .some(d => !inventarioIdsPersona.includes(d.inventario_id));
  if (llevaOtrosEquipos) {
    return {
      accion: 'bloquear',
      motivo: `El remito ${remito.numero_remito} también lleva equipos que no son de esta persona. Ajustalo antes de cambiar la sede.`
    };
  }

  return { accion: 'redirigir' };
}

/**
 * Arma el plan de traslado de los equipos personales de una persona.
 * @param {Object[]} equipos - [{ inventario_id, sede_id, remitosActivos: [remito] }]
 * @param {string} sedeNuevaId
 * @returns {{ mover: Object[], redirigir: Object[], sinCambios: Object[], bloqueos: Object[] }}
 *   redirigir contiene remitos únicos; bloqueos, { inventario_id, motivo }.
 */
export function planificarTraslado(equipos, sedeNuevaId) {
  const plan = { mover: [], redirigir: [], sinCambios: [], bloqueos: [] };
  const inventarioIds = equipos.map(e => e.inventario_id);
  const remitosRedirigidos = new Set();

  for (const equipo of equipos) {
    const remitos = equipo.remitosActivos || [];

    if (remitos.length === 0) {
      if (equipo.sede_id === sedeNuevaId) plan.sinCambios.push(equipo);
      else plan.mover.push(equipo);
      continue;
    }

    for (const remito of remitos) {
      const decision = evaluarRemitoActivo(remito, inventarioIds, sedeNuevaId);
      if (decision.accion === 'bloquear') {
        plan.bloqueos.push({ inventario_id: equipo.inventario_id, motivo: decision.motivo });
      } else if (!remitosRedirigidos.has(remito.id)) {
        remitosRedirigidos.add(remito.id);
        plan.redirigir.push(remito);
      }
    }
  }

  return plan;
}
