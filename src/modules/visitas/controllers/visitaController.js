const visitaService = require('../services/visitaService');
const { VisitaChecklistItem } = require('../../../models');
const { success, error } = require('../../../shared/utils/response');
const logger = require('../../../shared/utils/logger');

class VisitaController {

    async listar(req, res) {
        try {
            const filtros = req.query;
            const paginacion = {
                page: req.query.page,
                limit: req.query.limit
            };

            const resultado = await visitaService.listar(filtros, paginacion);
            return success(res, resultado);
        } catch (err) {
            return error(res, err.message || 'Error al listar visitas', 500);
        }
    }

    async obtener(req, res) {
        try {
            const { id } = req.params;
            const visita = await visitaService.obtenerPorId(id);
            return success(res, visita);
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async crear(req, res) {
        try {
            const usuarioId = req.user.id; // Asumiendo middleware de auth
            const datos = req.body;

            const resultado = await visitaService.crear(datos, usuarioId);
            return success(res, resultado, 201);
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async actualizar(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            const datos = req.body;
            const { actualizar_serie } = req.query; // ?actualizar_serie=true

            const visita = await visitaService.actualizar(id, datos, usuarioId, actualizar_serie === 'true');
            return success(res, visita);
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async marcarRealizada(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            const datosInforme = req.body;

            const informe = await visitaService.marcarRealizada(id, datosInforme, usuarioId);
            return success(res, informe);
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async obtenerCalendario(req, res) {
        try {
            const { mes, anio, tecnico_id } = req.query;

            if (!mes || !anio) {
                throw new Error('Mes y año son requeridos');
            }

            const eventos = await visitaService.obtenerCalendario(parseInt(mes), parseInt(anio), tecnico_id);
            return success(res, eventos);
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async agregarSolicitud(req, res) {
        try {
            const { token, email, descripcion, nombre } = req.body;

            if (!token || !email || !descripcion) {
                throw new Error('Faltan datos requeridos');
            }

            // Validar dominio email
            if (!email.endsWith('@megatlon.com.ar')) {
                throw new Error('Solo se permiten correos @megatlon.com.ar');
            }

            const solicitud = await visitaService.agregarSolicitud(token, { email, descripcion, nombre });
            return success(res, { message: 'Solicitud registrada correctamente', solicitud });
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async obtenerChecklistItems(req, res) {
        try {
            const items = await VisitaChecklistItem.findAll({
                where: { activo: true },
                order: [['orden', 'ASC']]
            });
            return success(res, items);
        } catch (err) {
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async cancelar(req, res) {
        try {
            const { id } = req.params;
            const { motivo } = req.body;
            const usuarioId = req.user.id;

            const visita = await visitaService.cancelar(id, motivo, usuarioId);
            return success(res, visita);
        } catch (error) {
            logger.error('Error cancelando visita:', error);
            return error(res, error.message || "Error en la operación", 500);
        }
    }

    async reprogramar(req, res) {
        try {
            const { id } = req.params;
            const { nueva_fecha } = req.body;
            const usuarioId = req.user.id;

            const visita = await visitaService.reprogramar(id, nueva_fecha, usuarioId);
            return success(res, visita);
        } catch (error) {
            logger.error('Error reprogramando visita:', error);
            return error(res, error.message || "Error en la operación", 500);
        }
    }

    async obtenerEstadisticas(req, res) {
        try {
            const { fecha_desde, fecha_hasta } = req.query;

            const stats = await visitaService.obtenerEstadisticas(fecha_desde, fecha_hasta);
            return success(res, stats);
        } catch (error) {
            logger.error('Error obteniendo estadísticas:', error);
            return error(res, error.message || "Error en la operación", 500);
        }
    }
}

module.exports = new VisitaController();
