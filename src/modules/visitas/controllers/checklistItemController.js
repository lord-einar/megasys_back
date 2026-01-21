// src/modules/visitas/controllers/checklistItemController.js
import checklistItemService from '../services/checklistItemService.js';
import logger from '../../../shared/utils/logger.js';
import { success, error } from '../../../shared/utils/response.js';

class ChecklistItemController {
    /**
     * GET /visitas/checklist-items
     * Listar todos los items del checklist
     */
    async listar(req, res) {
        try {
            const filtros = {
                activo: req.query.activo
            };

            logger.info('Listando checklist items:', { filtros });

            const items = await checklistItemService.listar(filtros);

            return success(res, items, 'Items de checklist obtenidos correctamente');
        } catch (err) {
            logger.error('Error listando checklist items:', {
                error: err.message,
                stack: err.stack
            });
            return error(res, 'Error al obtener items de checklist', 500);
        }
    }

    /**
     * GET /visitas/checklist-items/:id
     * Obtener un item por ID
     */
    async obtener(req, res) {
        try {
            const { id } = req.params;

            logger.info('Obteniendo checklist item:', { id });

            const item = await checklistItemService.obtenerPorId(id);

            return success(res, item, 'Item de checklist obtenido correctamente');
        } catch (err) {
            logger.error('Error obteniendo checklist item:', {
                error: err.message,
                id: req.params.id
            });

            if (err.message === 'Item de checklist no encontrado') {
                return error(res, err.message, 404);
            }

            return error(res, 'Error al obtener item de checklist', 500);
        }
    }

    /**
     * POST /visitas/checklist-items
     * Crear nuevo item de checklist
     */
    async crear(req, res) {
        try {
            const datos = req.body;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            logger.info('Creando checklist item:', {
                usuario: usuarioEmail,
                nombre: datos.nombre
            });

            const resultado = await checklistItemService.crear(datos, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Item de checklist creado exitosamente', 201);
        } catch (err) {
            logger.error('Error creando checklist item:', {
                error: err.message,
                stack: err.stack,
                usuario: req.user?.email
            });

            if (err.name === 'SequelizeUniqueConstraintError') {
                return error(res, 'Ya existe un item con ese nombre', 400);
            }

            return error(res, err.message || 'Error al crear item de checklist', 400);
        }
    }

    /**
     * PUT /visitas/checklist-items/:id
     * Actualizar item de checklist
     */
    async actualizar(req, res) {
        try {
            const { id } = req.params;
            const datos = req.body;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            logger.info('Actualizando checklist item:', {
                id,
                usuario: usuarioEmail
            });

            const resultado = await checklistItemService.actualizar(id, datos, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Item de checklist actualizado exitosamente');
        } catch (err) {
            logger.error('Error actualizando checklist item:', {
                error: err.message,
                id: req.params.id,
                usuario: req.user?.email
            });

            if (err.message === 'Item de checklist no encontrado') {
                return error(res, err.message, 404);
            }

            if (err.name === 'SequelizeUniqueConstraintError') {
                return error(res, 'Ya existe un item con ese nombre', 400);
            }

            return error(res, err.message || 'Error al actualizar item de checklist', 400);
        }
    }

    /**
     * DELETE /visitas/checklist-items/:id
     * Eliminar item de checklist (soft delete)
     */
    async eliminar(req, res) {
        try {
            const { id } = req.params;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            logger.info('Eliminando checklist item:', {
                id,
                usuario: usuarioEmail
            });

            const resultado = await checklistItemService.eliminar(id, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Item de checklist eliminado exitosamente');
        } catch (err) {
            logger.error('Error eliminando checklist item:', {
                error: err.message,
                id: req.params.id,
                usuario: req.user?.email
            });

            if (err.message === 'Item de checklist no encontrado') {
                return error(res, err.message, 404);
            }

            return error(res, err.message || 'Error al eliminar item de checklist', 400);
        }
    }

    /**
     * PATCH /visitas/checklist-items/reordenar
     * Reordenar items de checklist
     */
    async reordenar(req, res) {
        try {
            const { items } = req.body;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            if (!items || !Array.isArray(items)) {
                return error(res, 'Se requiere un array de items con id y orden', 400);
            }

            logger.info('Reordenando checklist items:', {
                cantidad: items.length,
                usuario: usuarioEmail
            });

            const resultado = await checklistItemService.reordenar(items, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Items de checklist reordenados exitosamente');
        } catch (err) {
            logger.error('Error reordenando checklist items:', {
                error: err.message,
                usuario: req.user?.email
            });
            return error(res, err.message || 'Error al reordenar items de checklist', 400);
        }
    }
}

export default new ChecklistItemController();
