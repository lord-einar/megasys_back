// src/modules/inventario/services/tipoArticuloService.js
import { Op } from 'sequelize';
import { TipoArticulo, sequelize } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';

class TipoArticuloService {
  /**
   * Listar todos los tipos de artículos activos
   */
  async listar(opciones = {}) {
    try {
      const { page = 1, limit = 50, search = '' } = opciones;
      const offset = (page - 1) * limit;

      const where = {
        activo: true
      };

      // Búsqueda por nombre o descripción
      if (search && search.trim()) {
        // Op ya importado al inicio del archivo
        where[Op.or] = [
          { nombre: { [Op.iLike]: `%${search}%` } },
          { descripcion: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await TipoArticulo.findAndCountAll({
        where,
        offset,
        limit,
        order: [['nombre', 'ASC']],
        attributes: ['id', 'nombre', 'descripcion', 'activo']
      });

      return {
        success: true,
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error listando tipos de artículos:', error);
      throw new Error(`Error al listar tipos de artículos: ${error.message}`);
    }
  }

  /**
   * Obtener un tipo de artículo por ID
   */
  async obtener(id) {
    try {
      if (!id) {
        throw new Error('ID de tipo de artículo es requerido');
      }

      const tipo = await TipoArticulo.findByPk(id);

      if (!tipo) {
        const error = new Error('Tipo de artículo no encontrado');
        error.statusCode = 404;
        throw error;
      }

      return {
        success: true,
        data: tipo
      };
    } catch (error) {
      logger.error(`Error obteniendo tipo de artículo ${id}:`, error);
      throw error;
    }
  }

  /**
   * Crear nuevo tipo de artículo
   */
  async crear(datos) {
    const t = await sequelize.transaction();

    try {
      // Validaciones
      if (!datos.nombre || !datos.nombre.trim()) {
        throw new Error('El nombre del tipo de artículo es requerido');
      }

      // Verificar que no exista un tipo con el mismo nombre
      const existente = await TipoArticulo.findOne({
        where: {
          nombre: datos.nombre.trim(),
          activo: true
        },
        transaction: t
      });

      if (existente) {
        const error = new Error(`Ya existe un tipo de artículo con el nombre "${datos.nombre}"`);
        error.statusCode = 409;
        throw error;
      }

      const tipo = await TipoArticulo.create({
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion ? datos.descripcion.trim() : null,
        activo: true
      }, { transaction: t });

      await t.commit();

      logger.info(`Tipo de artículo creado: ${tipo.id} - ${tipo.nombre}`);

      return {
        success: true,
        message: 'Tipo de artículo creado exitosamente',
        data: tipo
      };
    } catch (error) {
      await t.rollback();
      logger.error('Error creando tipo de artículo:', error);
      throw error;
    }
  }

  /**
   * Actualizar tipo de artículo
   */
  async actualizar(id, datos) {
    const t = await sequelize.transaction();

    try {
      if (!id) {
        throw new Error('ID de tipo de artículo es requerido');
      }

      const tipo = await TipoArticulo.findByPk(id, { transaction: t });

      if (!tipo) {
        const error = new Error('Tipo de artículo no encontrado');
        error.statusCode = 404;
        throw error;
      }

      // Validar que el nuevo nombre no exista en otro registro
      if (datos.nombre && datos.nombre.trim() !== tipo.nombre) {
        const existente = await TipoArticulo.findOne({
          where: {
            nombre: datos.nombre.trim(),
            activo: true,
            id: { [Op.ne]: id }
          },
          transaction: t
        });

        if (existente) {
          const error = new Error(`Ya existe un tipo de artículo con el nombre "${datos.nombre}"`);
          error.statusCode = 409;
          throw error;
        }
      }

      // Actualizar solo los campos permitidos
      const actualizacion = {};
      if (datos.nombre !== undefined) actualizacion.nombre = datos.nombre.trim();
      if (datos.descripcion !== undefined) actualizacion.descripcion = datos.descripcion ? datos.descripcion.trim() : null;

      await tipo.update(actualizacion, { transaction: t });

      await t.commit();

      logger.info(`Tipo de artículo actualizado: ${id}`);

      return {
        success: true,
        message: 'Tipo de artículo actualizado exitosamente',
        data: tipo
      };
    } catch (error) {
      await t.rollback();
      logger.error(`Error actualizando tipo de artículo ${id}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar (soft delete) un tipo de artículo
   */
  async eliminar(id) {
    const t = await sequelize.transaction();

    try {
      if (!id) {
        throw new Error('ID de tipo de artículo es requerido');
      }

      const tipo = await TipoArticulo.findByPk(id, { transaction: t });

      if (!tipo) {
        const error = new Error('Tipo de artículo no encontrado');
        error.statusCode = 404;
        throw error;
      }

      // Soft delete: marcar como inactivo
      await tipo.update({ activo: false }, { transaction: t });

      await t.commit();

      logger.info(`Tipo de artículo eliminado (soft delete): ${id}`);

      return {
        success: true,
        message: 'Tipo de artículo eliminado exitosamente'
      };
    } catch (error) {
      await t.rollback();
      logger.error(`Error eliminando tipo de artículo ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtener todos los tipos de artículos sin paginación (para selects)
   */
  async obtenerTodos() {
    try {
      const tipos = await TipoArticulo.findAll({
        where: { activo: true },
        order: [['nombre', 'ASC']],
        attributes: ['id', 'nombre', 'descripcion']
      });

      return {
        success: true,
        data: tipos,
        rows: tipos
      };
    } catch (error) {
      logger.error('Error obteniendo todos los tipos de artículos:', error);
      throw new Error(`Error al obtener tipos de artículos: ${error.message}`);
    }
  }
}

export default new TipoArticuloService();
