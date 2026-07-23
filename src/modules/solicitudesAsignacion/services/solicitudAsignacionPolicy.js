const ESTADOS_PRE_REMITO = ['pendiente_infra', 'pendiente_rrhh', 'aprobada'];
const ESTADOS_ASIGNABLES_COMPRAS = ['pendiente_infra', 'pendiente_rrhh', 'pendiente_compra'];

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

export {
  ESTADOS_PRE_REMITO,
  ESTADOS_ASIGNABLES_COMPRAS,
  esCompraPendiente,
  comprasPuedeAsignarEquipo,
  debeCrearBorradorCompras
};
