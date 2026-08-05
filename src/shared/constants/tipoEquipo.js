// Helpers para relacionar el tipo_equipo lógico (celular / notebook / pc_escritorio)
// de las solicitudes con el nombre del TipoArticulo en inventario.

// tipo_equipo -> nombre del TipoArticulo (para búsquedas iLike).
export const TIPO_EQUIPO_TO_TIPO_ARTICULO = {
  celular: 'Celular',
  notebook: 'Notebook',
  pc_escritorio: 'PC'
};

export const TIPOS_EQUIPO = Object.keys(TIPO_EQUIPO_TO_TIPO_ARTICULO);

// tipo_equipo de la solicitud -> tipo de CategoriaEquipo. Difieren sólo en la PC:
// la solicitud la llama 'pc_escritorio' y la categoría 'pc'.
export const TIPO_EQUIPO_TO_CATEGORIA_TIPO = {
  celular: 'celular',
  notebook: 'notebook',
  pc_escritorio: 'pc'
};

// Categoría que aplica a todos los tipos de equipo. El valor del enum quedó como
// 'ambos' de cuando había sólo dos tipos; en la UI se muestra como "Todos los tipos".
export const CATEGORIA_TIPO_TODOS = 'ambos';

export const CATEGORIA_TIPOS = ['notebook', 'celular', 'pc', CATEGORIA_TIPO_TODOS];

/**
 * Normaliza un tipo recibido por API al tipo de categoría. Acepta tanto los
 * valores propios de la categoría ('pc') como los de la solicitud ('pc_escritorio').
 * @returns {string|null} tipo de categoría, o null si no corresponde a ninguno.
 */
export function normalizarTipoCategoria(tipo) {
  if (!tipo) return null;
  if (CATEGORIA_TIPOS.includes(tipo)) return tipo;
  return TIPO_EQUIPO_TO_CATEGORIA_TIPO[tipo] || null;
}

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
