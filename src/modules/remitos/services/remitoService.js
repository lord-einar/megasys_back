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
const { Op, Sequelize } = require('sequelize');

class RemitoService {
  /**
   * Generar número de remito único con formato REM-YYYY-NNN
   * Usa secuencia PostgreSQL NEXTVAL para mayor seguridad contra race conditions
   */
  async generarNumeroRemito(transaction) {
    try {
      const year = new Date().getFullYear();

      // Usar NEXTVAL de PostgreSQL para obtener número secuencial seguro
      const result = await sequelize.query(
        `SELECT NEXTVAL('remito_numero_seq') AS numero`,
        {
          transaction,
          type: Sequelize.QueryTypes.SELECT,
          raw: true
        }
      );

      const numeroSecuencia = result[0].numero;
      const numeroRemito = `REM-${year}-${String(numeroSecuencia).padStart(3, '0')}`;

      logger.info('Número de remito generado:', {
        numeroSecuencia,
        numeroRemito,
        year
      });

      return numeroRemito;
    } catch (error) {
      logger.error('Error generando número de remito:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
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
    try {
      logger.info('validarInventarioDisponible - Iniciando validación:', {
        inventarioId,
        sedeId,
        inventarioIdType: typeof inventarioId,
        sedeIdType: typeof sedeId
      });

      // Validar que los parámetros no sean undefined
      if (!inventarioId || !sedeId) {
        throw new Error(`Parámetros inválidos: inventarioId=${inventarioId}, sedeId=${sedeId}`);
      }

      logger.info('validarInventarioDisponible - Buscando inventario:', {
        inventarioId,
        sedeId
      });

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

      logger.info('validarInventarioDisponible - Inventario encontrado, verificando remitos activos:', {
        inventarioId,
        inventarioFound: true
      });

      // Verificar que no esté en otro remito activo
      // Primero buscar detalles del inventario
      const detallesExistentes = await RemitoDetalle.findAll({
        where: {
          inventario_id: inventarioId
        },
        include: [{
          model: Remito,
          as: 'remito',
          attributes: ['id', 'estado']
        }],
        limit: 10
      });

      logger.info('validarInventarioDisponible - Detalles encontrados:', {
        detallesCount: detallesExistentes.length
      });

      // Verificar si alguno está en estado activo
      const remitoActivo = detallesExistentes.find(detalle => {
        return detalle.remito && ['preparado', 'en_transito'].includes(detalle.remito.estado);
      });

      if (remitoActivo) {
        throw new Error(`El artículo ya está asignado a otro remito activo`);
      }

      logger.info('validarInventarioDisponible - Validación completada exitosamente');
      return inventario;
    } catch (err) {
      logger.error('validarInventarioDisponible - Error:', {
        error: err.message,
        linea: err.stack?.split('\n')[1]?.trim() || 'Desconocida',
        inventarioId,
        sedeId
      });
      throw err;
    }
  }

  /**
   * Validar que un artículo NO esté en otro remito activo
   * Un artículo no puede estar en 2 remitos activos simultáneamente
   * Estados activos: preparado, en_transito, entregado
   */
  async validarArticuloNoEnTransito(inventarioId) {
    try {
      const { Remito } = require('../../../models');

      // Buscar si existe un RemitoDetalle con este inventario en un remito activo
      const detalleExistente = await RemitoDetalle.findOne({
        where: { inventario_id: inventarioId },
        include: [{
          model: Remito,
          as: 'remito',
          where: {
            estado: {
              [require('sequelize').Op.in]: ['preparado', 'en_transito', 'entregado']
            }
          }
        }]
      });

      if (detalleExistente && detalleExistente.remito) {
        throw new Error(
          `El artículo ${inventarioId} ya está en el remito ${detalleExistente.remito.numero_remito} ` +
          `con estado "${detalleExistente.remito.estado}". No se puede agregar a múltiples remitos activos.`
        );
      }

      return true;
    } catch (err) {
      logger.error('validarArticuloNoEnTransito - Error:', {
        error: err.message,
        linea: err.stack?.split('\n')[1]?.trim() || 'Desconocida',
        inventarioId
      });
      throw err;
    }
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
      articulos // Array de { inventario_id, es_prestamo, fecha_devolucion_esperada }
    } = datosNueva;

    // Validaciones (fuera de transacción - operaciones de lectura)
    try {
      logger.info('crear - Iniciando validaciones de remito');

      await this.validarPersonaActiva(solicitante_id, 'Solicitante');
      logger.info('crear - Solicitante validado');

      await this.validarPersonaActiva(tecnico_id, 'Técnico');
      logger.info('crear - Técnico validado');

      await this.validarSedeActiva(sede_origen_id, 'Sede de origen');
      logger.info('crear - Sede origen validada');

      await this.validarSedeActiva(sede_destino_id, 'Sede de destino');
      logger.info('crear - Sede destino validada');

      if (!Array.isArray(articulos) || articulos.length === 0) {
        throw new Error('Debes incluir al menos un artículo en el remito');
      }
      logger.info('crear - Array de artículos validado', { articulosCount: articulos.length });

      // Validar que origen y destino sean diferentes
      if (sede_origen_id === sede_destino_id) {
        throw new Error('La sede de origen y destino deben ser diferentes');
      }
      logger.info('crear - Sedes diferentes validadas');

      logger.info('crear - Todas las validaciones completadas exitosamente');
    } catch (validationErr) {
      logger.error('crear - Error en validaciones:', {
        error: validationErr.message,
        linea: validationErr.stack?.split('\n')[1]?.trim() || 'Desconocida'
      });
      throw validationErr;
    }

    // Normalizar artículos: aceptar fecha_devolucion o fecha_devolucion_esperada
    // IMPORTANTE: Se hace FUERA del try-catch para que esté disponible en la transacción
    const articulosNormalizados = articulos.map(art => ({
      ...art,
      fecha_devolucion_esperada: art.fecha_devolucion_esperada || art.fecha_devolucion
    }));
    logger.info('crear - Artículos normalizados');

    // Validar cada artículo normalizado
    try {
      for (let i = 0; i < articulosNormalizados.length; i++) {
        const articulo = articulosNormalizados[i];
        logger.info(`crear - Validando artículo [${i}]`, {
          inventario_id: articulo.inventario_id,
          sede_origen_id: sede_origen_id,
          es_prestamo: articulo.es_prestamo
        });

        // Validar que el artículo existe y está disponible en la sede
        await this.validarInventarioDisponible(articulo.inventario_id, sede_origen_id);
        logger.info(`crear - Artículo [${i}] disponible`);

        // Validar que el artículo NO está en otro remito activo
        await this.validarArticuloNoEnTransito(articulo.inventario_id);
        logger.info(`crear - Artículo [${i}] no está en otro remito activo`);

        // Si es préstamo, fecha_devolucion_esperada es requerida
        if (articulo.es_prestamo && !articulo.fecha_devolucion_esperada) {
          throw new Error('La fecha de devolución es requerida para préstamos');
        }

        logger.info(`crear - Artículo [${i}] validado correctamente`);
      }

      logger.info('crear - Validación de artículos completada');
    } catch (articuloErr) {
      logger.error('crear - Error validando artículos:', {
        error: articuloErr.message,
        linea: articuloErr.stack?.split('\n')[1]?.trim() || 'Desconocida'
      });
      throw articuloErr;
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
        tecnico_asignado_id: tecnico_id || null,
        estado: 'preparado',
        observaciones: observaciones || null
      }, { transaction: t });

      logger.info('Remito creado:', {
        id: remito.id,
        numeroRemito: remito.numero_remito,
        estado: remito.estado
      });

      // 3. Crear detalles y actualizar inventario
      for (const articulo of articulosNormalizados) {
        // 3a. Crear RemitoDetalle
        const detalle = await RemitoDetalle.create({
          remito_id: remito.id,
          inventario_id: articulo.inventario_id,
          es_prestamo: articulo.es_prestamo || false,
          fecha_devolucion_esperada: articulo.fecha_devolucion_esperada || null,
          devuelto: false,
          observaciones: articulo.observaciones || null
        }, { transaction: t });

        logger.info('RemitoDetalle creado:', {
          id: detalle.id,
          remitoId: remito.id,
          inventarioId: articulo.inventario_id,
          esPrestamo: articulo.es_prestamo
        });

        // 3b. Actualizar ubicación y estado de inventario
        const nuevoEstado = articulo.es_prestamo ? 'en_prestamo' : 'en_uso';
        const updateData = { estado: nuevoEstado };

        // Actualizar ubicación solo si NO es préstamo (los préstamos mantienen su ubicación original)
        if (!articulo.es_prestamo) {
          updateData.sede_id = sede_destino_id;
        }

        await Inventario.update(
          updateData,
          {
            where: { id: articulo.inventario_id },
            transaction: t
          }
        );

        logger.info('Inventario actualizado - estado y ubicación', {
          inventarioId: articulo.inventario_id,
          nuevoEstado,
          nuevaSede: !articulo.es_prestamo ? sede_destino_id : 'sin-cambios',
          esPrestamo: articulo.es_prestamo
        });

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

      // Extraer información de línea y función del stack trace
      const stackLines = error.stack?.split('\n') || [];
      const lineaInfo = stackLines[1]?.trim() || 'Desconocida';
      const funcionInfo = error.stack?.split('\n')[0] || 'Desconocida';

      logger.error('Error creando remito en transacción:', {
        error: error.message,
        funcion: funcionInfo,
        linea: lineaInfo,
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

    // Nota: La tabla remitos no tiene columna 'activo', solo 'estado'
    // Por lo tanto no filtramos por activo aquí

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
          attributes: ['id', 'inventario_id', 'es_prestamo', 'fecha_devolucion_esperada', 'devuelto'],
          include: [{
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'marca', 'modelo']
          }]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
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
    const { transaction, userRoles = [] } = options;

    const estadosValidos = ['preparado', 'en_transito', 'entregado', 'confirmado'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new Error(`Estado "${nuevoEstado}" no es válido`);
    }

    const remito = await Remito.findByPk(remitoId);
    if (!remito) {
      throw new Error('El remito no existe');
    }

    // Validar autorización: solo Infraestructura o el técnico asignado puede cambiar estado
    const esInfraestructura = userRoles.includes('Infraestructura');
    const esTecnicoAsignado = remito.tecnico_asignado_id === usuarioId;

    if (!esInfraestructura && !esTecnicoAsignado) {
      throw new Error('No tienes permisos para cambiar el estado de este remito. Solo Infraestructura o el técnico asignado pueden hacerlo.');
    }

    // Validaciones de transiciones de estado
    const transicionesValidas = {
      'preparado': ['en_transito'],
      'en_transito': ['entregado'],
      'entregado': ['confirmado'],
      'confirmado': []
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
        tecnico_asignado_id: remitoOriginal.tecnico_asignado_id,
        estado: 'preparado',
        observaciones: `Devolución de remito ${remitoOriginal.numero_remito}`
      }, { transaction: t });

      // Crear detalles de devolución
      for (const detalleOriginal of detallesADevolver) {
        await RemitoDetalle.create({
          remito_id: remitoDevolucion.id,
          inventario_id: detalleOriginal.inventario_id,
          es_prestamo: false,
          devuelto: false
        }, { transaction: t });

        // Actualizar ubicación y estado: devolver a sede origen y marcar como disponible
        await Inventario.update(
          {
            sede_id: remitoOriginal.sede_origen_id,
            estado: 'Disponible' // Revertir estado a disponible cuando se devuelve el artículo
          },
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

  /**
   * Obtener préstamos a vencer (próximos N días)
   * Retorna préstamos activos con fecha de devolución próxima
   */
  async obtenerPrestamosProximosAVencer(dias = 7) {
    try {
      logger.info('Obteniendo préstamos próximos a vencer:', { dias });

      const hoy = new Date();
      const fechaLimite = new Date(hoy.getTime() + dias * 24 * 60 * 60 * 1000);

      const prestamos = await RemitoDetalle.findAll({
        where: {
          es_prestamo: true,
          devuelto: false,
          fecha_devolucion_esperada: {
            [Op.lte]: fechaLimite,
            [Op.gte]: Sequelize.literal('CURRENT_DATE')
          }
        },
        include: [
          {
            model: Remito,
            as: 'remito',
            attributes: ['id', 'numero_remito', 'fecha', 'solicitante_id'],
            include: [
              {
                model: Personal,
                as: 'solicitante',
                attributes: ['id', 'nombre', 'apellido'],
                required: false
              }
            ]
          },
          {
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'marca', 'modelo', 'numero_serie', 'service_tag', 'estado']
          }
        ],
        order: [['fecha_devolucion_esperada', 'ASC']],
        subQuery: false
      });

      logger.info('Préstamos próximos a vencer encontrados:', {
        cantidad: prestamos.length,
        dias
      });

      return prestamos;
    } catch (error) {
      logger.error('Error obteniendo préstamos próximos a vencer:', error);
      throw error;
    }
  }

  /**
   * Obtener préstamos vencidos (ya pasó la fecha de devolución)
   */
  async obtenerPrestamosVencidos() {
    try {
      logger.info('Obteniendo préstamos vencidos');

      const prestamos = await RemitoDetalle.findAll({
        where: {
          es_prestamo: true,
          devuelto: false,
          fecha_devolucion_esperada: {
            [Op.lt]: Sequelize.literal('CURRENT_DATE')
          }
        },
        include: [
          {
            model: Remito,
            as: 'remito',
            attributes: ['id', 'numero_remito', 'fecha', 'solicitante_id'],
            include: [
              {
                model: Personal,
                as: 'solicitante',
                attributes: ['id', 'nombre', 'apellido'],
                required: false
              }
            ]
          },
          {
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'marca', 'modelo', 'numero_serie', 'service_tag', 'estado']
          }
        ],
        order: [['fecha_devolucion_esperada', 'ASC']],
        subQuery: false
      });

      logger.info('Préstamos vencidos encontrados:', {
        cantidad: prestamos.length
      });

      return prestamos;
    } catch (error) {
      logger.error('Error obteniendo préstamos vencidos:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen de estado de préstamos
   */
  async obtenerResumenPrestamos() {
    try {
      logger.info('Obteniendo resumen de préstamos');

      const hoy = new Date();
      const proximos7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [proximosAVencer, vencidos, totalActivos] = await Promise.all([
        RemitoDetalle.count({
          where: {
            es_prestamo: true,
            devuelto: false,
            fecha_devolucion_esperada: {
              [Op.lte]: proximos7Dias,
              [Op.gte]: Sequelize.literal('CURRENT_DATE')
            }
          }
        }),
        RemitoDetalle.count({
          where: {
            es_prestamo: true,
            devuelto: false,
            fecha_devolucion_esperada: {
              [Op.lt]: Sequelize.literal('CURRENT_DATE')
            }
          }
        }),
        RemitoDetalle.count({
          where: {
            es_prestamo: true,
            devuelto: false
          }
        })
      ]);

      const resumen = {
        proximosAVencer,
        vencidos,
        totalActivos,
        alerta: vencidos > 0 || proximosAVencer > 0
      };

      logger.info('Resumen de préstamos:', resumen);

      return resumen;
    } catch (error) {
      logger.error('Error obteniendo resumen de préstamos:', error);
      throw error;
    }
  }
}

module.exports = new RemitoService();
