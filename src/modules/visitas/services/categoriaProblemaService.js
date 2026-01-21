// src/modules/visitas/services/categoriaProblemaService.js
import { CategoriaProblema, sequelize } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class CategoriaProblemaService {
    /**
     * Listar todas las categorías de problemas
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

            const categorias = await CategoriaProblema.findAll({
                where,
                order: [['orden', 'ASC'], ['nombre', 'ASC']]
            });

            return categorias;
        } catch (error) {
            logger.error('Error listando categorías de problemas:', error);
            throw error;
        }
    }

    /**
     * Obtener una categoría por ID
     * @param {string} id - UUID de la categoría
     * @returns {Promise<Object>}
     */
    async obtenerPorId(id) {
        try {
            const categoria = await CategoriaProblema.findByPk(id);

            if (!categoria) {
                throw new Error('Categoría de problema no encontrada');
            }

            return categoria;
        } catch (error) {
            logger.error(`Error obteniendo categoría de problema ${id}:`, error);
            throw error;
        }
    }

    /**
     * Obtener una categoría por código
     * @param {string} codigo - Código de la categoría
     * @returns {Promise<Object|null>}
     */
    async obtenerPorCodigo(codigo) {
        try {
            const categoria = await CategoriaProblema.findOne({
                where: { codigo, activo: true }
            });

            return categoria;
        } catch (error) {
            logger.error(`Error obteniendo categoría por código ${codigo}:`, error);
            throw error;
        }
    }

    /**
     * Crear una nueva categoría de problema
     * @param {Object} datos - Datos de la categoría
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async crear(datos, usuarioEmail, opciones = {}) {
        return TransactionWrapper.execute({
            operation: async (transaction) => {
                // Obtener el orden máximo actual
                const maxOrden = await CategoriaProblema.max('orden') || 0;

                // Generar código si no se proporciona
                const codigo = datos.codigo || this._generarCodigo(datos.nombre);

                const categoria = await CategoriaProblema.create({
                    nombre: datos.nombre,
                    codigo,
                    descripcion: datos.descripcion || null,
                    icono: datos.icono || 'question-mark-circle',
                    color: datos.color || '#6b7280',
                    orden: datos.orden !== undefined ? datos.orden : maxOrden + 1,
                    activo: datos.activo !== undefined ? datos.activo : true
                }, { transaction });

                return categoria;
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'crear',
            recurso: 'categoria_problema',
            descripcion: `Creación de categoría de problema: ${datos.nombre}`
        });
    }

    /**
     * Actualizar una categoría de problema
     * @param {string} id - UUID de la categoría
     * @param {Object} datos - Datos a actualizar
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async actualizar(id, datos, usuarioEmail, opciones = {}) {
        const categoriaAnterior = await this.obtenerPorId(id);

        return TransactionWrapper.execute({
            operation: async (transaction) => {
                await categoriaAnterior.update({
                    nombre: datos.nombre !== undefined ? datos.nombre : categoriaAnterior.nombre,
                    codigo: datos.codigo !== undefined ? datos.codigo : categoriaAnterior.codigo,
                    descripcion: datos.descripcion !== undefined ? datos.descripcion : categoriaAnterior.descripcion,
                    icono: datos.icono !== undefined ? datos.icono : categoriaAnterior.icono,
                    color: datos.color !== undefined ? datos.color : categoriaAnterior.color,
                    orden: datos.orden !== undefined ? datos.orden : categoriaAnterior.orden,
                    activo: datos.activo !== undefined ? datos.activo : categoriaAnterior.activo
                }, { transaction });

                return categoriaAnterior;
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'actualizar',
            recurso: 'categoria_problema',
            recursoId: id,
            valoresAnteriores: categoriaAnterior.toJSON(),
            descripcion: `Actualización de categoría de problema: ${categoriaAnterior.nombre}`
        });
    }

    /**
     * Eliminar (soft delete) una categoría de problema
     * @param {string} id - UUID de la categoría
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async eliminar(id, usuarioEmail, opciones = {}) {
        const categoria = await this.obtenerPorId(id);

        return TransactionWrapper.execute({
            operation: async (transaction) => {
                await categoria.update({ activo: false }, { transaction });
                return { id, eliminado: true };
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'eliminar',
            recurso: 'categoria_problema',
            recursoId: id,
            valoresAnteriores: categoria.toJSON(),
            descripcion: `Eliminación de categoría de problema: ${categoria.nombre}`
        });
    }

    /**
     * Reordenar categorías de problema
     * @param {Array<{id: string, orden: number}>} ordenCategorias - Array de {id, orden}
     * @param {string} usuarioEmail - Email del usuario
     * @param {Object} opciones - Opciones adicionales
     * @returns {Promise<Object>}
     */
    async reordenar(ordenCategorias, usuarioEmail, opciones = {}) {
        return TransactionWrapper.execute({
            operation: async (transaction) => {
                for (const cat of ordenCategorias) {
                    await CategoriaProblema.update(
                        { orden: cat.orden },
                        { where: { id: cat.id }, transaction }
                    );
                }

                return { reordenados: ordenCategorias.length };
            },
            usuarioEmail,
            usuarioId: opciones.usuarioId,
            modulo: 'visitas',
            accion: 'actualizar',
            recurso: 'categoria_problema',
            descripcion: `Reordenamiento de ${ordenCategorias.length} categorías de problema`
        });
    }

    /**
     * Generar código a partir del nombre
     * @param {string} nombre - Nombre de la categoría
     * @returns {string}
     */
    _generarCodigo(nombre) {
        return nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }
}

export default new CategoriaProblemaService();
