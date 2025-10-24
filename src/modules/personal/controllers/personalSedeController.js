// src/modules/personal/controllers/personalSedeController.js - REFACTORIZADO PARA SOLID
const personalSedeService = require('../services/personalSedeService');
const { success, error, paginated } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const TransactionWrapper = require('../../../shared/utils/transactionWrapper');

class PersonalSedeController {
  /**
   * Listar asignaciones de personal a sedes
   */
  listar = asyncHandler(async (req, res) => {
    try {
      const resultado = await personalSedeService.listar(req.query);
      paginated(res, resultado.rows, resultado.pagination, 'Asignaciones de personal obtenidas correctamente');
    } catch (err) {
      logger.error('Error en listar asignaciones:', err);
      error(res, err.message || 'Error al listar asignaciones', 500);
    }
  });

  /**
   * Obtener asignaciones de una persona específica
   */
  obtenerPorPersonal = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await personalSedeService.obtenerPorPersonal(id);
      success(res, resultado, 'Asignaciones de la persona obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo asignaciones por personal:', err);
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener asignaciones', 500);
    }
  });

  /**
   * Obtener asignaciones de una sede específica
   */
  obtenerPorSede = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await personalSedeService.obtenerPorSede(id);
      success(res, resultado, 'Asignaciones de la sede obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo asignaciones por sede:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener asignaciones', 500);
    }
  });

  /**
   * Crear nueva asignación de personal a sede
   */
  crear = asyncHandler(async (req, res) => {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await personalSedeService.crear(req.body, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'create',
        recurso: 'PersonalSede',
        recursoId: null,
        descripcion: `Creación de asignación de personal ${req.body.personal_id} a sede ${req.body.sede_id}`,
        valoresAnteriores: null,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Asignación creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando asignación:', err);
      if (err.message.includes('no encontrado') || err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('ya está asignado')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al crear asignación', 500);
    }
  });

  /**
   * Actualizar asignación de personal a sede
   */
  actualizar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Get previous values for audit - using service's internal method
      const { PersonalSede } = require('../../../models');
      const previousData = await PersonalSede.findByPk(id);
      if (!previousData) {
        return error(res, 'Asignación no encontrada', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await personalSedeService.actualizar(id, req.body, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'update',
        recurso: 'PersonalSede',
        recursoId: id,
        descripcion: `Actualización de asignación de personal a sede`,
        valoresAnteriores: previousData,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Asignación actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando asignación:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al actualizar asignación', 500);
    }
  });

  /**
   * Dar de baja una asignación (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const { PersonalSede } = require('../../../models');
      const previousData = await PersonalSede.findByPk(id);
      if (!previousData) {
        return error(res, 'Asignación no encontrada', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await personalSedeService.eliminar(id, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'delete',
        recurso: 'PersonalSede',
        recursoId: id,
        descripcion: `Eliminación de asignación de personal a sede`,
        valoresAnteriores: previousData,
        valoresNuevos: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, null, 'Asignación eliminada correctamente');
    } catch (err) {
      logger.error('Error eliminando asignación:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al eliminar asignación', 500);
    }
  });

  /**
   * Obtener estadísticas de asignaciones
   */
  obtenerEstadisticas = asyncHandler(async (req, res) => {
    try {
      const estadisticas = await personalSedeService.obtenerEstadisticas();
      success(res, estadisticas, 'Estadísticas de asignaciones obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo estadísticas:', err);
      error(res, err.message || 'Error al obtener estadísticas', 500);
    }
  });
}

module.exports = new PersonalSedeController();
