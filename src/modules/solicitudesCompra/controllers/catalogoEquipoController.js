// src/modules/solicitudesCompra/controllers/catalogoEquipoController.js
import catalogoEquipoService from '../services/catalogoEquipoService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

class CatalogoEquipoController {
  listar = async (req, res) => {
    try {
      const { tipo, activo } = req.query;
      const filters = {};
      if (tipo) filters.tipo = tipo;
      if (activo !== undefined) filters.activo = activo === 'true';

      const items = await catalogoEquipoService.listar(filters);
      return success(res, items);
    } catch (err) {
      logger.error('Error listando catálogo de equipos:', err);
      return error(res, err.message || 'Error al listar catálogo', 500);
    }
  };

  obtener = async (req, res) => {
    try {
      const equipo = await catalogoEquipoService.obtener(req.params.id);
      if (!equipo) return error(res, 'Equipo del catálogo no encontrado', 404);
      return success(res, equipo);
    } catch (err) {
      logger.error('Error obteniendo equipo del catálogo:', err);
      return error(res, err.message, 500);
    }
  };

  crear = async (req, res) => {
    try {
      const { tipo, marca, modelo, descripcion } = req.body;
      const nuevo = await catalogoEquipoService.crear({ tipo, marca, modelo, descripcion });
      return success(res, nuevo, 'Equipo agregado al catálogo', 201);
    } catch (err) {
      logger.error('Error creando equipo del catálogo:', err);
      const status = err.name === 'SequelizeUniqueConstraintError' ? 409 : 400;
      const msg = status === 409
        ? 'Ya existe un equipo con la misma combinación de tipo, marca y modelo'
        : err.message;
      return error(res, msg, status);
    }
  };

  actualizar = async (req, res) => {
    try {
      const equipo = await catalogoEquipoService.actualizar(req.params.id, req.body);
      return success(res, equipo, 'Equipo actualizado correctamente');
    } catch (err) {
      logger.error('Error actualizando equipo del catálogo:', err);
      const status = err.name === 'SequelizeUniqueConstraintError' ? 409 : 400;
      return error(res, err.message, status);
    }
  };

  eliminar = async (req, res) => {
    try {
      const resultado = await catalogoEquipoService.eliminar(req.params.id);
      const msg = resultado.eliminado
        ? 'Equipo eliminado del catálogo'
        : 'El equipo está en uso en solicitudes anteriores; se marcó como inactivo';
      return success(res, resultado, msg);
    } catch (err) {
      logger.error('Error eliminando equipo del catálogo:', err);
      return error(res, err.message, 400);
    }
  };
}

export default new CatalogoEquipoController();
