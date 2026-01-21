// src/modules/visitas/services/checklistItemService.js
import { VisitaChecklistItem, sequelize } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class ChecklistItemService {
    /**
     * Listar todos los items del checklist
     * @param {Object} filtros - Filtros opcionales
     * @returns {Promise<Array>}
     */
    async listar(filtros = {}) {
        try {
            const { activo } = filtros;
            const where = {};

            if (activo !== undefined) {
                where.activo = activo === 'true' || activo === true;
            }

            const items = await VisitaChecklistItem.findAll({
                where,
                order: [['orden', 'ASC'], ['nombre', 'ASC']]
            });

            return items;
        } catch (error) {
            logger.error('Error listando checklist items:', error);
            throw error;
        }
    }

    /**
     * Obtener un item por ID
     * @param {string} id - UUID del item
     * @returns {Promise<Object>}
     */
    async obtenerPorId(id) {
        try {
            const item = await VisitaChecklistItem.findByPk(id);

            if (!item) {
                throw new Error('Item de checklist no encontrado');
            }

            return item;
        } catch (error) {
            logger.error(`Error obteniendo checklist item ${id}:`, error);
            throw error;
        }
    }

    /**
     * Crear un nuevo item de checklist
     * @param {Object} datos - Datos del item
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async crear(datos, usuarioEmail, opciones = {}) {
        return TransactionWrapper.execute({
            operation: async (transaction) => {
                // Obtener el orden máximo actual
                const maxOrden = await VisitaChecklistItem.max('orden') || 0;

                const item = await VisitaChecklistItem.create({
                    nombre: datos.nombre,
                    descripcion: datos.descripcion || null,
                    orden: datos.orden !== undefined ? datos.orden : maxOrden + 1,
                    activo: datos.activo !== undefined ? datos.activo : true
                }, { transaction });

                return item;
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'crear',
            recurso: 'checklist_item',
            descripcion: `Creación de item de checklist: ${datos.nombre}`
        });
    }

    /**
     * Actualizar un item de checklist
     * @param {string} id - UUID del item
     * @param {Object} datos - Datos a actualizar
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async actualizar(id, datos, usuarioEmail, opciones = {}) {
        const itemAnterior = await this.obtenerPorId(id);

        return TransactionWrapper.execute({
            operation: async (transaction) => {
                await itemAnterior.update({
                    nombre: datos.nombre !== undefined ? datos.nombre : itemAnterior.nombre,
                    descripcion: datos.descripcion !== undefined ? datos.descripcion : itemAnterior.descripcion,
                    orden: datos.orden !== undefined ? datos.orden : itemAnterior.orden,
                    activo: datos.activo !== undefined ? datos.activo : itemAnterior.activo
                }, { transaction });

                return itemAnterior;
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'actualizar',
            recurso: 'checklist_item',
            recursoId: id,
            valoresAnteriores: itemAnterior.toJSON(),
            descripcion: `Actualización de item de checklist: ${itemAnterior.nombre}`
        });
    }

    /**
     * Eliminar (soft delete) un item de checklist
     * @param {string} id - UUID del item
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async eliminar(id, usuarioEmail, opciones = {}) {
        const item = await this.obtenerPorId(id);

        return TransactionWrapper.execute({
            operation: async (transaction) => {
                await item.update({ activo: false }, { transaction });
                return { id, eliminado: true };
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'eliminar',
            recurso: 'checklist_item',
            recursoId: id,
            valoresAnteriores: item.toJSON(),
            descripcion: `Eliminación de item de checklist: ${item.nombre}`
        });
    }

    /**
     * Reordenar items de checklist
     * @param {Array<{id: string, orden: number}>} ordenItems - Array de {id, orden}
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async reordenar(ordenItems, usuarioEmail, opciones = {}) {
        return TransactionWrapper.execute({
            operation: async (transaction) => {
                for (const item of ordenItems) {
                    await VisitaChecklistItem.update(
                        { orden: item.orden },
                        { where: { id: item.id }, transaction }
                    );
                }

                return { reordenados: ordenItems.length };
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'actualizar',
            recurso: 'checklist_item',
            descripcion: `Reordenamiento de ${ordenItems.length} items de checklist`
        });
    }
}

export default new ChecklistItemService();
