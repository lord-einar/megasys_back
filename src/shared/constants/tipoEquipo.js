// Helpers para relacionar el tipo_equipo lógico (celular / notebook / pc_escritorio)
// de las solicitudes con el nombre del TipoArticulo en inventario.

// tipo_equipo -> nombre del TipoArticulo (para búsquedas iLike).
export const TIPO_EQUIPO_TO_TIPO_ARTICULO = {
  celular: 'Celular',
  notebook: 'Notebook',
  pc_escritorio: 'PC'
};

export const TIPOS_EQUIPO = Object.keys(TIPO_EQUIPO_TO_TIPO_ARTICULO);

/**
 * Indica si el nombre de un TipoArticulo corresponde al tipo_equipo lógico.
 * @param {string} tipoEquipo - 'celular' | 'notebook' | 'pc_escritorio'
 * @param {string} nombreTipoArticulo - nombre del TipoArticulo (ej: "Celular", "Notebook", "PC")
 */
export function tipoArticuloCoincide(tipoEquipo, nombreTipoArticulo) {
  const nombre = (nombreTipoArticulo || '').toLowerCase().trim();
  switch (tipoEquipo) {
    case 'celular':
      return nombre.includes('cel');
    case 'notebook':
      return nombre.includes('notebook');
    case 'pc_escritorio':
      // El TipoArticulo de escritorio se llama exactamente "PC".
      return nombre === 'pc';
    default:
      return false;
  }
}

/** Etiqueta legible del tipo de equipo. */
export function etiquetaTipoEquipo(tipoEquipo) {
  switch (tipoEquipo) {
    case 'celular': return 'Celular';
    case 'notebook': return 'Notebook';
    case 'pc_escritorio': return 'PC de escritorio';
    default: return tipoEquipo || '';
  }
}
