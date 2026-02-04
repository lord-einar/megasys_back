import visitaService from '../services/visitaService.js';
import visitaReportService from '../services/visitaReportService.js';
import { VisitaChecklistItem } from '../../../models/index.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

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
        } catch (err) {
            logger.error('Error cancelando visita:', err);
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async reprogramar(req, res) {
        try {
            const { id } = req.params;
            const { nueva_fecha } = req.body;
            const usuarioId = req.user.id;

            const visita = await visitaService.reprogramar(id, nueva_fecha, usuarioId);
            return success(res, visita);
        } catch (err) {
            logger.error('Error reprogramando visita:', err);
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async eliminar(req, res) {
        try {
            const { id } = req.params;
            const { eliminar_serie } = req.query; // ?eliminar_serie=true
            const usuarioId = req.user.id;

            const resultado = await visitaService.eliminar(id, eliminar_serie === 'true', usuarioId);
            return success(res, resultado);
        } catch (err) {
            logger.error('Error eliminando visita:', err);
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    async enviarAviso(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;

            const resultado = await visitaService.enviarAviso(id, usuarioId);
            return success(res, resultado);
        } catch (err) {
            logger.error('Error enviando aviso manual:', err);
            return error(res, err.message || "Error enviando aviso", 500);
        }
    }

    async obtenerEstadisticas(req, res) {
        try {
            const { fecha_desde, fecha_hasta } = req.query;

            const stats = await visitaService.obtenerEstadisticas(fecha_desde, fecha_hasta);
            return success(res, stats);
        } catch (err) {
            logger.error('Error obteniendo estadísticas:', err);
            return error(res, err.message || "Error en la operación", 500);
        }
    }

    // ===== Endpoints Públicos de Feedback =====

    async obtenerInfoFeedback(req, res) {
        try {
            const { token } = req.params;

            const visita = await visitaService.obtenerPorTokenFeedback(token);

            // Validar que existan las relaciones necesarias
            if (!visita.sedePrincipal) {
                return error(res, "La visita no tiene sede asociada", 400);
            }
            if (!visita.tecnicoAsignado) {
                return error(res, "La visita no tiene técnico asignado", 400);
            }
            if (!visita.informe) {
                return error(res, "La visita no tiene informe disponible", 400);
            }

            // Devolver solo información necesaria para el formulario
            return success(res, {
                sede: visita.sedePrincipal.nombre_sede,
                fecha: visita.fecha,
                tecnico: `${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}`,
                fecha_realizacion: visita.informe.fecha_realizacion,
                diasRestantes: 2 - Math.floor((new Date() - new Date(visita.informe.fecha_realizacion)) / (1000 * 60 * 60 * 24))
            });
        } catch (err) {
            logger.error('Error obteniendo info feedback:', err);
            return error(res, err.message || "Error obteniendo información", 400);
        }
    }

    async agregarFeedback(req, res) {
        try {
            const { token } = req.params;
            const { comentarios, nombre } = req.body;

            const resultado = await visitaService.agregarComentariosResponsable(token, {
                comentarios,
                nombre
            });

            return success(res, resultado);
        } catch (err) {
            logger.error('Error agregando feedback:', err);
            return error(res, err.message || "Error agregando comentarios", 400);
        }
    }

    async obtenerDashboard(req, res) {
        try {
            const filtros = {
                fecha_desde: req.query.fecha_desde,
                fecha_hasta: req.query.fecha_hasta,
                tecnico_ids: req.query.tecnico_ids ? req.query.tecnico_ids.split(',') : undefined,
                sede_ids: req.query.sede_ids ? req.query.sede_ids.split(',') : undefined,
                estado: req.query.estado,
                tipo: req.query.tipo
            };

            // visitaReportService ya importado al inicio del archivo
            const dashboard = await visitaReportService.obtenerDashboard(filtros);

            return success(res, dashboard);
        } catch (err) {
            logger.error('Error obteniendo dashboard:', err);
            return error(res, err.message || 'Error obteniendo dashboard', 500);
        }
    }
}

export default new VisitaController();
