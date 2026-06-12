// src/modules/inventario/services/inventarioService.js
import { Inventario, TipoArticulo, Sede, HistorialMovimiento, sequelize, RemitoDetalle, Remito, Garantia } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import { Op } from 'sequelize';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';
import CommonValidators from '../../../shared/validators/commonValidators.js';
import garantiaService from './garantiaService.js';

class InventarioService {
  /**
   * Validar que el número de serie sea único (si se proporciona)
   */
  async validarNumeroSerieUnico(numeroSerie, inventarioIdExcluir = null) {
    if (!numeroSerie) return;

    const whereClause = { numero_serie: numeroSerie.trim() };
    if (inventarioIdExcluir) {
      whereClause.id = { [Op.ne]: inventarioIdExcluir };
    }

    const itemExistente = await Inventario.findOne({ where: whereClause });
    if (itemExistente) {
      throw new Error(`Ya existe un item con el número de serie \"${numeroSerie}\". Los números de serie deben ser únicos.`);
    }
  }

  async validarImeiUnico(imei, inventarioIdExcluir = null) {
    if (!imei) return;

    const whereClause = { imei: imei.trim() };
    if (inventarioIdExcluir) {
      whereClause.id = { [Op.ne]: inventarioIdExcluir };
    }

    const itemExistente = await Inventario.findOne({ where: whereClause });
    if (itemExistente) {
      throw new Error(`Ya existe un equipo con el IMEI \"${imei}\" en el sistema.`);
    }
  }

  /**
   * Listar inventario con paginación y filtros
   */
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      sede_id = null,
      tipo_articulo_id = null,
      estado = null,
      disponible_solo = false,
      activo = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Por defecto, mostrar solo items activos
    if (activo !== null && activo !== undefined) {
      whereClause.activo = activo === 'true' || activo === true;
    } else {
      whereClause.activo = true;
    }

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

    if (disponible_solo === 'true' || disponible_solo === true) {
      whereClause.estado = 'disponible';
    }

    const { count, rows } = await Inventario.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre', 'descripcion']
        },
        {
          model: Sede,
          as: 'sedePrincipal',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['marca', 'ASC'], ['modelo', 'ASC']],
      distinct: true
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

    return {
      rows: inventarioConInfo,
      count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    };
  }

  /**
   * Obtener item específico con detalles completos
   */
  async obtenerConDetalles(inventarioId) {
    const item = await Inventario.findByPk(inventarioId, {
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre', 'descripcion']
        },
        {
          model: Sede,
          as: 'sedePrincipal',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
        },
        {
          model: Garantia,
          as: 'garantias',
          order: [['fecha_fin', 'DESC']]
        },
        {
          model: HistorialMovimiento,
          as: 'historialMovimientosInventario',
          include: [
            {
              model: Sede,
              as: 'sedeOrigenMovimiento',
              attributes: ['id', 'nombre_sede']
            },
            {
              model: Sede,
              as: 'sedeDestinoMovimiento',
              attributes: ['id', 'nombre_sede']
            },
            {
              model: Remito,
              as: 'remitoMovimiento',
              attributes: ['id', 'numero_remito'],
              required: false
            }
          ],
          order: [['fecha_movimiento', 'DESC']],
          limit: 20
        }
      ]
    });

    if (!item) {
      return null;
    }

    const itemJson = item.toJSON();

    // Agregar resumen de garantía
    if (itemJson.garantias && itemJson.garantias.length > 0) {
      const activas = itemJson.garantias.filter(g => g.estado === 'activa');
      const diasRestantes = item.garantia_fecha_fin
        ? Math.ceil((new Date(item.garantia_fecha_fin) - new Date()) / (1000 * 60 * 60 * 24))
        : null;
      itemJson.resumenGarantia = {
        total: itemJson.garantias.length,
        activas: activas.length,
        mejorFechaFin: item.garantia_fecha_fin || null,
        diasRestantes
      };
    }

    // Si el artículo está en préstamo, buscar el remito activo
    if (item.estado === 'en_prestamo') {
      // RemitoDetalle, Remito y Sede ya importados al inicio del archivo

      const prestamoActivo = await RemitoDetalle.findOne({
        where: {
          inventario_id: inventarioId,
          es_prestamo: true,
          devuelto: false
        },
        include: [
          {
            model: Remito,
            as: 'remito',
            where: {
              estado: {
                [Op.in]: ['preparado', 'en_transito', 'entregado', 'completado']
              }
            },
            include: [
              {
                model: Sede,
                as: 'sedeDestino',
                attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
              },
              {
                model: Sede,
                as: 'sedeOrigen',
                attributes: ['id', 'nombre_sede', 'localidad']
              }
            ]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      if (prestamoActivo) {
        itemJson.prestamoActivo = {
          numeroRemito: prestamoActivo.remito.numero_remito,
          estado: prestamoActivo.remito.estado,
          sedeDestino: prestamoActivo.remito.sedeDestino,
          sedeOrigen: prestamoActivo.remito.sedeOrigen,
          fechaDevolucionEsperada: prestamoActivo.fecha_devolucion_esperada,
          observaciones: prestamoActivo.observaciones
        };
      }
    }

    return itemJson;
  }

  /**
   * Crear nuevo item de inventario (con transacción y auditoría)
   */
  async crear(datosNuevo, usuarioEmail, metadatos = {}) {
    const {
      tipo_articulo_id,
      marca,
      modelo,
      numero_serie,
      imei,
      service_tag,
      sede_id,
      estado = 'disponible',
      fecha_adquisicion,
      valor_adquisicion,
      observaciones,
      procesador,
      memoria,
      disco,
      sistema_operativo,
      pulgadas,
      tipo_conector,
      puertos_ethernet,
      puertos_sfp,
      poe,
      categoria_id
    } = datosNuevo;

    // Validaciones previas (fuera de la transacción)
    await CommonValidators.validarTipoArticuloActivo(tipo_articulo_id);
    await CommonValidators.validarSedeActiva(sede_id);
    await this.validarNumeroSerieUnico(numero_serie);
    await this.validarImeiUnico(imei);

    // Guardar datos para auditoría
    const datosAuditoria = {
      marca: marca.trim(),
      modelo: modelo.trim(),
      numero_serie: numero_serie?.trim(),
      service_tag: service_tag?.trim(),
      tipo_articulo: 'Inventario',
      sede_id,
      estado,
      fecha_adquisicion,
      valor_adquisicion,
      observaciones: observaciones?.trim(),
      procesador: procesador?.trim(),
      memoria: memoria?.trim(),
      disco: disco?.trim(),
      sistema_operativo: sistema_operativo?.trim(),
      pulgadas: pulgadas?.trim(),
      tipo_conector: tipo_conector?.trim(),
      puertos_ethernet,
      puertos_sfp,
      poe
    };

    // Ejecutar dentro de transacción con auditoría
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        // Crear item
        const nuevoItem = await Inventario.create({
          tipo_articulo_id,
          marca: marca.trim(),
          modelo: modelo.trim(),
          numero_serie: numero_serie?.trim() || null,
          imei: imei?.trim() || null,
          service_tag: service_tag?.trim() || null,
          sede_id: sede_id || null,
          estado,
          fecha_adquisicion,
          valor_adquisicion,
          observaciones: observaciones?.trim() || null,
          procesador: procesador?.trim() || null,
          memoria: memoria?.trim() || null,
          disco: disco?.trim() || null,
          sistema_operativo: sistema_operativo?.trim() || null,
          pulgadas: pulgadas?.trim() || null,
          tipo_conector: tipo_conector?.trim() || null,
          puertos_ethernet: puertos_ethernet || null,
          puertos_sfp: puertos_sfp || null,
          poe: poe || false,
          categoria_id: categoria_id || null,
          activo: true
        }, { transaction });

        // Crear registro en historial
        await HistorialMovimiento.create({
          inventario_id: nuevoItem.id,
          sede_origen_id: sede_id,
          sede_destino_id: sede_id,
          tipo_movimiento: 'asignacion',
          fecha_movimiento: new Date(),
          observaciones: 'Item agregado al inventario'
        }, { transaction });

        logger.info('Nuevo item de inventario creado:', {
          inventarioId: nuevoItem.id,
          descripcion: nuevoItem.getDescripcionCompleta(),
          sede_id,
          creadoPor: usuarioEmail
        });

        return await this.obtenerConDetalles(nuevoItem.id);
      },
      usuarioEmail,
      modulo: 'inventario',
      accion: 'crear',
      recurso: 'Inventario',
      recursoId: null,
      descripcion: `Nuevo item: ${marca} ${modelo}`,
      valoresAnteriores: null,
      valoresNuevos: datosAuditoria,
      ipAddress: metadatos?.ipAddress,
      userAgent: metadatos?.userAgent
    });

    // Fire-and-forget: consultar garantía si hay identificador
    const itemCreado = resultado.data;
    if (itemCreado?.id && (numero_serie || service_tag)) {
      garantiaService.consultarYGuardar(itemCreado.id).catch(err => {
        logger.error('Error en consulta de garantía fire-and-forget:', {
          inventarioId: itemCreado.id,
          error: err.message
        });
      });
    }

    return itemCreado;
  }

  /**
   * Actualizar item de inventario (con transacción y auditoría)
   */
  async actualizar(inventarioId, datosActualizacion, usuarioEmail, metadatos = {}) {
    const item = await Inventario.findByPk(inventarioId);

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    // Guardar valores anteriores para auditoría
    const valoresAnteriores = {
      tipo_articulo_id: item.tipo_articulo_id,
      marca: item.marca,
      modelo: item.modelo,
      numero_serie: item.numero_serie,
      service_tag: item.service_tag,
      sede_id: item.sede_id,
      estado: item.estado,
      fecha_adquisicion: item.fecha_adquisicion,
      valor_adquisicion: item.valor_adquisicion,
      observaciones: item.observaciones,
      procesador: item.procesador,
      memoria: item.memoria,
      disco: item.disco,
      sistema_operativo: item.sistema_operativo,
      pulgadas: item.pulgadas,
      tipo_conector: item.tipo_conector,
      puertos_ethernet: item.puertos_ethernet,
      puertos_sfp: item.puertos_sfp,
      poe: item.poe
    };

    // Validaciones previas (fuera de la transacción)
    if (datosActualizacion.tipo_articulo_id && datosActualizacion.tipo_articulo_id !== item.tipo_articulo_id) {
      await CommonValidators.validarTipoArticuloActivo(datosActualizacion.tipo_articulo_id);
    }

    if (datosActualizacion.numero_serie && datosActualizacion.numero_serie !== item.numero_serie) {
      await this.validarNumeroSerieUnico(datosActualizacion.numero_serie, inventarioId);
    }

    if (datosActualizacion.imei && datosActualizacion.imei !== item.imei) {
      await this.validarImeiUnico(datosActualizacion.imei, inventarioId);
    }

    let sedeAnterior = null;
    if (datosActualizacion.sede_id && datosActualizacion.sede_id !== item.sede_id) {
      await CommonValidators.validarSedeActiva(datosActualizacion.sede_id);
      sedeAnterior = item.sede_id;
    }

    // Limpiar datos
    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      if (typeof datosActualizacion[key] === 'string') {
        datosLimpios[key] = datosActualizacion[key].trim();
      } else {
        datosLimpios[key] = datosActualizacion[key];
      }
    });

    // Guardar datos nuevos para auditoría
    const valoresNuevos = { ...valoresAnteriores, ...datosLimpios };

    // Ejecutar dentro de transacción con auditoría
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        // Actualizar item
        await item.update(datosLimpios, { transaction });

        // Crear historial de movimiento si cambió de sede
        if (sedeAnterior) {
          await HistorialMovimiento.create({
            inventario_id: inventarioId,
            sede_origen_id: sedeAnterior,
            sede_destino_id: datosActualizacion.sede_id,
            tipo_movimiento: 'transferencia',
            fecha_movimiento: new Date(),
            observaciones: 'Transferencia manual de sede'
          }, { transaction });
        }

        logger.info('Item de inventario actualizado:', {
          inventarioId: item.id,
          cambios: Object.keys(datosLimpios),
          actualizadoPor: usuarioEmail
        });

        return await this.obtenerConDetalles(inventarioId);
      },
      usuarioEmail,
      modulo: 'inventario',
      accion: 'actualizar',
      recurso: 'Inventario',
      recursoId: inventarioId,
      descripcion: `Actualización: ${Object.keys(datosLimpios).join(', ')}`,
      valoresAnteriores,
      valoresNuevos,
      ipAddress: metadatos?.ipAddress,
      userAgent: metadatos?.userAgent
    });

    return resultado.data;
  }

  /**
   * Cambiar estado de un item (con transacción y auditoría)
   */
  async cambiarEstado(inventarioId, nuevoEstado, observaciones = null, usuarioEmail = null, metadatos = {}) {
    const item = await Inventario.findByPk(inventarioId);

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    const estadoAnterior = item.estado;
    if (nuevoEstado === estadoAnterior) {
      throw new Error('El nuevo estado es igual al actual');
    }

    // Guardar valores para auditoría
    const valoresAnteriores = { estado: estadoAnterior };
    const valoresNuevos = { estado: nuevoEstado };

    // Ejecutar dentro de transacción con auditoría
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        // Cambiar estado
        await item.update({ estado: nuevoEstado }, { transaction });

        // Crear registro en historial si hay cambio significativo
        if (['mantenimiento', 'dado_de_baja'].includes(nuevoEstado)) {
          await HistorialMovimiento.create({
            inventario_id: inventarioId,
            sede_origen_id: item.sede_id,
            sede_destino_id: item.sede_id,
            tipo_movimiento: 'mantenimiento',
            fecha_movimiento: new Date(),
            observaciones: observaciones || `Cambio de estado: ${estadoAnterior} -> ${nuevoEstado}`
          }, { transaction });
        }

        logger.info('Estado de inventario cambiado:', {
          inventarioId: item.id,
          estadoAnterior,
          estadoNuevo: nuevoEstado,
          cambiadoPor: usuarioEmail
        });

        return {
          id: item.id,
          estadoAnterior,
          estadoNuevo: nuevoEstado,
          fechaCambio: new Date()
        };
      },
      usuarioEmail,
      modulo: 'inventario',
      accion: 'cambiar_estado',
      recurso: 'Inventario',
      recursoId: inventarioId,
      descripcion: `Cambio de estado: ${estadoAnterior} -> ${nuevoEstado}${observaciones ? ` (${observaciones})` : ''}`,
      valoresAnteriores,
      valoresNuevos,
      ipAddress: metadatos?.ipAddress,
      userAgent: metadatos?.userAgent
    });

    return resultado.data;
  }

  /**
   * Eliminar item (soft delete - con transacción y auditoría)
   */
  async eliminar(inventarioId, usuarioEmail, metadatos = {}) {
    const item = await Inventario.findByPk(inventarioId);

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    // Guardar valores para auditoría
    const valoresAnteriores = {
      activo: item.activo,
      estado: item.estado,
      descripcion: item.getDescripcionCompleta()
    };
    const valoresNuevos = {
      activo: false,
      estado: 'dado_de_baja'
    };

    // Ejecutar dentro de transacción con auditoría
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => {
        // Soft delete
        await item.update({ activo: false, estado: 'dado_de_baja' }, { transaction });

        // Crear registro en historial
        await HistorialMovimiento.create({
          inventario_id: inventarioId,
          sede_origen_id: item.sede_id,
          sede_destino_id: item.sede_id,
          tipo_movimiento: 'mantenimiento',
          fecha_movimiento: new Date(),
          observaciones: 'Item dado de baja'
        }, { transaction });

        logger.info('Item de inventario eliminado (soft delete):', {
          inventarioId: item.id,
          descripcion: item.getDescripcionCompleta(),
          eliminadoPor: usuarioEmail
        });

        return true;
      },
      usuarioEmail,
      modulo: 'inventario',
      accion: 'eliminar',
      recurso: 'Inventario',
      recursoId: inventarioId,
      descripcion: `Soft delete: ${item.getDescripcionCompleta()}`,
      valoresAnteriores,
      valoresNuevos,
      ipAddress: metadatos?.ipAddress,
      userAgent: metadatos?.userAgent
    });

    return resultado.data;
  }

  /**
   * Buscar items de inventario rápidamente
   */
  async buscar(termino, filtros = {}) {
    const { limite = 20, sede_id = null, tipo_articulo_id = null, disponible_solo = false } = filtros;

    const whereClause = {
      activo: true,
      [Op.or]: [
        { marca: { [Op.iLike]: `%${termino}%` } },
        { modelo: { [Op.iLike]: `%${termino}%` } },
        { numero_serie: { [Op.iLike]: `%${termino}%` } },
        { service_tag: { [Op.iLike]: `%${termino}%` } }
      ]
    };

    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    if (tipo_articulo_id) {
      whereClause.tipo_articulo_id = tipo_articulo_id;
    }

    if (disponible_solo === 'true' || disponible_solo === true) {
      whereClause.estado = 'disponible';
    }

    const resultados = await Inventario.findAll({
      where: whereClause,
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre']
        },
        {
          model: Sede,
          as: 'sedePrincipal',
          attributes: ['id', 'nombre_sede']
        }
      ],
      limit: parseInt(limite),
      order: [['marca', 'ASC'], ['modelo', 'ASC']]
    });

    return resultados.map(item => ({
      id: item.id,
      identificacion: item.getIdentificacion(),
      descripcionCompleta: item.getDescripcionCompleta(),
      estado: item.estado,
      disponible: item.estaDisponible(),
      tipoArticulo: item.tipoArticulo,
      sede: item.sede
    }));
  }

  /**
   * Obtener items disponibles de una sede
   */
  async obtenerDisponiblesPorSede(sedeId) {
    return await Inventario.findAll({
      where: {
        sede_id: sedeId,
        estado: 'disponible',
        activo: true
      },
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['marca', 'ASC'], ['modelo', 'ASC']]
    });
  }

  /**
   * Obtener todos los items de una sede
   */
  async obtenerPorSede(sedeId) {
    return await Inventario.findAll({
      where: {
        sede_id: sedeId,
        activo: true
      },
      include: [
        {
          model: TipoArticulo,
          as: 'tipoArticulo',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['estado', 'ASC'], ['marca', 'ASC']]
    });
  }

  /**
   * Obtener historial de movimientos de un item
   */
  async obtenerHistorial(inventarioId, limite = 50) {
    const item = await Inventario.findByPk(inventarioId);
    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    const historial = await HistorialMovimiento.findAll({
      where: { inventario_id: inventarioId },
      include: [
        {
          model: Sede,
          as: 'sedeOrigenMovimiento',
          attributes: ['id', 'nombre_sede']
        },
        {
          model: Sede,
          as: 'sedeDestinoMovimiento',
          attributes: ['id', 'nombre_sede']
        },
        {
          model: Remito,
          as: 'remitoMovimiento',
          attributes: ['id', 'numero_remito'],
          required: false
        }
      ],
      order: [['fecha_movimiento', 'DESC']],
      limit: parseInt(limite)
    });

    return {
      item: {
        id: item.id,
        descripcion: item.getDescripcionCompleta(),
        identificacion: item.getIdentificacion()
      },
      historial
    };
  }

  /**
   * Obtener estadísticas generales del inventario (excluir sedes de prueba)
   * Optimizado para reducir queries (5 → 1)
   */
  async obtenerEstadisticasGenerales(sedeId = null) {
    const whereClause = { activo: true };
    if (sedeId) {
      whereClause.sede_id = sedeId;
    }

    // Include común para excluir sedes de prueba
    const includeSede = [{
      model: Sede,
      as: 'sedePrincipal',
      where: { es_prueba: false },
      attributes: [],
      required: true
    }];

    // UNA SOLA query con agregaciones condicionales (excluir sedes de prueba)
    const estadisticas = await Inventario.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('Inventario.id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN \"Inventario\".\"estado\" = 'disponible' THEN 1 END")), 'disponible'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN \"Inventario\".\"estado\" = 'en_uso' THEN 1 END")), 'enUso'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN \"Inventario\".\"estado\" = 'mantenimiento' THEN 1 END")), 'mantenimiento'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN \"Inventario\".\"estado\" = 'dado_de_baja' THEN 1 END")), 'dadoDeBaja']
      ],
      where: whereClause,
      include: includeSede,
      raw: true
    });

    const resumen = estadisticas[0] || {};
    const totalPersonal = parseInt(resumen.total) || 0;
    const disponible = parseInt(resumen.disponible) || 0;
    const enUso = parseInt(resumen.enUso) || 0;
    const mantenimiento = parseInt(resumen.mantenimiento) || 0;
    const dadoDeBaja = parseInt(resumen.dadoDeBaja) || 0;

    // Estadísticas por tipo de artículo (excluir sedes de prueba)
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
        },
        {
          model: Sede,
          as: 'sedePrincipal',
          attributes: [],
          where: { es_prueba: false },
          required: true
        }
      ],
      where: whereClause,
      group: ['tipo_articulo_id', 'tipoArticulo.id'],
      order: [[sequelize.literal('total'), 'DESC']],
      raw: true,
      subQuery: false
    });

    // Estadísticas por sede (excluir sedes de prueba)
    const porSede = await Inventario.findAll({
      attributes: [
        'sede_id',
        [sequelize.fn('COUNT', sequelize.col('Inventario.id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN \"Inventario\".\"estado\" = 'disponible' THEN 1 END")), 'disponible']
      ],
      include: [
        {
          model: Sede,
          as: 'sedePrincipal',
          attributes: ['nombre_sede'],
          where: { es_prueba: false },
          required: true
        }
      ],
      where: whereClause,
      group: ['sede_id', 'sedePrincipal.id'],
      order: [[sequelize.literal('total'), 'DESC']],
      raw: true,
      subQuery: false
    });

    return {
      resumen: {
        total: totalPersonal,
        disponible,
        enUso,
        mantenimiento,
        dadoDeBaja
      },
      porTipo,
      porSede
    };
  }
}

export default new InventarioService();
