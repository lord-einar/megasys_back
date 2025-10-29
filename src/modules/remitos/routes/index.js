// src/modules/remitos/routes/index.js
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requireDatabaseRole } = require('../../auth/middleware/roleMiddleware');
const remitoController = require('../controllers/remitoController');

const router = express.Router();

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

module.exports = router;