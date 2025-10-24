// src/modules/inventario/controllers/inventarioController.js
const inventarioService = require('../services/inventarioService');
const { success, error } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');

class InventarioController {
  /**
   * Listar inventario con paginación y filtros
   */
  listar = asyncHandler(async (req, res) => {
    const resultado = await inventarioService.listar(req.query);
    success(res, resultado, 'Inventario obtenido correctamente');
  });

  /**
   * Obtener item específico con historial completo
   */
  obtener = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await inventarioService.obtenerConDetalles(id);

    if (!item) {
      return error(res, 'Item de inventario no encontrado', 404);
    }

    success(res, item, 'Item de inventario obtenido correctamente');
  });

  /**
   * Crear nuevo item de inventario
   */
  crear = asyncHandler(async (req, res) => {
    try {
      const item = await inventarioService.crear(req.body, req.user.email);
      success(res, item, 'Item de inventario creado correctamente', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  });

  /**
   * Actualizar item de inventario
   */
  actualizar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      const item = await inventarioService.actualizar(id, req.body, req.user.email);
      success(res, item, 'Item de inventario actualizado correctamente');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });

  /**
   * Eliminar item de inventario (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      await inventarioService.eliminar(id, req.user.email);
      success(res, null, 'Item de inventario eliminado correctamente');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });

  /**
   * Cambiar estado de un item
   */
  cambiarEstado = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { estado, observaciones } = req.body;
    try {
      const userEmail = req.user?.email || 'sistema@desarrollolocal.com';
      const resultado = await inventarioService.cambiarEstado(id, estado, observaciones, userEmail);
      success(res, resultado, 'Estado del item cambiado correctamente');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });

  /**
   * Obtener historial de movimientos de un item
   */
  obtenerHistorial = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limite = 50 } = req.query;
    try {
      const resultado = await inventarioService.obtenerHistorial(id, limite);
      success(res, resultado, 'Historial de movimientos obtenido correctamente');
    } catch (err) {
      return error(res, err.message, 404);
    }
  });

  /**
   * Obtener estadísticas del inventario
   */
  obtenerEstadisticas = asyncHandler(async (req, res) => {
    const { sede_id = null } = req.query;
    try {
      const estadisticas = await inventarioService.obtenerEstadisticasGenerales(sede_id);
      success(res, estadisticas, 'Estadísticas de inventario obtenidas correctamente');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });

  /**
   * Buscar items de inventario
   */
  buscar = asyncHandler(async (req, res) => {
    const { termino } = req.query;

    if (!termino || termino.trim().length < 2) {
      return error(res, 'El término de búsqueda debe tener al menos 2 caracteres', 400);
    }

    try {
      const resultados = await inventarioService.buscar(termino, req.query);
      success(res, {
        resultados,
        criterios: req.query,
        total: resultados.length
      }, 'Búsqueda de inventario completada');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });
}

module.exports = new InventarioController();
