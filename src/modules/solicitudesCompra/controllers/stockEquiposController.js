// src/modules/solicitudesCompra/controllers/stockEquiposController.js
import stockEquiposService from '../services/stockEquiposService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

class StockEquiposController {
  listarStock = async (req, res) => {
    try {
      const { tipo, estado, q } = req.query;
      const data = await stockEquiposService.listarStock({ tipo, estado, q });
      return success(res, data);
    } catch (err) {
      logger.error('Error listando stock de equipos:', err);
      return error(res, err.message || 'Error al listar stock', 500);
    }
  };

  historialPorPersonal = async (req, res) => {
    try {
      const data = await stockEquiposService.historialPorPersonal(req.params.personalId);
      return success(res, data);
    } catch (err) {
      logger.error('Error obteniendo historial por personal:', err);
      const status = (err.message || '').includes('no encontrado') ? 404 : 500;
      return error(res, err.message || 'Error al obtener historial', status);
    }
  };

  historialPorSede = async (req, res) => {
    try {
      const data = await stockEquiposService.historialPorSede(req.params.sedeId);
      return success(res, data);
    } catch (err) {
      logger.error('Error obteniendo historial por sede:', err);
      const status = (err.message || '').includes('no encontrada') ? 404 : 500;
      return error(res, err.message || 'Error al obtener historial', status);
    }
  };
}

export default new StockEquiposController();
