// src/modules/personal/controllers/personalController.js - REFACTORIZADO PARA SOLID
import personalService from '../services/personalService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';
import entraSyncService from '../services/entraSyncService.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class PersonalController {
  /**
   * Listar todo el personal con paginación y filtros
   * Implementa restricción por rol:
   * - super_admin (Infraestructura): puede ver a todos
   * - support (Soporte): solo puede ver su propio perfil
   * - Otros roles: acceso denegado
   */
  listar = asyncHandler(async (req, res) => {
    try {
      // Get user's role to implement visibility restrictions
      // The role middleware sets req.user.role to the user's role
      const userRole = req.user?.role;
      const userId = req.user?.id;

      // Check authorization
      if (!userRole) {
        return error(res, 'No se pudo determinar el rol del usuario', 403);
      }

      // Restrict access by role
      if (userRole !== 'super_admin' && userRole !== 'support' && userRole !== 'helpdesk') {
        return error(res, 'No tienes permiso para ver el listado de personal', 403);
      }

      // If user is Soporte (support), only show their own profile
      let filters = { ...req.query };
      if (userRole === 'support' && userId) {
        // For Soporte role, limit to their own data only
        // Note: Only set personal_id if userId is a valid UUID (not Entra ID homeAccountId format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(userId)) {
          filters.personal_id = userId;
        } else {
          logger.warn('User ID is not a valid UUID - cannot filter by personal_id', {
            userRole,
            userId
          });
        }
      }

      const resultado = await personalService.listar(filters, userRole, userId);
      paginated(res, resultado.rows, resultado.pagination, 'Personal obtenido correctamente');
    } catch (err) {
      logger.error('Error en listar personal:', err);
      error(res, err.message || 'Error al listar personal', 500);
    }
  });

  /**
   * Obtener una persona específica con detalles completos
   */
  obtener = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const persona = await personalService.obtenerConDetalles(id);
      if (!persona) {
        return error(res, 'Persona no encontrada', 404);
      }
      success(res, persona, 'Persona obtenida correctamente');
    } catch (err) {
      logger.error('Error en obtener personal:', err);
      error(res, err.message || 'Error al obtener la persona', 500);
    }
  });

  /**
   * Crear nueva persona
   */
  crear = asyncHandler(async (req, res) => {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await personalService.crear(req.body, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'create',
        recurso: 'Personal',
        recursoId: null,
        descripcion: `Creación de personal: ${req.body.nombre} ${req.body.apellido}`,
        valoresAnteriores: null,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Persona creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando persona:', err);
      // Log detailed validation errors if available
      if (err.errors) {
        logger.error('Detalles de validación:', err.errors.map(e => ({ field: e.path, message: e.message, value: e.value })));
      }
      if (err.message.includes('email') && err.message.includes('registrado')) {
        return error(res, err.message, 409);
      }
      if (err.message.includes('sede')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('rol')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al crear la persona', 500);
    }
  });

  /**
   * Actualizar persona existente
   */
  actualizar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const previousData = await personalService.obtenerConDetalles(id);
      if (!previousData) {
        return error(res, 'Persona no encontrada', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await personalService.actualizar(id, req.body, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'update',
        recurso: 'Personal',
        recursoId: id,
        descripcion: `Actualización de personal: ${previousData.nombre} ${previousData.apellido}`,
        valoresAnteriores: previousData,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Persona actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando persona:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('email') && err.message.includes('registrado')) {
        return error(res, err.message, 409);
      }
      if (err.message.includes('sede') || err.message.includes('rol')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al actualizar la persona', 500);
    }
  });

  /**
   * Eliminar persona (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const previousData = await personalService.obtenerConDetalles(id);
      if (!previousData) {
        return error(res, 'Persona no encontrada', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await personalService.eliminar(id, req.user.email, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'delete',
        recurso: 'Personal',
        recursoId: id,
        descripcion: `Eliminación de personal: ${previousData.nombre} ${previousData.apellido}`,
        valoresAnteriores: previousData,
        valoresNuevos: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, null, 'Persona eliminada correctamente');
    } catch (err) {
      logger.error('Error eliminando persona:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('remito')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al eliminar la persona', 500);
    }
  });

  /**
   * Obtener remitos de una persona específica
   */
  obtenerRemitos = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await personalService.obtenerRemitos(id, req.query);
      success(res, resultado, 'Remitos de la persona obtenidos correctamente');
    } catch (err) {
      logger.error('Error obtener remitos:', err);
      if (err.message.includes('no encontrada')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener remitos de la persona', 500);
    }
  });

  /**
   * Obtener estadísticas del personal por sede
   */
  obtenerEstadisticasPorSede = asyncHandler(async (req, res) => {
    try {
      const estadisticas = await personalService.obtenerEstadisticasPorSede();
      success(res, estadisticas, 'Estadísticas del personal obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo estadísticas:', err);
      error(res, err.message || 'Error al obtener estadísticas', 500);
    }
  });

  /**
   * Obtener estadísticas generales
   */
  obtenerEstadisticasGenerales = asyncHandler(async (req, res) => {
    try {
      const estadisticas = await personalService.obtenerEstadisticasGenerales();
      success(res, estadisticas, 'Estadísticas generales obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo estadísticas generales:', err);
      error(res, err.message || 'Error al obtener estadísticas', 500);
    }
  });

  /**
   * Buscar personal por criterios específicos
   */
  buscar = asyncHandler(async (req, res) => {
    try {
      const resultado = await personalService.buscar(req.query.termino, req.query);
      success(res, {
        resultados: resultado,
        total: resultado.length
      }, 'Búsqueda de personal completada');
    } catch (err) {
      logger.error('Error en búsqueda:', err);
      if (err.message.includes('2 caracteres')) {
        return error(res, err.message, 400);
      }
      error(res, err.message || 'Error en la búsqueda', 500);
    }
  });

  /**
   * Exportar personal a CSV
   */
  exportar = asyncHandler(async (req, res) => {
    try {
      const data = await personalService.exportar(req.query);

      // Generar CSV
      const headers = ['Nombre', 'Apellido', 'Email', 'Teléfono', 'Cargo', 'Sede', 'Empresa'];
      const csvRows = [headers.join(',')];

      data.forEach(row => {
        const values = [
          row.nombre,
          row.apellido,
          row.email,
          row.telefono,
          row.cargo,
          row.sede,
          row.empresa
        ].map(value => `"${value}"`); // Envolver en comillas para manejar comas

        csvRows.push(values.join(','));
      });

      const csv = csvRows.join('\n');

      // Configurar headers para descarga
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="personal_${new Date().toISOString().split('T')[0]}.csv"`);

      // Agregar BOM para UTF-8 (ayuda con caracteres especiales en Excel)
      res.send('\ufeff' + csv);
    } catch (err) {
      logger.error('Error exportando personal:', err);
      error(res, err.message || 'Error al exportar personal', 500);
    }
  });

  /**
   * Sincronizar manualmente con Entra ID
   */
  syncEntra = asyncHandler(async (req, res) => {
    try {
      const result = await entraSyncService.syncGerentes();
      if (result.success) {
        success(res, result.stats, 'Sincronización con Entra ID completada exitosamente');
      } else {
        error(res, result.error || 'Error durante la sincronización', 500);
      }
    } catch (err) {
      logger.error('Error en sincronización manual:', err);
      error(res, err.message || 'Error al sincronizar con Entra ID', 500);
    }
  });
}

export default new PersonalController();