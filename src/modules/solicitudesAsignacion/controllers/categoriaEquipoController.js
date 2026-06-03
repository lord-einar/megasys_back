import categoriaEquipoService from '../services/categoriaEquipoService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

class CategoriaEquipoController {
  listar = async (req, res) => {
    try {
      const { tipo, activo } = req.query;
      const filters = {};
      if (tipo) filters.tipo = tipo;
      if (activo !== undefined) filters.activo = activo === 'true';
      const items = await categoriaEquipoService.listar(filters);
      return success(res, items);
    } catch (err) {
      logger.error('Error listando categorías de equipo:', err);
      return error(res, err.message || 'Error al listar categorías', 500);
    }
  };

  obtener = async (req, res) => {
    try {
      const cat = await categoriaEquipoService.obtener(req.params.id);
      if (!cat) return error(res, 'Categoría no encontrada', 404);
      return success(res, cat);
    } catch (err) {
      logger.error('Error obteniendo categoría:', err);
      return error(res, err.message, 500);
    }
  };

  crear = async (req, res) => {
    try {
      const { nombre, descripcion, tipo } = req.body;
      const nueva = await categoriaEquipoService.crear({ nombre, descripcion, tipo });
      return success(res, nueva, 'Categoría creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando categoría:', err);
      return error(res, err.message, 400);
    }
  };

  actualizar = async (req, res) => {
    try {
      const cat = await categoriaEquipoService.actualizar(req.params.id, req.body);
      return success(res, cat, 'Categoría actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando categoría:', err);
      return error(res, err.message, 400);
    }
  };

  eliminar = async (req, res) => {
    try {
      const resultado = await categoriaEquipoService.eliminar(req.params.id);
      const msg = resultado.eliminado
        ? 'Categoría eliminada'
        : 'La categoría está en uso; se marcó como inactiva';
      return success(res, resultado, msg);
    } catch (err) {
      logger.error('Error eliminando categoría:', err);
      return error(res, err.message, 400);
    }
  };
}

export default new CategoriaEquipoController();
