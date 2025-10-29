// src/modules/remitos/routes/index.js
const express = require('express');
const { authenticate } = require('../../auth/middleware/authMiddleware');
const { requireDatabaseRole } = require('../../auth/middleware/roleMiddleware');
const remitoController = require('../controllers/remitoController');
const TransactionWrapper = require('../../../shared/utils/transactionWrapper');

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
 * GET /remitos/:id/disponibles
 * Obtener artículos disponibles para agregar a un remito
 * Filtra por tipo_articulo y sede
 */
router.get('/:id/disponibles', remitoController.obtenerArticulosDisponibles.bind(remitoController));

/**
 * POST /remitos
 * Crear nuevo remito
 * Requiere: Rol "Sistemas"
 * Usa TransactionWrapper para asegurar atomicidad
 */
router.post(
  '/',
  requireDatabaseRole('Sistemas'),
  TransactionWrapper(remitoController.crear.bind(remitoController))
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
 * Requiere: Rol "Infraestructura"
 */
router.patch(
  '/:id/estado',
  requireDatabaseRole('Infraestructura'),
  remitoController.cambiarEstado.bind(remitoController)
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