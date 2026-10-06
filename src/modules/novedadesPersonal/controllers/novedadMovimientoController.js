// src/modules/novedadesPersonal/controllers/novedadMovimientoController.js
import novedadMovimientoService from '../services/novedadMovimientoService.js';
import { Personal } from '../../../models/index.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

const resolverActor = async (user) => {
  const personal = await Personal.findOne({ where: { email: user.email.toLowerCase() } });
  return { id: personal?.id || null, email: user.email };
};

class NovedadMovimientoController {
  resumen = async (req, res) => {
    try {
      const pendientes = await novedadMovimientoService.contarPendientes();
      return success(res, { pendientes });
    } catch (err) {
      logger.error('Error obteniendo resumen de novedades:', err);
      return error(res, err.message, 500);
    }
  };

  listar = async (req, res) => {
    try {
      const novedades = await novedadMovimientoService.listar({ estado: req.query.estado || 'pendiente' });
      return success(res, novedades);
    } catch (err) {
      logger.error('Error listando novedades de movimiento:', err);
      return error(res, err.message, 500);
    }
  };

  confirmar = async (req, res) => {
    try {
      const novedad = await novedadMovimientoService.confirmar(req.params.id, await resolverActor(req.user));
      return success(res, novedad, 'Movimiento confirmado: los equipos fueron trasladados');
    } catch (err) {
      logger.error('Error confirmando novedad de movimiento:', err);
      return error(res, err.message, err.statusCode || 500);
    }
  };

  descartar = async (req, res) => {
    try {
      const novedad = await novedadMovimientoService.descartar(
        req.params.id,
        await resolverActor(req.user),
        req.body?.observaciones
      );
      return success(res, novedad, 'Novedad descartada');
    } catch (err) {
      logger.error('Error descartando novedad de movimiento:', err);
      return error(res, err.message, err.statusCode || 500);
    }
  };
}

export default new NovedadMovimientoController();
