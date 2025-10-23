// src/modules/inventario/controllers/inventarioController.js
const { Inventario, TipoArticulo, Sede, HistorialMovimiento, RemitoDetalle, sequelize } = require('../../../models');
const { success, error, paginated } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class InventarioController {
  /**
   * Listar inventario con paginación y filtros
   */
  listar = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      sede_id = null,
      tipo_articulo_id = null,
      estado = null,
      disponible_solo = false 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { activo: true };

    // Filtro de búsqueda
    if (search) {
      whereClause[Op.or] = [
        { marca: { [Op.iLike]: `%${search}%` } },
        { modelo: { [Op.iLike]: `%${search}%` } },
        { numero_serie: { [Op.iLike]: `%${search}%` } },
        { service_tag: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Filtros específicos
    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    if (tipo_articulo_id) {
      whereClause.tipo_articulo_id = tipo_articulo_id;
    }

    if (estado) {
      whereClause.estado = estado;
    }

    if (disponible_solo === 'true') {
      whereClause.estado = 'disponible';
    }

    const { count, rows } = await Inventario.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['marca', 'ASC'], ['modelo', 'ASC']],
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre', 'descripcion']
        },
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_empresa', 'nombre_sede', 'localidad']
        }
      ]
    });

    // Agregar información adicional a cada item
    const inventarioConInfo = rows.map(item => {
      const itemJson = item.toJSON();
      return {
        ...itemJson,
        identificacion: item.getIdentificacion(),
        descripcionCompleta: item.getDescripcionCompleta(),
        disponible: item.estaDisponible()
      };
    });

    paginated(res, inventarioConInfo, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count
    }, 'Inventario obtenido correctamente');
  });

  /**
   * Obtener item específico con historial completo
   */
  obtener = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const item = await Inventario.findByPk(id, {
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo'
        },
        {
          model: Sede,
          as: 'sede'
        },
        {
          model: HistorialMovimiento,
          as: 'historialMovimientos',
          include: [
            {
              model: Sede,
              as: 'sedeOrigen',
              attributes: ['nombre_empresa', 'nombre_sede']
            },
            {
              model: Sede,
              as: 'sedeDestino',
              attributes: ['nombre_empresa', 'nombre_sede']
            }
          ],
          order: [['fecha_movimiento', 'DESC']],
          limit: 20
        },
        {
          model: RemitoDetalle,
          as: 'detallesRemito',
          include: [
            {
              model: require('../../../models').Remito,
              as: 'remito',
              attributes: ['numero_remito', 'fecha', 'estado']
            }
          ],
          where: { es_prestamo: true, devuelto: false },
          required: false
        }
      ]
    });

    if (!item) {
      return error(res, 'Item de inventario no encontrado', 404);
    }

    // Verificar si está en préstamo
    const enPrestamo = item.detallesRemito && item.detallesRemito.length > 0;
    const prestamoActual = enPrestamo ? item.detallesRemito[0] : null;

    const itemCompleto = {
      ...item.toJSON(),
      identificacion: item.getIdentificacion(),
      descripcionCompleta: item.getDescripcionCompleta(),
      disponible: item.estaDisponible(),
      enPrestamo,
      prestamoActual: prestamoActual ? {
        remito: prestamoActual.remito.numero_remito,
        fechaRemito: prestamoActual.remito.fecha,
        fechaDevolucionEsperada: prestamoActual.fecha_devolucion_esperada,
        vencido: prestamoActual.estaVencido()
      } : null
    };

    success(res, itemCompleto, 'Item de inventario obtenido correctamente');
  });

  /**
   * Crear nuevo item de inventario
   */
  crear = asyncHandler(async (req, res) => {
    const {
      tipo_articulo_id,
      marca,
      modelo,
      numero_serie,
      service_tag,
      sede_id,
      estado = 'disponible',
      fecha_adquisicion,
      valor_adquisicion,
      observaciones
    } = req.body;

    // Verificar si ya existe el número de serie (si se proporciona)
    if (numero_serie) {
      const itemExistente = await Inventario.findOne({
        where: { numero_serie: numero_serie.trim() }
      });

      if (itemExistente) {
        return error(res, 'Ya existe un item con este número de serie', 409);
      }
    }

    // Verificar que el tipo de artículo existe
    const tipoArticulo = await TipoArticulo.findOne({
      where: { id: tipo_articulo_id, activo: true }
    });

    if (!tipoArticulo) {
      return error(res, 'Tipo de artículo no encontrado o inactivo', 404);
    }

    // Verificar que la sede existe
    const sede = await Sede.findOne({
      where: { id: sede_id, activo: true }
    });

    if (!sede) {
      return error(res, 'Sede no encontrada o inactiva', 404);
    }

    const nuevoItem = await Inventario.create({
      tipo_articulo_id,
      marca: marca.trim(),
      modelo: modelo.trim(),
      numero_serie: numero_serie?.trim(),
      service_tag: service_tag?.trim(),
      sede_id,
      estado,
      fecha_adquisicion,
      valor_adquisicion,
      observaciones: observaciones?.trim()
    });

    // Crear registro en historial
    await HistorialMovimiento.create({
      inventario_id: nuevoItem.id,
      sede_origen_id: sede_id,
      sede_destino_id: sede_id,
      tipo_movimiento: 'asignacion',
      fecha_movimiento: new Date(),
      observaciones: 'Item agregado al inventario'
    });

    // Obtener item creado con relaciones
    const itemCompleto = await Inventario.findByPk(nuevoItem.id, {
      include: ['tipoArticulo', 'sede']
    });

    logger.info('Nuevo item de inventario creado:', {
      inventarioId: nuevoItem.id,
      descripcion: nuevoItem.getDescripcionCompleta(),
      sede: sede.getFullName(),
      creadoPor: req.user.email
    });

    success(res, itemCompleto, 'Item de inventario creado correctamente', 201);
  });

  /**
   * Actualizar item de inventario
   */
  actualizar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const datosActualizacion = req.body;

    const item = await Inventario.findByPk(id);

    if (!item) {
      return error(res, 'Item de inventario no encontrado', 404);
    }

    // Si se está cambiando número de serie, verificar unicidad
    if (datosActualizacion.numero_serie) {
      const itemExistente = await Inventario.findOne({
        where: {
          numero_serie: datosActualizacion.numero_serie.trim(),
          id: { [Op.ne]: id }
        }
      });

      if (itemExistente) {
        return error(res, 'Ya existe un item con este número de serie', 409);
      }
    }

    // Si se está cambiando tipo de artículo, verificar que existe
    if (datosActualizacion.tipo_articulo_id) {
      const tipoArticulo = await TipoArticulo.findOne({
        where: { id: datosActualizacion.tipo_articulo_id, activo: true }
      });

      if (!tipoArticulo) {
        return error(res, 'Tipo de artículo no encontrado o inactivo', 404);
      }
    }

    // Si se está cambiando sede, verificar que existe y crear historial
    if (datosActualizacion.sede_id && datosActualizacion.sede_id !== item.sede_id) {
      const nuevaSede = await Sede.findOne({
        where: { id: datosActualizacion.sede_id, activo: true }
      });

      if (!nuevaSede) {
        return error(res, 'Nueva sede no encontrada o inactiva', 404);
      }

      // Crear registro en historial de movimiento
      await HistorialMovimiento.create({
        inventario_id: id,
        sede_origen_id: item.sede_id,
        sede_destino_id: datosActualizacion.sede_id,
        tipo_movimiento: 'transferencia',
        fecha_movimiento: new Date(),
        observaciones: 'Transferencia manual de sede'
      });
    }

    // Limpiar datos de entrada
    Object.keys(datosActualizacion).forEach(key => {
      if (typeof datosActualizacion[key] === 'string') {
        datosActualizacion[key] = datosActualizacion[key].trim();
      }
    });

    await item.update(datosActualizacion);

    logger.info('Item de inventario actualizado:', {
      inventarioId: item.id,
      cambios: Object.keys(datosActualizacion),
      actualizadoPor: req.user.email
    });

    // Obtener item actualizado con relaciones
    const itemActualizado = await Inventario.findByPk(id, {
      include: ['tipoArticulo', 'sede']
    });

    success(res, itemActualizado, 'Item de inventario actualizado correctamente');
  });

  /**
   * Eliminar item de inventario (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const item = await Inventario.findByPk(id);

    if (!item) {
      return error(res, 'Item de inventario no encontrado', 404);
    }

    // Verificar si tiene préstamos activos
    const prestamosActivos = await RemitoDetalle.count({
      where: {
        inventario_id: id,
        es_prestamo: true,
        devuelto: false
      }
    });

    if (prestamosActivos > 0) {
      return error(res, 
        'No se puede eliminar el item. Tiene préstamos activos pendientes de devolución', 
        409
      );
    }

    await item.update({ activo: false, estado: 'dado_de_baja' });

    // Crear registro en historial
    await HistorialMovimiento.create({
      inventario_id: id,
      sede_origen_id: item.sede_id,
      sede_destino_id: item.sede_id,
      tipo_movimiento: 'mantenimiento',
      fecha_movimiento: new Date(),
      observaciones: 'Item dado de baja'
    });

    logger.info('Item de inventario eliminado (soft delete):', {
      inventarioId: item.id,
      descripcion: item.getDescripcionCompleta(),
      eliminadoPor: req.user.email
    });

    success(res, null, 'Item de inventario eliminado correctamente');
  });

  /**
   * Cambiar estado de un item
   */
  cambiarEstado = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { estado, observaciones } = req.body;

    const item = await Inventario.findByPk(id, {
      include: ['sede']
    });

    if (!item) {
      return error(res, 'Item de inventario no encontrado', 404);
    }

    const estadoAnterior = item.estado;

    await item.update({ estado });

    // Crear registro en historial si hay cambio significativo
    if (['mantenimiento', 'dado_de_baja'].includes(estado)) {
      await HistorialMovimiento.create({
        inventario_id: id,
        sede_origen_id: item.sede_id,
        sede_destino_id: item.sede_id,
        tipo_movimiento: 'mantenimiento',
        fecha_movimiento: new Date(),
        observaciones: observaciones || `Cambio de estado: ${estadoAnterior} -> ${estado}`
      });
    }

    logger.info('Estado de inventario cambiado:', {
      inventarioId: item.id,
      estadoAnterior,
      estadoNuevo: estado,
      cambiadoPor: req.user.email
    });

    success(res, {
      id: item.id,
      estadoAnterior,
      estadoNuevo: estado,
      fechaCambio: new Date()
    }, 'Estado del item cambiado correctamente');
  });

  /**
   * Obtener historial de movimientos de un item
   */
  obtenerHistorial = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limite = 50 } = req.query;

    const item = await Inventario.findByPk(id);
    if (!item) {
      return error(res, 'Item de inventario no encontrado', 404);
    }

    const historial = await HistorialMovimiento.findAll({
      where: { inventario_id: id },
      include: [
        {
          model: Sede,
          as: 'sedeOrigen',
          attributes: ['nombre_empresa', 'nombre_sede']
        },
        {
          model: Sede,
          as: 'sedeDestino',
          attributes: ['nombre_empresa', 'nombre_sede']
        },
        {
          model: require('../../../models').Personal,
          as: 'usuario',
          attributes: ['nombre', 'apellido'],
          required: false
        }
      ],
      order: [['fecha_movimiento', 'DESC']],
      limit: parseInt(limite)
    });

    success(res, {
      item: {
        id: item.id,
        descripcion: item.getDescripcionCompleta(),
        identificacion: item.getIdentificacion()
      },
      historial
    }, 'Historial de movimientos obtenido correctamente');
  });

  /**
   * Obtener estadísticas del inventario
   */
  obtenerEstadisticas = asyncHandler(async (req, res) => {
    const { sede_id = null } = req.query;

    const whereClause = { activo: true };
    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    const estadisticas = {
      resumen: {
        total: await Inventario.count({ where: whereClause }),
        disponible: await Inventario.count({ 
          where: { ...whereClause, estado: 'disponible' } 
        }),
        enUso: await Inventario.count({ 
          where: { ...whereClause, estado: 'en_uso' } 
        }),
        mantenimiento: await Inventario.count({ 
          where: { ...whereClause, estado: 'mantenimiento' } 
        }),
        dadoDeBaja: await Inventario.count({ 
          where: { ...whereClause, estado: 'dado_de_baja' } 
        })
      }
    };

    // Estadísticas por tipo de artículo
    const porTipo = await Inventario.findAll({
      attributes: [
        'tipo_articulo_id',
        [sequelize.fn('COUNT', sequelize.col('Inventario.id')), 'total']
      ],
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['nombre']
        }
      ],
      where: whereClause,
      group: ['tipo_articulo_id', 'tipoArticulo.id'],
      order: [[sequelize.literal('total'), 'DESC']]
    });

    // Estadísticas por sede
    const porSede = await Inventario.findAll({
      attributes: [
        'sede_id',
        [sequelize.fn('COUNT', sequelize.col('Inventario.id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN estado = 'disponible' THEN 1 END")), 'disponible']
      ],
      include: [
        {
          model: Sede,
          as: 'sede',
          attributes: ['nombre_empresa', 'nombre_sede']
        }
      ],
      where: whereClause,
      group: ['sede_id', 'sede.id'],
      order: [[sequelize.literal('total'), 'DESC']]
    });

    estadisticas.porTipo = porTipo;
    estadisticas.porSede = porSede;

    success(res, estadisticas, 'Estadísticas de inventario obtenidas correctamente');
  });

  /**
   * Buscar items de inventario
   */
  buscar = asyncHandler(async (req, res) => {
    const { 
      termino, 
      sede_id = null, 
      tipo_articulo_id = null, 
      disponible_solo = false,
      limite = 20 
    } = req.query;

    if (!termino || termino.trim().length < 2) {
      return error(res, 'El término de búsqueda debe tener al menos 2 caracteres', 400);
    }

    const whereClause = {
      activo: true,
      [Op.or]: [
        { marca: { [Op.iLike]: `%${termino.trim()}%` } },
        { modelo: { [Op.iLike]: `%${termino.trim()}%` } },
        { numero_serie: { [Op.iLike]: `%${termino.trim()}%` } },
        { service_tag: { [Op.iLike]: `%${termino.trim()}%` } }
      ]
    };

    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    if (tipo_articulo_id) {
      whereClause.tipo_articulo_id = tipo_articulo_id;
    }

    if (disponible_solo === 'true') {
      whereClause.estado = 'disponible';
    }

    const resultados = await Inventario.findAll({
      where: whereClause,
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['nombre']
        },
        {
          model: Sede,
          as: 'sede',
          attributes: ['nombre_empresa', 'nombre_sede']
        }
      ],
      order: [['marca', 'ASC'], ['modelo', 'ASC']],
      limit: parseInt(limite)
    });

    success(res, {
      resultados: resultados.map(item => ({
        id: item.id,
        descripcionCompleta: item.getDescripcionCompleta(),
        identificacion: item.getIdentificacion(),
        estado: item.estado,
        disponible: item.estaDisponible(),
        tipoArticulo: item.tipoArticulo,
        sede: item.sede
      })),
      criterios: {
        termino,
        sede_id,
        tipo_articulo_id,
        disponible_solo,
        limite: parseInt(limite)
      },
      total: resultados.length
    }, 'Búsqueda de inventario completada');
  });
}

module.exports = new InventarioController();