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
  DADO_DE_BAJA: 'dado_de_baja'
};

// Array de valores válidos para validación
export const VALID_STATES = Object.values(INVENTORY_STATES);

// Descripciones legibles para la UI
export const STATE_DESCRIPTIONS = {
  [INVENTORY_STATES.DISPONIBLE]: 'El artículo está disponible para usar',
  [INVENTORY_STATES.EN_USO]: 'El artículo se encuentra en uso actualmente',
  [INVENTORY_STATES.EN_PRESTAMO]: 'El artículo está siendo prestado',
  [INVENTORY_STATES.MANTENIMIENTO]: 'El artículo está en mantenimiento',
  [INVENTORY_STATES.DADO_DE_BAJA]: 'El artículo ha sido dado de baja'
};

// Transiciones permitidas entre estados (validación de lógica de negocio)
export const STATE_TRANSITIONS = {
  [INVENTORY_STATES.DISPONIBLE]: [
    INVENTORY_STATES.EN_USO,
    INVENTORY_STATES.EN_PRESTAMO,
    INVENTORY_STATES.MANTENIMIENTO,
    INVENTORY_STATES.DADO_DE_BAJA
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
    INVENTORY_STATES.DADO_DE_BAJA
  ],
  [INVENTORY_STATES.DADO_DE_BAJA]: [] // No se puede salir de este estado
};
