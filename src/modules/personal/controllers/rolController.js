// src/modules/personal/controllers/rolController.js
import rolService from '../services/rolService.js';
import { success, error } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class RolController {
  /**
   * Listar todos los roles
   */
  listar = asyncHandler(async (req, res) => {
    try {
      const roles = await rolService.listar(req.query);
      success(res, roles, 'Roles obtenidos correctamente');
    } catch (err) {
      logger.error('Error al listar roles:', err);
      error(res, err.message || 'Error al listar roles', 500);
    }
  });

  /**
   * Obtener un rol por ID
   */
  obtener = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const rol = await rolService.obtenerPorId(id);
      success(res, rol, 'Rol obtenido correctamente');
    } catch (err) {
      logger.error('Error al obtener rol:', err);
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener rol', 500);
    }
  });

  /**
   * Crear un nuevo rol
   */
  crear = asyncHandler(async (req, res) => {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await rolService.crear(req.body, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'create',
        recurso: 'Rol',
        recursoId: null,
        descripcion: `Creación de rol: ${req.body.nombre}`,
        valoresAnteriores: null,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Rol creado correctamente', 201);
    } catch (err) {
      logger.error('Error al crear rol:', err);
      if (err.message.includes('ya existe')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al crear rol', 500);
    }
  });

  /**
   * Actualizar un rol existente
   */
  actualizar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Obtener valores anteriores para auditoría
      const previousData = await rolService.obtenerPorId(id);

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await rolService.actualizar(id, req.body, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'update',
        recurso: 'Rol',
        recursoId: id,
        descripcion: `Actualización de rol: ${previousData.nombre}`,
        valoresAnteriores: previousData,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Rol actualizado correctamente');
    } catch (err) {
      logger.error('Error al actualizar rol:', err);
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('ya existe')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al actualizar rol', 500);
    }
  });

  /**
   * Eliminar un rol (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Obtener valores anteriores para auditoría
      const previousData = await rolService.obtenerPorId(id);

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await rolService.eliminar(id, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'delete',
        recurso: 'Rol',
        recursoId: id,
        descripcion: `Eliminación de rol: ${previousData.nombre}`,
        valoresAnteriores: previousData,
        valoresNuevos: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, null, 'Rol eliminado correctamente');
    } catch (err) {
      logger.error('Error al eliminar rol:', err);
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('persona(s) asignada(s)')) {
        return error(res, err.message, 409);
      }
      error(res, err.message || 'Error al eliminar rol', 500);
    }
  });

  /**
   * Obtener personal por rol
   */
  obtenerPersonalPorRol = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await rolService.obtenerPersonalPorRol(id);
      success(res, resultado, 'Personal obtenido correctamente');
    } catch (err) {
      logger.error('Error al obtener personal por rol:', err);
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      error(res, err.message || 'Error al obtener personal', 500);
    }
  });

  /**
   * Asignar rol a un usuario
   */
  asignarRolAPersonal = asyncHandler(async (req, res) => {
    try {
      const { personalId, rolId } = req.body;

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await rolService.asignarRolAPersonal(personalId, rolId, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'personal',
        accion: 'update',
        recurso: 'Personal',
        recursoId: personalId,
        descripcion: `Asignación de rol a personal`,
        valoresAnteriores: null,
        valoresNuevos: { personalId, rolId },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      success(res, resultado.data, 'Rol asignado correctamente');
    } catch (err) {
      logger.error('Error al asignar rol:', err);
      if (err.message.includes('no encontrado')) {
        return error(res, err.message, 404);
      }
      if (err.message.includes('inactivo')) {
        return error(res, err.message, 400);
      }
      error(res, err.message || 'Error al asignar rol', 500);
    }
  });
}

export default new RolController();
