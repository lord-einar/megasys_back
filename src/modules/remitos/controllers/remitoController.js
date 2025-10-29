// src/modules/remitos/controllers/remitoController.js
const remitoService = require('../services/remitoService');
const logger = require('../../../shared/utils/logger');
const { success, error, paginated } = require('../../../shared/utils/response');
const { sequelize } = require('../../../models');

class RemitoController {
  /**
   * POST /remitos
   * Crear nuevo remito
   * Requiere: Rol "Sistemas" (con validación de permisos)
   */
  async crear(req, res) {
    try {
      const datosNueva = req.body;
      const usuarioEmail = req.user?.email || 'usuario-desconocido@sistema.com';
      const usuarioId = req.user?.id || null;

      logger.info('Iniciando creación de remito:', {
        usuario: usuarioEmail,
        usuarioId,
        articulos: datosNueva.articulos?.length || 0
      });

      const remito = await remitoService.crear(datosNueva, usuarioEmail, { usuarioId });

      return success(res, {
        data: remito,
        message: `Remito ${remito.numero_remito} creado exitosamente`,
        statusCode: 201
      });
    } catch (err) {
      // Extraer información de línea y función del stack trace
      const stackLines = err.stack?.split('\n') || [];
      const lineaInfo = stackLines[1]?.trim() || 'Desconocida';

      logger.error('Error creando remito:', {
        error: err.message,
        linea: lineaInfo,
        stack: err.stack,
        usuario: req.user?.email || 'desconocido',
        body: req.body
      });

      return error(res, err.message || 'Error al crear el remito', 400);
    }
  }

  /**
   * GET /remitos
   * Listar remitos con filtros y paginación
   */
  async listar(req, res) {
    try {
      const filters = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        estado: req.query.estado || null,
        es_prestamo: req.query.es_prestamo || null,
        solicitante_id: req.query.solicitante_id || null,
        tecnico_id: req.query.tecnico_id || null,
        sede_origen_id: req.query.sede_origen_id || null,
        sede_destino_id: req.query.sede_destino_id || null
      };

      logger.info('Listando remitos:', { filters });

      const resultado = await remitoService.listar(filters);

      return paginated(res, resultado.rows, resultado.pagination, 'Remitos obtenidos correctamente');
    } catch (err) {
      logger.error('Error listando remitos:', err);
      return error(res, 'Error al obtener remitos', 500);
    }
  }

  /**
   * GET /remitos/:id
   * Obtener remito con detalles completos
   */
  async obtener(req, res) {
    try {
      const { id } = req.params;

      logger.info('Obteniendo remito:', { id });

      const remito = await remitoService.obtener(id);

      return success(res, remito, 'Remito obtenido correctamente');
    } catch (err) {
      logger.error('Error obteniendo remito:', err);

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      return error(res, 'Error al obtener remito', 500);
    }
  }

  /**
   * PATCH /remitos/:id/estado
   * Cambiar estado del remito
   * Solo Infraestructura puede realizar esta acción
   */
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const { Personal, Rol } = require('../../../models');

      if (!estado) {
        return error(res, 'El nuevo estado es requerido', 400);
      }

      // Buscar el usuario en la base de datos para obtener su rol
      const personal = await Personal.findOne({
        where: { email: req.user.email.toLowerCase(), activo: true },
        include: [{
          model: Rol,
          as: 'rol',
          attributes: ['nombre']
        }]
      });

      if (!personal) {
        logger.warn('Personal no encontrado para cambio de estado:', {
          email: req.user.email
        });
        return error(res, 'Usuario no registrado en el sistema', 404);
      }

      const usuarioId = personal.id;
      const userRoles = personal.rol ? [personal.rol.nombre] : [];

      logger.info('Cambiando estado de remito:', {
        remitoId: id,
        nuevoEstado: estado,
        usuarioId,
        email: req.user.email,
        roles: userRoles
      });

      const remito = await remitoService.cambiarEstado(id, estado, usuarioId, { userRoles });

      return success(res, remito, `Estado del remito actualizado a "${estado}"`);
    } catch (err) {
      logger.error('Error cambiando estado de remito:', err);

      if (err.message === 'El remito no existe') {
        return error(res, err.message, 404);
      }

      return error(res, err.message || 'Error al cambiar estado', 400);
    }
  }

  /**
   * POST /remitos/:id/devolver
   * Generar remito de devolución automático
   * Cuando se devuelven artículos préstamo
   */
  async generarDevolucion(req, res) {
    try {
      const { id: remitoOriginalId } = req.params;
      const { detalleIds } = req.body;
      const usuarioEmail = req.user.email;

      if (!Array.isArray(detalleIds) || detalleIds.length === 0) {
        return error(res, 'Debes seleccionar al menos un artículo a devolver', 400);
      }

      logger.info('Generando remito de devolución:', {
        remitoOriginalId,
        articulosADevolver: detalleIds.length,
        usuario: usuarioEmail
      });

      const remitoDevolucion = await remitoService.generarRemitoDevolucion(
        remitoOriginalId,
        detalleIds,
        usuarioEmail
      );

      return success(res, {
        data: remitoDevolucion,
        message: `Remito de devolución ${remitoDevolucion.numero_remito} creado exitosamente`,
        statusCode: 201
      });
    } catch (err) {
      logger.error('Error generando remito de devolución:', err);

      if (err.message === 'El remito original no existe') {
        return error(res, err.message, 404);
      }

      return error(res, err.message || 'Error al generar remito de devolución', 400);
    }
  }

  /**
   * GET /remitos/articulos-disponibles
   * Listar artículos disponibles para agregar a un remito
   * Filtra por tipo_articulo_id y sede_id con paginación
   */
  async obtenerArticulosDisponibles(req, res) {
    try {
      const { tipo_articulo_id, sede_id, page = 1, limit = 50 } = req.query;

      if (!sede_id) {
        return error(res, 'La sede es requerida', 400);
      }

      logger.info('Obteniendo artículos disponibles:', {
        tipoArticuloId: tipo_articulo_id,
        sedeId: sede_id,
        page,
        limit
      });

      const { Inventario, TipoArticulo } = require('../../../models');
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = {
        sede_id,
        activo: true
      };

      if (tipo_articulo_id) {
        whereClause.tipo_articulo_id = tipo_articulo_id;
      }

      const { count, rows } = await Inventario.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'codigo', 'marca', 'modelo', 'numero_serie', 'estado', 'tipo_articulo_id'],
        include: [{
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre']
        }],
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']]
      });

      return success(res, {
        data: rows,
        total: count,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        },
        message: 'Artículos disponibles obtenidos correctamente'
      });
    } catch (err) {
      logger.error('Error obteniendo artículos disponibles:', err);
      return error(res, 'Error al obtener artículos', 500);
    }
  }
}

module.exports = new RemitoController();
