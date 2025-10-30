// src/modules/remitos/routes/index.js
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requireDatabaseRole } = require('../../auth/middleware/roleMiddleware');
const remitoController = require('../controllers/remitoController');

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
  remitoController.confirmarRecepcion.bind(remitoController)
);

/**
 * POST /remitos/:id/confirmar-recepcion
 * Confirmar recepción del remito mediante token JWT (POST para programmatic access)
 * No requiere autenticación - usa token JWT como parámetro
 * Query: ?token=JWT_TOKEN
 */
router.post(
  '/:id/confirmar-recepcion',
  remitoController.confirmarRecepcion.bind(remitoController)
);

// Todas las rutas de remitos requieren autenticación
router.use(authenticate);

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
 * PATCH /remitos/:id/estado
 * Cambiar estado del remito
 * Requiere: Rol "Infraestructura" O ser el técnico asignado al remito
 */
router.patch(
  '/:id/estado',
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
 * POST /remitos/:id/devolver
 * Generar remito de devolución automático
 * Requiere: Rol "Infraestructura"
 */
router.post(
  '/:id/devolver',
  requireDatabaseRole('Infraestructura'),
  remitoController.generarDevolucion.bind(remitoController)
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

module.exports = router;