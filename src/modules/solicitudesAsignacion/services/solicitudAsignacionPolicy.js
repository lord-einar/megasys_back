const ESTADOS_PRE_REMITO = ['pendiente_infra', 'pendiente_rrhh', 'aprobada'];
// Compras puede asignar celulares mientras la solicitud no esté fijada; incluye
// 'aprobada' para el caso de compra pendiente (celular que entra tras las aprobaciones).
const ESTADOS_ASIGNABLES_COMPRAS = ['pendiente_infra', 'pendiente_rrhh', 'pendiente_compra', 'aprobada'];
// La entrega va antes que el remito: se puede generar con la solicitud aprobada
// o ya entregada (finalizada), mientras no exista remito.
const ESTADOS_GENERAR_REMITO = ['aprobada', 'finalizada'];

const esCompraPendiente = (solicitud) =>
  solicitud?.compra_pendiente === true || solicitud?.estado === 'pendiente_compra';

const comprasPuedeAsignarEquipo = (solicitud) =>
  !!solicitud &&
  solicitud.tipo_equipo === 'celular' &&
  !solicitud.inventario_asignado_id &&
  !solicitud.remito_id &&
  ESTADOS_ASIGNABLES_COMPRAS.includes(solicitud.estado);

const debeCrearBorradorCompras = (solicitud) =>
  !!solicitud &&
  solicitud.estado === 'aprobada' &&
  solicitud.equipo_asignado_por_compras === true &&
  !!solicitud.inventario_asignado_id &&
  !solicitud.remito_id;

// Aprobada + equipo asignado = lista para entregar. Incluye remito_generado
// (borrador automático de Compras) porque tampoco fue entregada todavía.
const pendienteDeEntrega = (solicitud) =>
  !!solicitud &&
  !!solicitud.inventario_asignado_id &&
  ['aprobada', 'remito_generado'].includes(solicitud.estado);

const puedeGenerarRemito = (solicitud) =>
  !!solicitud &&
  !!solicitud.inventario_asignado_id &&
  !solicitud.remito_id &&
  ESTADOS_GENERAR_REMITO.includes(solicitud.estado);

export {
  ESTADOS_PRE_REMITO,
  ESTADOS_ASIGNABLES_COMPRAS,
  ESTADOS_GENERAR_REMITO,
  esCompraPendiente,
  comprasPuedeAsignarEquipo,
  debeCrearBorradorCompras,
  pendienteDeEntrega,
  puedeGenerarRemito
};
