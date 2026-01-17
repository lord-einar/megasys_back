// src/modules/inventario/controllers/tipoArticuloController.js
import tipoArticuloService from '../services/tipoArticuloService.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class TipoArticuloController {
  /**
   * GET /api/tipo-articulo
   * Listar todos los tipos de artículos
   */
  async listar(req, res, next) {
    try {
      const { page = 1, limit = 50, search = '' } = req.query;

      const resultado = await tipoArticuloService.listar({
        page: parseInt(page),
        limit: parseInt(limit),
        search
      });

      res.json(resultado);
    } catch (error) {
      logger.error('Error en TipoArticuloController.listar:', error);
      next(error);
    }
  }

  /**
   * GET /api/tipo-articulo/todos
   * Obtener todos los tipos sin paginación (para selects)
   */
  async obtenerTodos(req, res, next) {
    try {
      const resultado = await tipoArticuloService.obtenerTodos();
      res.json(resultado);
    } catch (error) {
      logger.error('Error en TipoArticuloController.obtenerTodos:', error);
      next(error);
    }
  }

  /**
   * GET /api/tipo-articulo/:id
   * Obtener un tipo de artículo específico
   */
  async obtener(req, res, next) {
    try {
      const { id } = req.params;
      const resultado = await tipoArticuloService.obtener(id);
      res.json(resultado);
    } catch (error) {
      logger.error('Error en TipoArticuloController.obtener:', error);
      next(error);
    }
  }

  /**
   * POST /api/tipo-articulo
   * Crear un nuevo tipo de artículo
   */
  async crear(req, res, next) {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          const result = await tipoArticuloService.crear(req.body);
          return result.data;
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'inventario',
        accion: 'create',
        recurso: 'TipoArticulo',
        recursoId: null,
        descripcion: `Creación de tipo de artículo: ${req.body.nombre}`,
        valoresAnteriores: null,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.status(201).json({
        success: true,
        message: 'Tipo de artículo creado exitosamente',
        data: resultado.data
      });
    } catch (error) {
      logger.error('Error en TipoArticuloController.crear:', error);
      next(error);
    }
  }

  /**
   * PUT /api/tipo-articulo/:id
   * Actualizar un tipo de artículo
   */
  async actualizar(req, res, next) {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const previousResult = await tipoArticuloService.obtener(id);
      const previousData = previousResult.data;

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          const result = await tipoArticuloService.actualizar(id, req.body);
          return result.data;
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'inventario',
        accion: 'update',
        recurso: 'TipoArticulo',
        recursoId: id,
        descripcion: `Actualización de tipo de artículo: ${previousData.nombre}`,
        valoresAnteriores: previousData,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Tipo de artículo actualizado exitosamente',
        data: resultado.data
      });
    } catch (error) {
      logger.error('Error en TipoArticuloController.actualizar:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/tipo-articulo/:id
   * Eliminar un tipo de artículo
   */
  async eliminar(req, res, next) {
    try {
      const { id } = req.params;

      // Get previous values for audit
      const previousResult = await tipoArticuloService.obtener(id);
      const previousData = previousResult.data;

      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          await tipoArticuloService.eliminar(id);
          return null;
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'inventario',
        accion: 'delete',
        recurso: 'TipoArticulo',
        recursoId: id,
        descripcion: `Eliminación de tipo de artículo: ${previousData.nombre}`,
        valoresAnteriores: previousData,
        valoresNuevos: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Tipo de artículo eliminado exitosamente'
      });
    } catch (error) {
      logger.error('Error en TipoArticuloController.eliminar:', error);
      next(error);
    }
  }
}

export default new TipoArticuloController();
