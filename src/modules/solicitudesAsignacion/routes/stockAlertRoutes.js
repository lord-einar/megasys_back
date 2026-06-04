import express from 'express';
import stockAlertDiarioService from '../services/stockAlertDiarioService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

const router = express.Router();

// GET /api/stock-alerts/info?token=xxx — info de la alerta (para la página del front)
router.get('/info', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return error(res, 'Token requerido', 400);
    const info = stockAlertDiarioService.verificarToken(token);
    return success(res, {
      categoria_nombre: info.categoria_nombre,
      tipo: info.tipo,
      count: info.count,
      categoria_id: info.categoria_id
    });
  } catch (err) {
    logger.error('StockAlert: token inválido o expirado', { error: err.message });
    return error(res, 'Enlace inválido o expirado', 401);
  }
});

// POST /api/stock-alerts/notificar-compras — Infra confirma, se notifica a Compras
router.post('/notificar-compras', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return error(res, 'Token requerido', 400);
    const resultado = await stockAlertDiarioService.notificarCompras(token);
    return success(res, resultado, 'Compras notificado correctamente');
  } catch (err) {
    logger.error('StockAlert: error al notificar compras', { error: err.message });
    return error(res, err.message || 'Error al notificar', 400);
  }
});

// POST /api/stock-alerts/ejecutar — trigger manual (solo desarrollo)
if (process.env.NODE_ENV !== 'production') {
  router.post('/ejecutar', async (req, res) => {
    try {
      await stockAlertDiarioService.ejecutar();
      return success(res, null, 'Verificación de stock ejecutada');
    } catch (err) {
      return error(res, err.message, 500);
    }
  });
}

export default router;
