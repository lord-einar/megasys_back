// src/modules/visitas/controllers/categoriaProblemaController.js
import categoriaProblemaService from '../services/categoriaProblemaService.js';
import logger from '../../../shared/utils/logger.js';
import { success, error } from '../../../shared/utils/response.js';

class CategoriaProblemaController {
    /**
     * GET /visitas/categorias-problemas
     * Listar todas las categorías de problemas
     */
    async listar(req, res) {
        try {
            // Convertir el query param 'activo' a booleano si existe
            let activo = undefined;
            if (req.query.activo !== undefined) {
                // Manejar tanto strings como booleanos
                if (typeof req.query.activo === 'string') {
                    activo = req.query.activo === 'true';
                } else {
                    activo = req.query.activo;
                }
            }

            const filtros = { activo };

            logger.info('Listando categorías de problemas:', { filtros });

            const categorias = await categoriaProblemaService.listar(filtros);

            return success(res, categorias, 'Categorías de problemas obtenidas correctamente');
        } catch (err) {
            logger.error('Error listando categorías de problemas:', {
                error: err.message,
                stack: err.stack
            });
            return error(res, 'Error al obtener categorías de problemas', 500);
        }
    }

    /**
     * GET /visitas/categorias-problemas/:id
     * Obtener una categoría por ID
     */
    async obtener(req, res) {
        try {
            const { id } = req.params;

            logger.info('Obteniendo categoría de problema:', { id });

            const categoria = await categoriaProblemaService.obtenerPorId(id);

            return success(res, categoria, 'Categoría de problema obtenida correctamente');
        } catch (err) {
            logger.error('Error obteniendo categoría de problema:', {
                error: err.message,
                id: req.params.id
            });

            if (err.message === 'Categoría de problema no encontrada') {
                return error(res, err.message, 404);
            }

            return error(res, 'Error al obtener categoría de problema', 500);
        }
    }

    /**
     * POST /visitas/categorias-problemas
     * Crear nueva categoría de problema
     */
    async crear(req, res) {
        try {
            const datos = req.body;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            logger.info('Creando categoría de problema:', {
                usuario: usuarioEmail,
                nombre: datos.nombre
            });

            const resultado = await categoriaProblemaService.crear(datos, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Categoría de problema creada exitosamente', 201);
        } catch (err) {
            logger.error('Error creando categoría de problema:', {
                error: err.message,
                stack: err.stack,
                usuario: req.user?.email
            });

            if (err.name === 'SequelizeUniqueConstraintError') {
                return error(res, 'Ya existe una categoría con ese nombre o código', 400);
            }

            return error(res, err.message || 'Error al crear categoría de problema', 400);
        }
    }

    /**
     * PUT /visitas/categorias-problemas/:id
     * Actualizar categoría de problema
     */
    async actualizar(req, res) {
        try {
            const { id } = req.params;
            const datos = req.body;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            logger.info('Actualizando categoría de problema:', {
                id,
                usuario: usuarioEmail
            });

            const resultado = await categoriaProblemaService.actualizar(id, datos, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Categoría de problema actualizada exitosamente');
        } catch (err) {
            logger.error('Error actualizando categoría de problema:', {
                error: err.message,
                id: req.params.id,
                usuario: req.user?.email
            });

            if (err.message === 'Categoría de problema no encontrada') {
                return error(res, err.message, 404);
            }

            if (err.name === 'SequelizeUniqueConstraintError') {
                return error(res, 'Ya existe una categoría con ese nombre o código', 400);
            }

            return error(res, err.message || 'Error al actualizar categoría de problema', 400);
        }
    }

    /**
     * DELETE /visitas/categorias-problemas/:id
     * Eliminar categoría de problema (soft delete)
     */
    async eliminar(req, res) {
        try {
            const { id } = req.params;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            logger.info('Eliminando categoría de problema:', {
                id,
                usuario: usuarioEmail
            });

            const resultado = await categoriaProblemaService.eliminar(id, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Categoría de problema eliminada exitosamente');
        } catch (err) {
            logger.error('Error eliminando categoría de problema:', {
                error: err.message,
                id: req.params.id,
                usuario: req.user?.email
            });

            if (err.message === 'Categoría de problema no encontrada') {
                return error(res, err.message, 404);
            }

            return error(res, err.message || 'Error al eliminar categoría de problema', 400);
        }
    }

    /**
     * PATCH /visitas/categorias-problemas/reordenar
     * Reordenar categorías de problema
     */
    async reordenar(req, res) {
        try {
            const { categorias } = req.body;
            const usuarioEmail = req.user?.email || 'sistema';
            const usuarioId = req.user?.id || null;

            if (!categorias || !Array.isArray(categorias)) {
                return error(res, 'Se requiere un array de categorías con id y orden', 400);
            }

            logger.info('Reordenando categorías de problemas:', {
                cantidad: categorias.length,
                usuario: usuarioEmail
            });

            const resultado = await categoriaProblemaService.reordenar(categorias, usuarioEmail, { usuarioId });

            return success(res, resultado.data, 'Categorías de problemas reordenadas exitosamente');
        } catch (err) {
            logger.error('Error reordenando categorías de problemas:', {
                error: err.message,
                usuario: req.user?.email
            });
            return error(res, err.message || 'Error al reordenar categorías de problemas', 400);
        }
    }
}

export default new CategoriaProblemaController();
