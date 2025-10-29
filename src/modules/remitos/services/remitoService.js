// src/modules/remitos/services/remitoService.js
const {
  Remito,
  RemitoDetalle,
  Inventario,
  HistorialMovimiento,
  Personal,
  Sede,
  sequelize
} = require('../../../models');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class RemitoService {
  /**
   * Generar número de remito único con formato REM-YYYY-NNNNN
   * Usa una estrategia de contador en la base de datos
   */
  async generarNumeroRemito(transaction) {
    try {
      const year = new Date().getFullYear();

      // Obtener el máximo número para este año
      const ultimoRemito = await Remito.findOne({
        where: {
          numero_remito: {
            [Op.like]: `REM-${year}-%`
          }
        },
        order: [['createdAt', 'DESC']],
        attributes: ['numero_remito']
      });

      let nextNumber = 1;
      if (ultimoRemito && ultimoRemito.numero_remito) {
        const matches = ultimoRemito.numero_remito.match(/REM-\d+-(\d+)/);
        if (matches) {
          nextNumber = parseInt(matches[1]) + 1;
        }
      }

      const numeroRemito = `REM-${year}-${String(nextNumber).padStart(5, '0')}`;
      return numeroRemito;
    } catch (error) {
      logger.error('Error generando número de remito:', error);
      throw new Error('No se pudo generar el número de remito');
    }
  }

  /**
   * Validar que solicitante existe y está activo
   */
  async validarPersonaActiva(personalId, label = 'Personal') {
    const persona = await Personal.findOne({
      where: {
        id: personalId,
        activo: true
      }
    });

    if (!persona) {
      throw new Error(`${label} no existe o no está activo`);
    }

    return persona;
  }

  /**
   * Validar que sede existe y está activa
   */
  async validarSedeActiva(sedeId, label = 'Sede') {
    const sede = await Sede.findOne({
      where: {
        id: sedeId,
        activo: true
      }
    });

    if (!sede) {
      throw new Error(`${label} no existe o no está activa`);
    }

    return sede;
  }

  /**
   * Validar que inventario existe, está activo y disponible
   */
  async validarInventarioDisponible(inventarioId, sedeId) {
    const inventario = await Inventario.findOne({
      where: {
        id: inventarioId,
        sede_id: sedeId,
        activo: true
      }
    });

    if (!inventario) {
      throw new Error(`El artículo no existe en la sede seleccionada o no está disponible`);
    }

    // Verificar que no esté en otro remito activo
    const remitoActivo = await RemitoDetalle.findOne({
      where: {
        inventario_id: inventarioId
      },
      include: [{
        model: Remito,
        as: 'remito',
        where: {
          estado: {
            [Op.in]: ['borrador', 'en_transito']
          }
        }
      }]
    });

    if (remitoActivo) {
      throw new Error(`El artículo ya está asignado a otro remito activo`);
    }

    return inventario;
  }

  /**
   * Crear nuevo remito con detalles - TRANSACCIÓN ATÓMICA
   *
   * Proceso:
   * 1. INSERT Remito con numero_remito auto-generado
   * 2. INSERT RemitoDetalle (uno por artículo)
   * 3. UPDATE Inventario.sede_id para cada artículo
   * 4. INSERT HistorialMovimiento (uno por artículo)
   */
  async crear(datosNueva, usuarioEmail, options = {}) {
    const { transaction: externalTransaction } = options;
    const {
      solicitante_id,
      tecnico_id,
      sede_origen_id,
      sede_destino_id,
      fecha,
      es_prestamo,
      fecha_devolucion_estimada,
      observaciones,
      articulos // Array de { inventario_id, es_prestamo, fecha_devolucion }
    } = datosNueva;

    // Validaciones (fuera de transacción - operaciones de lectura)
    await this.validarPersonaActiva(solicitante_id, 'Solicitante');
    await this.validarPersonaActiva(tecnico_id, 'Técnico');
    await this.validarSedeActiva(sede_origen_id, 'Sede de origen');
    await this.validarSedeActiva(sede_destino_id, 'Sede de destino');

    if (!Array.isArray(articulos) || articulos.length === 0) {
      throw new Error('Debes incluir al menos un artículo en el remito');
    }

    // Validar que origen y destino sean diferentes
    if (sede_origen_id === sede_destino_id) {
      throw new Error('La sede de origen y destino deben ser diferentes');
    }

    // Validar cada artículo
    for (const articulo of articulos) {
      await this.validarInventarioDisponible(articulo.inventario_id, sede_origen_id);

      // Si es préstamo, fecha_devolucion es requerida
      if (articulo.es_prestamo && !articulo.fecha_devolucion) {
        throw new Error('La fecha de devolución es requerida para préstamos');
      }
    }

    // Manejar transacción - usar externa si existe, crear nueva si no
    let t = externalTransaction;
    let shouldCommit = false;

    if (!t) {
      t = await sequelize.transaction();
      shouldCommit = true;
    }

    try {
      // 1. Generar número de remito único
      const numeroRemito = await this.generarNumeroRemito(t);

      // 2. Crear remito principal - NIVEL DE TRANSACCIÓN
      const remito = await Remito.create({
        numero_remito: numeroRemito,
        fecha: fecha || new Date(),
        sede_origen_id,
        sede_destino_id,
        solicitante_id,
        tecnico_id,
        estado: 'borrador',
        es_prestamo: articulos.some(a => a.es_prestamo),
        fecha_devolucion_estimada: fecha_devolucion_estimada || null,
        observaciones: observaciones || null,
        activo: true
      }, { transaction: t });

      logger.info('Remito creado:', {
        id: remito.id,
        numeroRemito: remito.numero_remito,
        estado: remito.estado
      });

      // 3. Crear detalles y actualizar inventario
      for (const articulo of articulos) {
        // 3a. Crear RemitoDetalle
        const detalle = await RemitoDetalle.create({
          remito_id: remito.id,
          inventario_id: articulo.inventario_id,
          es_prestamo: articulo.es_prestamo || false,
          fecha_devolucion: articulo.fecha_devolucion || null,
          devuelto: false,
          observaciones: articulo.observaciones || null
        }, { transaction: t });

        logger.info('RemitoDetalle creado:', {
          id: detalle.id,
          remitoId: remito.id,
          inventarioId: articulo.inventario_id,
          esPrestamo: articulo.es_prestamo
        });

        // 3b. Actualizar ubicación de inventario (solo si NO es préstamo)
        // Los préstamos mantienen su ubicación original
        if (!articulo.es_prestamo) {
          await Inventario.update(
            { sede_id: sede_destino_id },
            {
              where: { id: articulo.inventario_id },
              transaction: t
            }
          );

          logger.info('Inventario actualizado - ubicación', {
            inventarioId: articulo.inventario_id,
            nuevaSede: sede_destino_id
          });
        }

        // 3c. Crear historial de movimiento
        // El hook de afterCreate en RemitoDetalle también creará un historial,
        // pero lo hacemos aquí de forma explícita en la transacción
        const tipoMovimiento = articulo.es_prestamo ? 'prestamo' : 'transferencia';
        await HistorialMovimiento.create({
          inventario_id: articulo.inventario_id,
          remito_id: remito.id,
          sede_origen_id,
          sede_destino_id,
          tipo_movimiento: tipoMovimiento,
          fecha_movimiento: new Date(),
          usuario_id: null, // Se asignará después si tenemos el usuario
          observaciones: `${tipoMovimiento === 'prestamo' ? 'Préstamo' : 'Transferencia'} vía remito ${numeroRemito}`
        }, { transaction: t });

        logger.info('HistorialMovimiento creado:', {
          inventarioId: articulo.inventario_id,
          tipoMovimiento,
          numeroRemito
        });
      }

      // Commit solo si creamos la transacción localmente
      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Remito creado exitosamente:', {
        id: remito.id,
        numeroRemito: remito.numero_remito,
        articulos: articulos.length
      });

      return remito;
    } catch (error) {
      // Rollback automático si usamos transacción local
      if (shouldCommit) {
        await t.rollback();
      }

      logger.error('Error creando remito:', {
        error: error.message,
        stack: error.stack,
        datos: {
          solicitante_id,
          tecnico_id,
          articulos: articulos.length
        }
      });

      throw error;
    }
  }

  /**
   * Listar remitos con filtros y paginación
   */
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      estado = null,
      es_prestamo = null,
      solicitante_id = null,
      tecnico_id = null,
      sede_origen_id = null,
      sede_destino_id = null,
      activo = true
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filtro activo (por defecto true)
    if (activo !== null && activo !== undefined) {
      whereClause.activo = activo === 'true' || activo === true;
    } else {
      whereClause.activo = true;
    }

    // Filtros específicos
    if (estado) {
      whereClause.estado = estado;
    }

    if (es_prestamo !== null && es_prestamo !== undefined) {
      whereClause.es_prestamo = es_prestamo === 'true' || es_prestamo === true;
    }

    if (solicitante_id) {
      whereClause.solicitante_id = solicitante_id;
    }

    if (tecnico_id) {
      whereClause.tecnico_id = tecnico_id;
    }

    if (sede_origen_id) {
      whereClause.sede_origen_id = sede_origen_id;
    }

    if (sede_destino_id) {
      whereClause.sede_destino_id = sede_destino_id;
    }

    const { count, rows } = await Remito.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Personal,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Personal,
          as: 'tecnicoAsignado', // Nota: Relación usa tecnico_id pero alias anterior es tecnicoAsignado
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Sede,
          as: 'sedeOrigen',
          attributes: ['id', 'nombre_sede', 'localidad']
        },
        {
          model: Sede,
          as: 'sedeDestino',
          attributes: ['id', 'nombre_sede', 'localidad']
        },
        {
          model: RemitoDetalle,
          as: 'detalles',
          attributes: ['id', 'inventario_id', 'es_prestamo', 'fecha_devolucion', 'devuelto'],
          include: [{
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'marca', 'modelo']
          }]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true
    });

    return {
      rows,
      count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page)
      }
    };
  }

  /**
   * Obtener remito con todos los detalles
   */
  async obtener(remitoId) {
    const remito = await Remito.findByPk(remitoId, {
      include: [
        {
          model: Personal,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Personal,
          as: 'tecnicoAsignado',
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Sede,
          as: 'sedeOrigen',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
        },
        {
          model: Sede,
          as: 'sedeDestino',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
        },
        {
          model: RemitoDetalle,
          as: 'detalles',
          include: [{
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'marca', 'modelo', 'numero_serie', 'estado']
          }]
        },
        {
          model: HistorialMovimiento,
          as: 'historialMovimientosRemito',
          attributes: ['id', 'tipo_movimiento', 'fecha_movimiento', 'observaciones']
        }
      ]
    });

    if (!remito) {
      throw new Error('El remito no existe');
    }

    return remito;
  }

  /**
   * Cambiar estado del remito
   * Solo Infraestructura puede cambiar estados
   */
  async cambiarEstado(remitoId, nuevoEstado, usuarioId, options = {}) {
    const { transaction } = options;

    const estadosValidos = ['borrador', 'en_transito', 'entregado', 'devuelto', 'cancelado'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new Error(`Estado "${nuevoEstado}" no es válido`);
    }

    const remito = await Remito.findByPk(remitoId);
    if (!remito) {
      throw new Error('El remito no existe');
    }

    // Validaciones de transiciones de estado
    const transicionesValidas = {
      'borrador': ['en_transito', 'cancelado'],
      'en_transito': ['entregado', 'cancelado'],
      'entregado': ['devuelto'],
      'devuelto': [],
      'cancelado': []
    };

    if (!transicionesValidas[remito.estado].includes(nuevoEstado)) {
      throw new Error(
        `No se puede cambiar de "${remito.estado}" a "${nuevoEstado}". ` +
        `Transiciones válidas: ${transicionesValidas[remito.estado].join(', ')}`
      );
    }

    // Actualizar estado
    const remitoActualizado = await remito.update(
      { estado: nuevoEstado },
      { transaction }
    );

    logger.info('Estado de remito actualizado:', {
      remitoId,
      estadoAnterior: remito.estado,
      estadoNuevo: nuevoEstado,
      usuarioId
    });

    return remitoActualizado;
  }

  /**
   * Generar remito de devolución automático
   * Cuando se devuelven artículos préstamo
   */
  async generarRemitoDevolucion(remitoOriginalId, detalleIdsADevolver, usuarioEmail, options = {}) {
    const { transaction: externalTransaction } = options;

    // Obtener remito original
    const remitoOriginal = await Remito.findByPk(remitoOriginalId);
    if (!remitoOriginal) {
      throw new Error('El remito original no existe');
    }

    if (!remitoOriginal.es_prestamo) {
      throw new Error('Solo se pueden devolver artículos de remitos que sean préstamos');
    }

    // Obtener detalles a devolver
    const detallesADevolver = await RemitoDetalle.findAll({
      where: {
        id: detalleIdsADevolver,
        remito_id: remitoOriginalId,
        es_prestamo: true,
        devuelto: false
      }
    });

    if (detallesADevolver.length === 0) {
      throw new Error('No hay artículos válidos para devolver');
    }

    // Manejar transacción
    let t = externalTransaction;
    let shouldCommit = false;

    if (!t) {
      t = await sequelize.transaction();
      shouldCommit = true;
    }

    try {
      // Crear remito de devolución
      const numeroRemito = await this.generarNumeroRemito(t);
      const remitoDevolucion = await Remito.create({
        numero_remito: numeroRemito,
        fecha: new Date(),
        sede_origen_id: remitoOriginal.sede_destino_id, // Inverted
        sede_destino_id: remitoOriginal.sede_origen_id,  // Inverted
        solicitante_id: remitoOriginal.solicitante_id,
        tecnico_id: remitoOriginal.tecnico_id,
        estado: 'en_transito',
        es_prestamo: false,
        observaciones: `Devolución de remito ${remitoOriginal.numero_remito}`,
        activo: true
      }, { transaction: t });

      // Crear detalles de devolución
      for (const detalleOriginal of detallesADevolver) {
        await RemitoDetalle.create({
          remito_id: remitoDevolucion.id,
          inventario_id: detalleOriginal.inventario_id,
          es_prestamo: false,
          devuelto: false
        }, { transaction: t });

        // Actualizar ubicación: devolver a sede origen
        await Inventario.update(
          { sede_id: remitoOriginal.sede_origen_id },
          {
            where: { id: detalleOriginal.inventario_id },
            transaction: t
          }
        );

        // Marcar como devuelto en remito original
        await detalleOriginal.update(
          { devuelto: true },
          { transaction: t }
        );

        // Crear historial de devolución
        await HistorialMovimiento.create({
          inventario_id: detalleOriginal.inventario_id,
          remito_id: remitoDevolucion.id,
          sede_origen_id: remitoOriginal.sede_destino_id,
          sede_destino_id: remitoOriginal.sede_origen_id,
          tipo_movimiento: 'devolucion',
          fecha_movimiento: new Date(),
          observaciones: `Devolución de préstamo - Remito original: ${remitoOriginal.numero_remito}`
        }, { transaction: t });
      }

      // Commit solo si creamos la transacción localmente
      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Remito de devolución creado:', {
        remitoOriginalId,
        remitoDevolucionId: remitoDevolucion.id,
        articulosDevueltos: detallesADevolver.length
      });

      return remitoDevolucion;
    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logger.error('Error generando remito de devolución:', error);
      throw error;
    }
  }
}

module.exports = new RemitoService();
