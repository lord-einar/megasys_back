// src/modules/solicitudesCompra/controllers/solicitudCompraController.js
import solicitudCompraService from '../services/solicitudCompraService.js';
import roleService from '../../auth/services/roleService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

const buildContexto = (req) => ({
  email: req.user?.email,
  roleAnalysis: roleService.analyzeUserGroups(req.user?.groups || [])
});

class SolicitudCompraController {
  listar = async (req, res) => {
    try {
      const {
        estado, tipo_equipo, motivo,
        beneficiario_personal_id,
        desde, hasta, q,
        page, limit
      } = req.query;

      const filtros = { estado, tipo_equipo, motivo, beneficiario_personal_id, desde, hasta, q };
      const { rows, count, page: p, limit: l } = await solicitudCompraService.listar(
        filtros,
        { page, limit }
      );
      return paginated(res, rows, { page: p, limit: l, total: count });
    } catch (err) {
      logger.error('Error listando solicitudes de compra:', err);
      return error(res, err.message || 'Error al listar solicitudes', 500);
    }
  };

  obtener = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.obtener(req.params.id);
      if (!solicitud) return error(res, 'Solicitud no encontrada', 404);
      return success(res, solicitud);
    } catch (err) {
      logger.error('Error obteniendo solicitud:', err);
      return error(res, err.message, 500);
    }
  };

  crear = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.crear(req.body, buildContexto(req));
      // Devolver con relaciones cargadas para que el front no haga otro fetch
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando solicitud:', err);
      return error(res, err.message || 'Error al crear solicitud', 400);
    }
  };

  actualizar = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.actualizar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando solicitud:', err);
      return error(res, err.message, 400);
    }
  };
}

export default new SolicitudCompraController();
