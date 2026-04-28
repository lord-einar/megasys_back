// src/modules/asignaciones/controllers/asignacionInventarioController.js
import asignacionInventarioService from '../services/asignacionInventarioService.js';
import roleService from '../../auth/services/roleService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

class AsignacionInventarioController {
  listar = async (req, res) => {
    try {
      const { personal_id, inventario_id, activo, tipo_articulo } = req.query;
      const filters = {};
      if (personal_id) filters.personal_id = personal_id;
      if (inventario_id) filters.inventario_id = inventario_id;
      if (activo !== undefined) filters.activo = activo === 'true';
      if (tipo_articulo) filters.tipo_articulo_nombre = tipo_articulo;

      const items = await asignacionInventarioService.listar(filters);
      return success(res, items);
    } catch (err) {
      logger.error('Error listando asignaciones:', err);
      return error(res, err.message || 'Error al listar asignaciones', 500);
    }
  };

  obtener = async (req, res) => {
    try {
      const { id } = req.params;
      const asignacion = await asignacionInventarioService.obtener(id);
      if (!asignacion) return error(res, 'Asignación no encontrada', 404);
      return success(res, asignacion);
    } catch (err) {
      logger.error('Error obteniendo asignación:', err);
      return error(res, err.message, 500);
    }
  };

  crear = async (req, res) => {
    try {
      const { inventario_id, personal_id, fecha_asignacion, motivo } = req.body;
      const nueva = await asignacionInventarioService.crear({
        inventario_id,
        personal_id,
        fecha_asignacion,
        motivo
      });
      return success(res, nueva, 'Asignación creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando asignación:', err);
      return error(res, err.message || 'Error al crear asignación', 400);
    }
  };

  cerrar = async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_devolucion } = req.body || {};
      const asignacion = await asignacionInventarioService.cerrar(id, { fecha_devolucion });
      return success(res, asignacion, 'Asignación cerrada correctamente');
    } catch (err) {
      logger.error('Error cerrando asignación:', err);
      return error(res, err.message, 400);
    }
  };

  actualizar = async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_asignacion, fecha_devolucion, motivo } = req.body;

      // Solo super_admin puede modificar fecha_asignacion
      if (fecha_asignacion !== undefined) {
        const userRole = req.user?.role || roleService.getUserRole(req.user?.groups || []);
        if (userRole !== 'super_admin') {
          return error(res, 'Solo un super_admin puede modificar la fecha de asignación', 403);
        }
      }

      const cambios = {};
      if (fecha_asignacion !== undefined) cambios.fecha_asignacion = fecha_asignacion;
      if (fecha_devolucion !== undefined) cambios.fecha_devolucion = fecha_devolucion;
      if (motivo !== undefined) cambios.motivo = motivo;

      const actualizada = await asignacionInventarioService.actualizar(id, cambios);
      return success(res, actualizada, 'Asignación actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando asignación:', err);
      return error(res, err.message, 400);
    }
  };
}

export default new AsignacionInventarioController();
