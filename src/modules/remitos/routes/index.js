// src/modules/remitos/routes/index.js
import express from 'express';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requireDatabaseRole, requireRole, requireLegacyAccess } from '../../auth/middleware/roleMiddleware.js';
import { publicEndpointLimiter } from '../../../shared/middleware/rateLimiter.js';
import remitoController from '../controllers/remitoController.js';

const router = express.Router();

// =====================================================
// RUTAS PÚBLICAS (Sin autenticación)
// =====================================================

/**
 * GET /remitos/:id/confirmar-recepcion
 * Confirmar recepción del remito mediante token JWT (vía GET para enlaces en emails)
 * No requiere autenticación - usa token JWT como parámetro
 * Query: ?token=JWT_TOKEN
 */
router.get(
  '/:id/confirmar-recepcion',
  publicEndpointLimiter,
  remitoController.confirmarRecepcion.bind(remitoController)
);

/**
 * POST /remitos/:id/confirmar-recepcion
 * Confirmar recepción del remito mediante token JWT (POST para programmatic access)
 * No requiere autenticación - usa token JWT como parámetro
 * Query: ?token=JWT_TOKEN
 * Rate limit: 20 requests por IP cada 15 minutos
 */
router.post(
  '/:id/confirmar-recepcion',
  publicEndpointLimiter,
  remitoController.confirmarRecepcion.bind(remitoController)
);

// Todas las rutas de remitos requieren autenticación
router.use(authenticate);
router.use(requireLegacyAccess);

// =====================================================
// RUTAS DE REMITOS
// =====================================================

/**
 * GET /remitos
 * Listar remitos con filtros y paginación
 * Acceso: Todos los usuarios autenticados
 */
router.get('/', remitoController.listar.bind(remitoController));

/**
 * GET /remitos/articulos-disponibles
 * Obtener artículos disponibles para agregar a un remito
 * Filtra por tipo_articulo_id, sede_id, con paginación (page, limit)
 * Acceso: Todos los usuarios autenticados
 */
router.get('/articulos-disponibles', remitoController.obtenerArticulosDisponibles.bind(remitoController));

/**
 * GET /remitos/prestamos/resumen
 * Obtener resumen de estado de préstamos
 * Retorna: proximosAVencer, vencidos, totalActivos, alerta
 * Acceso: Todos los usuarios autenticados
 */
router.get('/prestamos/resumen', remitoController.obtenerResumenPrestamos.bind(remitoController));

/**
 * GET /remitos/prestamos/proximos-a-vencer
 * Obtener préstamos próximos a vencer
 * Query params: dias (default: 7)
 * Acceso: Todos los usuarios autenticados
 */
router.get('/prestamos/proximos-a-vencer', remitoController.obtenerPrestamosProximosAVencer.bind(remitoController));

/**
 * GET /remitos/prestamos/vencidos
 * Obtener préstamos vencidos (pasada la fecha de devolución)
 * Acceso: Todos los usuarios autenticados
 */
router.get('/prestamos/vencidos', remitoController.obtenerPrestamosVencidos.bind(remitoController));

/**
 * POST /remitos
 * Crear nuevo remito
 * Requiere: Autenticación (cualquier usuario autenticado puede crear remitos)
 * La validación de rol se hace a nivel de datos (solicitante y técnico deben existir)
 */
router.post(
  '/',
  remitoController.crear.bind(remitoController)
);

/**
 * GET /remitos/:id
 * Obtener remito con detalles completos
 * Acceso: Todos los usuarios autenticados
 */
router.get('/:id', remitoController.obtener.bind(remitoController));

/**
 * PUT /remitos/:id
 * Actualizar campos básicos del remito (super_admin, mientras no esté completado/cancelado)
 */
router.put(
  '/:id',
  requireRole('super_admin'),
  remitoController.actualizar.bind(remitoController)
);

/**
 * POST /remitos/:id/detalles
 * Agregar artículo al remito (solo en estado preparado)
 */
router.post(
  '/:id/detalles',
  requireRole('super_admin'),
  remitoController.agregarDetalle.bind(remitoController)
);

/**
 * DELETE /remitos/:id/detalles/:detalleId
 * Quitar artículo del remito (solo en estado preparado)
 */
router.delete(
  '/:id/detalles/:detalleId',
  requireRole('super_admin'),
  remitoController.quitarDetalle.bind(remitoController)
);

/**
 * PATCH /remitos/:id/estado
 * Cambiar estado del remito
 * Requiere: Rol "Infraestructura" O ser el técnico asignado al remito
 * Mínimo: rol "support" (Soporte/Infraestructura) — la validación fina ocurre en el servicio
 */
router.patch(
  '/:id/estado',
  requireRole('support'),
  remitoController.cambiarEstado.bind(remitoController)
);

/**
 * PATCH /remitos/:id/detalles/:detalleId/fecha-devolucion
 * Actualizar fecha de devolución esperada para un artículo préstamo
 * Requiere: Autenticación (usuario que creó el remito o rol Infraestructura)
 */
router.patch(
  '/:id/detalles/:detalleId/fecha-devolucion',
  remitoController.actualizarFechaDevolucion.bind(remitoController)
);

/**
 * POST /remitos/detalles/:detalleId/enviar-aviso-devolucion
 * Enviar aviso de devolución próxima para un préstamo (reminders para artículos venciendo en 1 día)
 * Requiere: Autenticación
 * Se llama desde dashboard cuando falta 1 día para la devolución
 */
router.post(
  '/detalles/:detalleId/enviar-aviso-devolucion',
  remitoController.enviarAvisoDevolucionProxima.bind(remitoController)
);

/**
 * POST /remitos/:id/devolver
 * Generar remito de devolución automático
 * Requiere: Grupo "Infraestructura" (Super_admin) O ser el técnico asignado al remito
 * Mínimo: rol "support" — la validación fina (super_admin o tecnico asignado) ocurre en el controller
 */
router.post(
  '/:id/devolver',
  requireRole('support'),
  remitoController.generarDevolucion.bind(remitoController)
);

/**
 * POST /remitos/:id/procesar-devolucion
 * Procesar devolución granular de préstamos
 * Para cada artículo se puede elegir: devolver o extender préstamo
 * Body: { items: [{ detalle_id, accion: 'devolver'|'extender', nueva_fecha?: 'YYYY-MM-DD' }] }
 * Requiere: Grupo "Infraestructura" (Super_admin) O ser el técnico asignado al remito
 * Mínimo: rol "support" — la validación fina (super_admin o tecnico asignado) ocurre en el controller
 */
router.post(
  '/:id/procesar-devolucion',
  requireRole('support'),
  remitoController.procesarDevolucion.bind(remitoController)
);

/**
 * POST /remitos/:id/reenviar-emails
 * Reenviar emails del remito (a infraestructura y solicitante)
 * Requiere: Autenticación
 * Util para reenviar emails en caso de que no se hayan entregado correctamente
 */
router.post(
  '/:id/reenviar-emails',
  remitoController.reenviarEmails.bind(remitoController)
);

/**
 * PATCH /remitos/:id/asignar-receptor
 * Asignar receptor alternativo para un remito en tránsito
 * Requiere: Grupo "Infraestructura" (super_admin)
 * Body: { receptor_nombre: string, receptor_email: string }
 */
router.patch(
  '/:id/asignar-receptor',
  requireRole('super_admin'),
  remitoController.asignarReceptor.bind(remitoController)
);

export default router;