// src/modules/proveedores/controllers/ProveedorController.js
import proveedorService from '../services/proveedorService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class ProveedorController {
  listar = asyncHandler(async (req, res) => {
    try {
      const resultado = await proveedorService.listar(req.query);
      paginated(res, resultado.rows, resultado.pagination, 'Proveedores obtenidos correctamente');
    } catch (err) {
      logger.error('Error en listar proveedores:', err);
      error(res, err.message || 'Error al listar proveedores', 500);
    }
  });

  obtener = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const proveedor = await proveedorService.obtenerConDetalles(id);

      if (!proveedor) {
        return error(res, 'Proveedor no encontrado', 404);
      }

      success(res, proveedor, 'Proveedor obtenido correctamente');
    } catch (err) {
      logger.error('Error en obtener proveedor:', err);
      error(res, err.message || 'Error al obtener proveedor', 500);
    }
  });

  crear = asyncHandler(async (req, res) => {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await proveedorService.crear(req.body, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'proveedores',
        accion: 'create',
        recurso: 'Proveedor',
        descripcion: `Creación de proveedor: ${req.body.empresa}`,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Proveedor creado correctamente', 201);
    } catch (err) {
      logger.error('Error creando proveedor:', err);
      if (err.message.includes('Ya existe')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al crear proveedor', 500);
    }
  });

  actualizar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const previousData = await proveedorService.obtenerConDetalles(id);

      if (!previousData) {
        return error(res, 'Proveedor no encontrado', 404);
      }

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await proveedorService.actualizar(id, req.body, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'proveedores',
        accion: 'update',
        recurso: 'Proveedor',
        recursoId: id,
        descripcion: `Actualización de proveedor: ${previousData.empresa}`,
        valoresAnteriores: previousData,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Proveedor actualizado correctamente');
    } catch (err) {
      logger.error('Error actualizando proveedor:', err);
      if (err.message.includes('no encontrado')) return error(res, err.message, 404);
      if (err.message.includes('Ya existe')) return error(res, err.message, 409);
      error(res, err.message || 'Error al actualizar proveedor', 500);
    }
  });

  eliminar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const previousData = await proveedorService.obtenerConDetalles(id);

      if (!previousData) {
        return error(res, 'Proveedor no encontrado', 404);
      }

      await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await proveedorService.eliminar(id, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'proveedores',
        accion: 'delete',
        recurso: 'Proveedor',
        recursoId: id,
        descripcion: `Eliminación de proveedor: ${previousData.empresa}`,
        valoresAnteriores: previousData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, null, 'Proveedor eliminado correctamente');
    } catch (err) {
      logger.error('Error eliminando proveedor:', err);
      if (err.message.includes('no encontrado')) return error(res, err.message, 404);
      if (err.message.includes('No se puede eliminar')) return error(res, err.message, 409);
      error(res, err.message || 'Error al eliminar proveedor', 500);
    }
  });

  obtenerEstadisticas = asyncHandler(async (req, res) => {
    try {
      const estadisticas = await proveedorService.obtenerEstadisticas();
      success(res, estadisticas, 'Estadísticas obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo estadísticas:', err);
      error(res, err.message || 'Error al obtener estadísticas', 500);
    }
  });
}

export default new ProveedorController();
