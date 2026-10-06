/**
 * Constantes para estados de inventario
 * Centraliza los estados disponibles para artículos en inventario
 * Cumple con Open/Closed Principle: agregar nuevos estados sin modificar código existente
 */

export const INVENTORY_STATES = {
  DISPONIBLE: 'disponible',
  EN_USO: 'en_uso',
  EN_PRESTAMO: 'en_prestamo',
  MANTENIMIENTO: 'mantenimiento',
  DADO_DE_BAJA: 'dado_de_baja',
  PRODUCTO_PROVEEDOR: 'producto_proveedor'
};

// Array de valores válidos para validación
export const VALID_STATES = Object.values(INVENTORY_STATES);

// Descripciones legibles para la UI
export const STATE_DESCRIPTIONS = {
  [INVENTORY_STATES.DISPONIBLE]: 'El artículo está disponible para usar',
  [INVENTORY_STATES.EN_USO]: 'El artículo se encuentra en uso actualmente',
  [INVENTORY_STATES.EN_PRESTAMO]: 'El artículo está siendo prestado',
  [INVENTORY_STATES.MANTENIMIENTO]: 'El artículo está en mantenimiento',
  [INVENTORY_STATES.DADO_DE_BAJA]: 'El artículo ha sido dado de baja',
  [INVENTORY_STATES.PRODUCTO_PROVEEDOR]: 'Producto perteneciente a un proveedor'
};

// Transiciones permitidas al cambiar el estado a mano (PATCH /inventario/:id/estado).
// "en_prestamo" no figura como destino: solo lo asigna un remito de préstamo.
export const STATE_TRANSITIONS = {
  [INVENTORY_STATES.DISPONIBLE]: [
    INVENTORY_STATES.EN_USO,
    INVENTORY_STATES.MANTENIMIENTO,
    INVENTORY_STATES.DADO_DE_BAJA,
    INVENTORY_STATES.PRODUCTO_PROVEEDOR
  ],
  [INVENTORY_STATES.EN_USO]: [
    INVENTORY_STATES.DISPONIBLE,
    INVENTORY_STATES.MANTENIMIENTO,
    INVENTORY_STATES.DADO_DE_BAJA
  ],
  [INVENTORY_STATES.EN_PRESTAMO]: [
    INVENTORY_STATES.DISPONIBLE,
    INVENTORY_STATES.MANTENIMIENTO,
    INVENTORY_STATES.DADO_DE_BAJA
  ],
  [INVENTORY_STATES.MANTENIMIENTO]: [
    INVENTORY_STATES.DISPONIBLE,
    INVENTORY_STATES.EN_USO,
    INVENTORY_STATES.DADO_DE_BAJA
  ],
  [INVENTORY_STATES.DADO_DE_BAJA]: [], // No se puede salir de este estado
  [INVENTORY_STATES.PRODUCTO_PROVEEDOR]: [
    INVENTORY_STATES.DISPONIBLE,
    INVENTORY_STATES.EN_USO,
    INVENTORY_STATES.DADO_DE_BAJA
  ]
};

// Estados con los que se puede dar de alta un artículo. "en_prestamo" solo lo
// asigna un remito (los celulares/notebooks tampoco nacen "en_uso": lo pone la asignación).
export const CREATION_STATES = VALID_STATES.filter(e => e !== INVENTORY_STATES.EN_PRESTAMO);

/**
 * Valida un cambio manual de estado.
 * @returns {string|null} motivo del rechazo, o null si la transición es válida
 */
export function validarTransicionManual(estadoActual, nuevoEstado) {
  if (!VALID_STATES.includes(nuevoEstado)) return `Estado "${nuevoEstado}" no es válido`;
  if (nuevoEstado === estadoActual) return 'El nuevo estado es igual al actual';
  if (nuevoEstado === INVENTORY_STATES.EN_PRESTAMO) {
    return 'El estado "en préstamo" se asigna creando un remito de préstamo';
  }
  if (estadoActual === INVENTORY_STATES.DADO_DE_BAJA) {
    return 'Un artículo dado de baja no puede cambiar de estado';
  }
  const permitidos = STATE_TRANSITIONS[estadoActual] || [];
  if (!permitidos.includes(nuevoEstado)) {
    return `No se puede pasar de "${estadoActual}" a "${nuevoEstado}". Permitidos: ${permitidos.join(', ')}`;
  }
  return null;
}
