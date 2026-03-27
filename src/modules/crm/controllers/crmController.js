// src/modules/crm/controllers/crmController.js
import crmService from '../services/crmService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';
import Sede from '../../../models/Sede.js';

class CrmController {

    /**
     * GET /api/crm/casos
     * Query params: estado (active|resolved|cancelled), prioridad (high|normal|low),
     *              accountId, busqueda, page, limit
     */
    async listarCasos(req, res) {
        try {
            const { estado, prioridad, accountId, busqueda, diasMinimos, incluirResueltos, soloConTareasAbiertas, page = 1, limit = 20 } = req.query;
            const resultado = await crmService.listarCasos(
                { estado, prioridad, accountId, busqueda, diasMinimos, incluirResueltos, soloConTareasAbiertas },
                { page: parseInt(page), limit: parseInt(limit) }
            );
            return success(res, resultado);
        } catch (err) {
            logger.error('[CRM] Error listarCasos:', err);
            return error(res, err.message || 'Error consultando casos de CRM', 500);
        }
    }

    /**
     * GET /api/crm/casos/:id
     */
    async obtenerCaso(req, res) {
        try {
            const { id } = req.params;
            const caso = await crmService.obtenerCaso(id);
            return success(res, caso);
        } catch (err) {
            logger.error('[CRM] Error obtenerCaso:', err);
            const statusCode = err.message?.includes('404') ? 404 : 500;
            return error(res, err.message || 'Error obteniendo caso', statusCode);
        }
    }

    /**
     * GET /api/crm/cuentas/:accountId/casos
     */
    async listarCasosPorSede(req, res) {
        try {
            const { accountId } = req.params;
            const { page = 1, limit = 20, estado, prioridad, incluirResueltos, soloConTareasAbiertas } = req.query;
            const resultado = await crmService.listarCasosPorSede(
                accountId,
                { estado, prioridad, incluirResueltos, soloConTareasAbiertas },
                { page: parseInt(page), limit: parseInt(limit) }
            );
            return success(res, resultado);
        } catch (err) {
            logger.error('[CRM] Error listarCasosPorSede:', err);
            return error(res, err.message || 'Error consultando casos de la sede', 500);
        }
    }

    /**
     * GET /api/crm/resumen
     * Counts por estado y prioridad para el dashboard.
     */
    async obtenerResumen(req, res) {
        try {
            const resumen = await crmService.obtenerResumen();
            return success(res, resumen);
        } catch (err) {
            logger.error('[CRM] Error obtenerResumen:', err);
            return error(res, err.message || 'Error obteniendo resumen de CRM', 500);
        }
    }

    /**
     * GET /api/crm/cuentas
     * Query params: q (búsqueda por nombre)
     */
    async listarAccounts(req, res) {
        try {
            const { q = '' } = req.query;
            const accounts = await crmService.listarAccounts(q);
            return success(res, accounts);
        } catch (err) {
            logger.error('[CRM] Error listarAccounts:', err);
            return error(res, err.message || 'Error consultando cuentas de CRM', 500);
        }
    }

    /**
     * PATCH /api/crm/sedes/:sedeId/vincular
     * Body: { accountId }
     * Vincula una sede local con una cuenta CRM de Dynamics 365.
     */
    async vincularSede(req, res) {
        try {
            const { sedeId } = req.params;
            const { accountId } = req.body;

            if (!accountId) {
                return error(res, 'El accountId es requerido', 400);
            }

            const sede = await Sede.findByPk(sedeId);
            if (!sede) {
                return error(res, 'Sede no encontrada', 404);
            }

            sede.crm_account_id = accountId;
            await sede.save();

            logger.info(`[CRM] Sede ${sedeId} vinculada a cuenta CRM ${accountId}`);
            return success(res, { crm_account_id: accountId, sede_id: sedeId });
        } catch (err) {
            logger.error('[CRM] Error vincularSede:', err);
            return error(res, err.message || 'Error vinculando sede con CRM', 500);
        }
    }

    /**
     * DELETE /api/crm/sedes/:sedeId/vincular
     * Desvincula una sede de su cuenta CRM.
     */
    async desvincularSede(req, res) {
        try {
            const { sedeId } = req.params;

            const sede = await Sede.findByPk(sedeId);
            if (!sede) {
                return error(res, 'Sede no encontrada', 404);
            }

            sede.crm_account_id = null;
            await sede.save();

            logger.info(`[CRM] Sede ${sedeId} desvinculada de CRM`);
            return success(res, { sede_id: sedeId });
        } catch (err) {
            logger.error('[CRM] Error desvincularSede:', err);
            return error(res, err.message || 'Error desvinculando sede de CRM', 500);
        }
    }
    /**
     * PATCH /api/crm/tareas/:tareaId/completar
     */
    async completarTarea(req, res) {
        try {
            const { tareaId } = req.params;
            await crmService.completarTarea(tareaId);
            return success(res, { mensaje: 'Tarea completada exitosamente' });
        } catch (err) {
            logger.error('[CRM] Error completarTarea:', err);
            return error(res, err.message || 'Error completando tarea en CRM', 500);
        }
    }

    /**
     * PATCH /api/crm/tareas/:tareaId/cancelar
     */
    async cancelarTarea(req, res) {
        try {
            const { tareaId } = req.params;
            await crmService.cancelarTarea(tareaId);
            return success(res, { mensaje: 'Tarea cancelada exitosamente' });
        } catch (err) {
            logger.error('[CRM] Error cancelarTarea:', err);
            return error(res, err.message || 'Error cancelando tarea en CRM', 500);
        }
    }

    /**
     * POST /api/crm/tareas/:tareaId/nota
     * Body: { texto, asunto? }
     */
    async agregarNotaTarea(req, res) {
        try {
            const { tareaId } = req.params;
            const { texto, asunto } = req.body;
            if (!texto || !texto.trim()) {
                return error(res, 'El texto de la nota es requerido', 400);
            }
            await crmService.agregarNotaTarea(tareaId, texto.trim(), asunto);
            return success(res, { mensaje: 'Nota agregada exitosamente' });
        } catch (err) {
            logger.error('[CRM] Error agregarNotaTarea:', err);
            return error(res, err.message || 'Error agregando nota en CRM', 500);
        }
    }
}

export default new CrmController();
