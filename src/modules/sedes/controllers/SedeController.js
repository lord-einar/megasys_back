// src/modules/sedes/controllers/SedeController.js - REFACTORIZADO PARA SOLID
const sedeService = require('../services/sedeService');
const { success, error, paginated } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const TransactionWrapper = require('../../../shared/utils/transactionWrapper');

class SedeController {
  /**
   * Listar todas las sedes con paginación y filtros
   */
  listar = asyncHandler(async (req, res) => {
    try {
      const resultado = await sedeService.listar(req.query);
      const sedesEnriquecidas = await sedeService.enriquecerConEstadisticas(resultado.rows);

      paginated(res, sedesEnriquecidas, resultado.pagination, 'Sedes obtenidas correctamente');
    } catch (err) {
      logger.error('Error en listar sedes:', err);
      error(res, err.message || 'Error al listar sedes', 500);
    }
  });

  /**
   * Obtener una sede específica con detalles completos
   */
  obtener = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const sede = await sedeService.obtenerConDetalles(id);
      if (!sede) {
        return error(res, 'Sede no encontrada', 404);
      }

      const estadisticas = sedeService.calcularEstadisticas(sede);
      const sedeCompleta = {
        ...sede,
        inventario: estadisticas.inventario,
        estadisticas
      };

      success(res, sedeCompleta, 'Sede obtenida correctamente');
    } catch (err) {
      logger.error('Error en obtener sede:', err);
      error(res, err.message || 'Error al obtener sede', 500);
    }
  });

  /**
   * Crear nueva sede
   */
  crear = asyncHandler(async (req, res) => {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await sedeService.crear(req.body, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'sedes',
        accion: 'create',
        recurso: 'Sede',
        recursoId: null,
        descripcion: `Creación de sede: ${req.body.nombre}`,
        valoresAnteriores: null,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Sede creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando sede:', err);
      if (err.message.includes('Ya existe')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al crear sede', 500);
    }
  });

  /**
   * Actualizar sede existente
   */
  actualizar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const previousData = await sedeService.obtenerConDetalles(id);
      if (!previousData) {
        return error(res, 'Sede no encontrada', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await sedeService.actualizar(id, req.body, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'sedes',
        accion: 'update',
        recurso: 'Sede',
        recursoId: id,
        descripcion: `Actualización de sede: ${previousData.nombre}`,
        valoresAnteriores: previousData,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Sede actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('Ya existe')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al actualizar sede', 500);
    }
  });

  /**
   * Eliminar sede (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const previousData = await sedeService.obtenerConDetalles(id);
      if (!previousData) {
        return error(res, 'Sede no encontrada', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await sedeService.eliminar(id, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'sedes',
        accion: 'delete',
        recurso: 'Sede',
        recursoId: id,
        descripcion: `Eliminación de sede: ${previousData.nombre}`,
        valoresAnteriores: previousData,
        valoresNuevos: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, null, 'Sede eliminada correctamente');
    } catch (err) {
      logger.error('Error eliminando sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('No se puede eliminar')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al eliminar sede', 500);
    }
  });

  /**
   * Obtener personal de una sede específica
   */
  obtenerPersonal = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await sedeService.obtenerPersonal(id, req.query);
      success(res, resultado, 'Personal de la sede obtenido correctamente');
    } catch (err) {
      logger.error('Error obtener personal de sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener personal de la sede', 500);
    }
  });

  /**
   * Obtener inventario de una sede específica
   */
  obtenerInventario = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await sedeService.obtenerInventario(id, req.query);
      success(res, resultado, 'Inventario de la sede obtenido correctamente');
    } catch (err) {
      logger.error('Error obtener inventario de sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener inventario de la sede', 500);
    }
  });

  /**
   * Obtener servicios de una sede específica
   */
  obtenerServicios = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await sedeService.obtenerServicios(id, req.query);
      success(res, resultado, 'Servicios de la sede obtenidos correctamente');
    } catch (err) {
      logger.error('Error obtener servicios de sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener servicios de la sede', 500);
    }
  });

  /**
   * Asignar servicio a una sede
   */
  asignarServicio = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { servicio_id } = req.body;

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await sedeService.asignarServicio(id, servicio_id, req.body, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'sedes',
        accion: 'create',
        recurso: 'SedeServicio',
        recursoId: id,
        descripcion: `Asignación de servicio ${servicio_id} a sede ${id}`,
        valoresAnteriores: null,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, null, 'Servicio asignado correctamente a la sede');
    } catch (err) {
      logger.error('Error asignando servicio a sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('ya está asignado')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al asignar servicio a la sede', 500);
    }
  });

  /**
   * Obtener estadísticas generales de sedes
   */
  obtenerEstadisticas = asyncHandler(async (req, res) => {
    try {
      const estadisticas = await sedeService.obtenerEstadisticasGenerales();
      success(res, estadisticas, 'Estadísticas obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo estadísticas:', err);
      error(res, err.message || 'Error al obtener estadísticas', 500);
    }
  });
}

module.exports = new SedeController();