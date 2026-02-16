// src/modules/remitos/services/remitoService.js
import {
  Remito,
  RemitoDetalle,
  Inventario,
  HistorialMovimiento,
  Personal,
  Rol,
  Sede,
  TipoArticulo,
  sequelize
} from '../../../models/index.js';
import personalService from '../../personal/services/personalService.js';
import logger from '../../../shared/utils/logger.js';
import { Op, Sequelize } from 'sequelize';
import pdfService from '../../../shared/services/pdfService.js';
import emailService from '../../../shared/services/emailService.js';
import tokenService from '../../../shared/services/tokenService.js';
import CommonValidators from '../../../shared/validators/commonValidators.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

/**
 * Servicio de gestión de remitos
 *
 * NOTA TÉCNICA: Este servicio usa TransactionWrapper para:
 * 1. Manejo automático de transacciones y rollback
 * 2. Auditoría integrada de todas las operaciones
 * 3. Soporte para transacciones externas (operaciones anidadas)
 *
 * Las operaciones asíncronas (emails, PDFs) se ejecutan fuera de la transacción
 * siguiendo el patrón "best effort" - si fallan, no afectan la operación principal.
 */
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
          activo: true,
          estado: {
            [Op.notIn]: ['en_uso', 'en_prestamo']
          }
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
      // Remito ya importado al inicio del archivo

      // Buscar si existe un RemitoDetalle con este inventario en un remito activo
      const detalleExistente = await RemitoDetalle.findOne({
        where: { inventario_id: inventarioId },
        include: [{
          model: Remito,
          as: 'remito',
          where: {
            estado: {
              [Op.in]: ['preparado', 'en_transito', 'entregado']
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
   * OPTIMIZACIÓN: Validar múltiples artículos en batch (reduce N+1 queries)
   * Valida inventarios disponibles y que no estén en remitos activos
   */
  async validarArticulosBatch(articulos, sedeOrigenId) {
    // Remito y Op ya importados al inicio del archivo
    const inventarioIds = articulos.map(a => a.inventario_id);

    logger.info('validarArticulosBatch - Iniciando validación batch:', {
      cantidadArticulos: inventarioIds.length,
      sedeOrigenId
    });

    // 1. Verificar que todos los inventarios existen y están disponibles en la sede (UNA query)
    const inventariosDisponibles = await Inventario.findAll({
      where: {
        id: { [Op.in]: inventarioIds },
        sede_id: sedeOrigenId,
        activo: true,
        estado: { [Op.notIn]: ['en_uso', 'en_prestamo'] }
      },
      attributes: ['id', 'marca', 'modelo', 'numero_serie', 'estado']
    });

    const idsEncontrados = inventariosDisponibles.map(inv => inv.id);
    const idsFaltantes = inventarioIds.filter(id => !idsEncontrados.includes(id));

    if (idsFaltantes.length > 0) {
      throw new Error(
        `Los siguientes artículos no existen en la sede seleccionada o no están disponibles: ${idsFaltantes.join(', ')}`
      );
    }

    // 2. Verificar que ninguno esté en remito activo (UNA query)
    const detallesActivos = await RemitoDetalle.findAll({
      where: { inventario_id: { [Op.in]: inventarioIds } },
      include: [{
        model: Remito,
        as: 'remito',
        where: {
          estado: { [Op.in]: ['preparado', 'en_transito'] }
        },
        attributes: ['id', 'numero_remito', 'estado'],
        required: true
      }],
      attributes: ['id', 'inventario_id']
    });

    if (detallesActivos.length > 0) {
      const conflictos = detallesActivos.map(d =>
        `Artículo ${d.inventario_id} en remito ${d.remito.numero_remito} (${d.remito.estado})`
      ).join('; ');
      throw new Error(`Los siguientes artículos ya están en remitos activos: ${conflictos}`);
    }

    logger.info('validarArticulosBatch - Validación completada exitosamente');
    return inventariosDisponibles;
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
    const { transaction: externalTransaction, usuarioId = null, ipAddress = null, userAgent = null } = options;
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
    logger.info('crear - Iniciando validaciones de remito');

    await CommonValidators.validarPersonaActiva(solicitante_id, 'Solicitante');
    logger.info('crear - Solicitante validado');

    await CommonValidators.validarPersonaActiva(tecnico_id, 'Técnico');
    logger.info('crear - Técnico validado');

    await CommonValidators.validarSedeActiva(sede_origen_id, 'Sede de origen');
    logger.info('crear - Sede origen validada');

    await CommonValidators.validarSedeActiva(sede_destino_id, 'Sede de destino');
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

    // Normalizar artículos: aceptar fecha_devolucion o fecha_devolucion_esperada
    const articulosNormalizados = articulos.map(art => ({
      ...art,
      fecha_devolucion_esperada: art.fecha_devolucion_esperada || art.fecha_devolucion
    }));
    logger.info('crear - Artículos normalizados');

    // OPTIMIZACIÓN: Validar todos los artículos en batch (reduce N+1 queries)
    await this.validarArticulosBatch(articulosNormalizados, sede_origen_id);
    logger.info('crear - Artículos validados en batch exitosamente');

    // Validar campos específicos de cada artículo
    for (let i = 0; i < articulosNormalizados.length; i++) {
      const articulo = articulosNormalizados[i];
      if (articulo.es_prestamo && !articulo.fecha_devolucion_esperada) {
        throw new Error('La fecha de devolución es requerida para préstamos');
      }
    }
    logger.info('crear - Validación de artículos completada');

    const result = await TransactionWrapper.execute({
      operation: async (transaction) => {
        // 1. Generar número de remito único
        const numeroRemito = await this.generarNumeroRemito(transaction);

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
        }, { transaction });

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
          }, { transaction });

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
              transaction
            }
          );

          logger.info('Inventario actualizado - estado y ubicación', {
            inventarioId: articulo.inventario_id,
            nuevoEstado,
            nuevaSede: !articulo.es_prestamo ? sede_destino_id : 'sin-cambios',
            esPrestamo: articulo.es_prestamo
          });

          // NOTA: El historial de movimiento se crea automáticamente via hook afterCreate
          // en RemitoDetalle (ver models/index.js)
        }

        return remito;
      },
      usuarioEmail: usuarioEmail || 'sistema@megatlon.com.ar',
      usuarioId,
      modulo: 'remitos',
      accion: 'crear',
      recurso: 'Remito',
      descripcion: `Creó remito con ${articulos.length} artículo(s) de sede ${sede_origen_id} a ${sede_destino_id}`,
      valoresNuevos: {
        sede_origen_id,
        sede_destino_id,
        solicitante_id,
        tecnico_asignado_id: tecnico_id,
        estado: 'preparado',
        articulos_count: articulos.length
      },
      ipAddress,
      userAgent,
      transaction: externalTransaction
    });

    const remito = result.data;

    logger.info('Remito creado exitosamente:', {
      id: remito.id,
      numeroRemito: remito.numero_remito,
      articulos: articulos.length
    });

    // Obtener remito completo con relaciones para PDF y email (fuera de transacción - best effort)
    const remitoCompleto = await this.obtener(remito.id);

    // Generar PDF del remito (asincrónico, no bloquea la respuesta)
    try {
      logger.info('=== GENERACIÓN DE PDF - INICIANDO ===', {
        remitoId: remito.id,
        numeroRemito: remitoCompleto.numero_remito,
        timestamp: new Date().toISOString()
      });

      const resultadoPDF = await pdfService.generarPDF(remitoCompleto, { confirmado: false });

      logger.info('✓ PDF DEL REMITO GENERADO EXITOSAMENTE', {
        remitoId: remito.id,
        numeroRemito: remitoCompleto.numero_remito,
        rutaPDF: resultadoPDF.path,
        tamaño: resultadoPDF.size,
        timestamp: new Date().toISOString()
      });

      // Enviar emails SOLO cuando el estado es "en_transito" (asincrónico, en background)
      // Los emails se enviarán cuando el estado cambie a "en_transito" via cambiarEstado()
      if (remito.estado === 'en_transito') {
        setImmediate(async () => {
          try {
            logger.info('=== ENVÍO DE EMAILS - INICIANDO ===', {
              remitoId: remito.id,
              numeroRemito: remitoCompleto.numero_remito,
              timestamp: new Date().toISOString()
            });

            // Email a infraestructura
            await emailService.enviarAInfraestructura(remitoCompleto, resultadoPDF.path);
            logger.info('✓ EMAIL A INFRAESTRUCTURA ENVIADO');

            // Email al solicitante con link de confirmación
            const urlConfirmacion = tokenService.generarUrlConfirmacion(
              remitoCompleto.id,
              remitoCompleto.solicitante?.email,
              process.env.FRONTEND_URL || 'http://localhost:3000'
            );
            await emailService.enviarAlSolicitante(remitoCompleto, resultadoPDF.path, urlConfirmacion);
            logger.info('✓ EMAIL AL SOLICITANTE ENVIADO');

            logger.info('=== ENVÍO DE EMAILS - COMPLETADO EXITOSAMENTE ===');
          } catch (emailError) {
            logger.error('✗ ERROR ENVIANDO EMAILS', {
              error: emailError.message,
              stack: emailError.stack
            });
          }
        });
      } else {
        logger.info('⏭️ Envío de emails será realizado cuando el estado cambie a "en_transito"', {
          estadoActual: remito.estado
        });
      }
    } catch (pdfError) {
      logger.error('✗ ERROR GENERANDO PDF', {
        error: pdfError.message,
        stack: pdfError.stack
      });
      // No lanzar el error para no afectar la creación del remito
    }

    return remito;
  }

  /**
   * Listar remitos con filtros y paginación
   * OPTIMIZADO: Filtro de es_prestamo se hace en BD, no en memoria
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

    // OPTIMIZACIÓN: Filtrar es_prestamo en BD usando subquery
    if (es_prestamo !== null && es_prestamo !== undefined) {
      const esPrestamoBool = es_prestamo === 'true' || es_prestamo === true;

      // Subquery: EXISTS (SELECT 1 FROM remito_detalles WHERE remito_id = remitos.id AND es_prestamo = true)
      // Subquery: EXISTS (SELECT 1 FROM remito_detalles WHERE remito_id = remitos.id AND es_prestamo = true)
      whereClause[Op.and] = Sequelize.literal(
        esPrestamoBool
          ? `EXISTS (SELECT 1 FROM remito_detalles WHERE remito_id = "Remito".id AND es_prestamo = true)`
          : `NOT EXISTS (SELECT 1 FROM remito_detalles WHERE remito_id = "Remito".id AND es_prestamo = true)`
      );
    }

    const { count, rows } = await Remito.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Personal,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
        },
        {
          model: Personal,
          as: 'tecnicoAsignado',
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

    // Calcular es_prestamo para cada remito basándose en sus artículos
    const rowsConTipo = rows.map(remito => {
      const tieneArticulosEnPrestamo = remito.detalles && remito.detalles.some(detalle => detalle.es_prestamo);
      return {
        ...remito.toJSON(),
        es_prestamo: tieneArticulosEnPrestamo
      };
    });

    // FIX PAGINACIÓN: count es el total real de la BD filtrada, no el tamaño del array
    return {
      rows: rowsConTipo,
      count, // Count correcto de BD (ya filtrado por es_prestamo en query)
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count, // Total real de BD
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
          attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
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
          attributes: ['id', 'inventario_id', 'es_prestamo', 'fecha_devolucion_esperada', 'devuelto', 'fecha_devolucion_real', 'observaciones'],
          include: [{
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'marca', 'modelo', 'numero_serie', 'estado', 'tipo_articulo_id'],
            include: [{
              model: TipoArticulo,
              as: 'tipoArticulo',
              attributes: ['id', 'nombre']
            }]
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

    // Calcular si es préstamo basándose en los artículos del remito
    // Un remito es "préstamo" si al menos uno de sus artículos es préstamo
    const tieneArticulosEnPrestamo = remito.detalles && remito.detalles.some(detalle => detalle.es_prestamo);
    remito.es_prestamo = tieneArticulosEnPrestamo;

    return remito;
  }

  /**
   * Cambiar estado del remito
   * Solo Infraestructura puede cambiar estados
   */
  async cambiarEstado(remitoId, nuevoEstado, usuarioId, options = {}) {
    const { transaction: externalTransaction, userRoles = [], usuarioEmail = null, userAgent = null, ipAddress = null, privilegioApp = null } = options;

    const estadosValidos = ['preparado', 'en_transito', 'entregado', 'completado', 'devuelto', 'cancelado'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new Error(`Estado "${nuevoEstado}" no es válido`);
    }

    // Obtener remito para validaciones previas
    const remitoPrevia = await Remito.findByPk(remitoId);
    if (!remitoPrevia) {
      throw new Error('El remito no existe');
    }

    // Validar autorización
    const esSuperAdministrador =
      userRoles.includes('Infraestructura') ||
      userRoles.includes('Sistemas') ||
      privilegioApp === 'super_admin';
    const esTecnicoAsignado = remitoPrevia.tecnico_asignado_id === usuarioId;

    if (!esSuperAdministrador && !esTecnicoAsignado) {
      throw new Error('No tienes permisos para cambiar el estado de este remito. Solo usuarios administrativos o el técnico asignado pueden hacerlo.');
    }

    // Validaciones de transiciones de estado
    const transicionesValidas = {
      'preparado': ['en_transito', 'cancelado'],
      'en_transito': ['entregado', 'cancelado'],
      'entregado': ['completado', 'devuelto', 'cancelado'],
      'completado': ['devuelto'],
      'devuelto': [],
      'cancelado': []
    };

    if (!transicionesValidas[remitoPrevia.estado].includes(nuevoEstado)) {
      throw new Error(
        `No se puede cambiar de "${remitoPrevia.estado}" a "${nuevoEstado}". ` +
        `Transiciones válidas: ${transicionesValidas[remitoPrevia.estado].join(', ')}`
      );
    }

    const estadoAnterior = remitoPrevia.estado;

    const result = await TransactionWrapper.execute({
      operation: async (transaction) => {
        const remito = await Remito.findByPk(remitoId, { transaction });
        if (!remito) {
          throw new Error('El remito no existe');
        }

        // Actualizar estado
        await remito.update(
          { estado: nuevoEstado },
          { transaction }
        );

        logger.info('Estado de remito actualizado:', {
          remitoId,
          estadoAnterior,
          estadoNuevo: nuevoEstado,
          usuarioId
        });

        return remito;
      },
      usuarioEmail: usuarioEmail || 'sistema@megatlon.com.ar',
      usuarioId,
      modulo: 'remitos',
      accion: 'cambiar_estado',
      recurso: 'Remito',
      recursoId: remitoId,
      descripcion: `Cambio de estado del remito ${remitoPrevia.numero_remito} de "${estadoAnterior}" a "${nuevoEstado}"`,
      valoresAnteriores: { estado: estadoAnterior },
      valoresNuevos: { estado: nuevoEstado },
      ipAddress,
      userAgent,
      transaction: externalTransaction
    });

    const remitoActualizado = result.data;

    // Enviar emails cuando el estado cambia a "en_transito" (fuera de la transacción - best effort)
    if (nuevoEstado === 'en_transito' && estadoAnterior === 'preparado') {
      setImmediate(async () => {
        try {
          logger.info('=== ENVÍO DE EMAILS EN ESTADO "EN_TRANSITO" - INICIANDO ===', {
            remitoId,
            numeroRemito: remitoPrevia.numero_remito
          });

          // Obtener remito completo con relaciones
          const remitoCompleto = await this.obtener(remitoId);

          // Obtener o regenerar PDF
          let rutaPDFParaEmail;
          try {
            const infoPDF = await pdfService.obtenerArchivoPDF(remitoPrevia.numero_remito, false);
            rutaPDFParaEmail = infoPDF.url;
            logger.info('✓ PDF encontrado en Storage', { url: rutaPDFParaEmail });
          } catch (error) {
            logger.warn('⚠️ PDF no encontrado en Storage, regenerando...');
            const remitoJSON = remitoCompleto.toJSON();
            remitoJSON.estado = nuevoEstado;
            remitoJSON.es_prestamo = remitoCompleto.detalles && remitoCompleto.detalles.some(d => d.es_prestamo);
            const resultadoPDF = await pdfService.generarPDF(remitoJSON, { confirmado: false });
            rutaPDFParaEmail = resultadoPDF.url;
          }

          // Descargar buffer PDF
          let pdfBuffer = null;
          try {
            const res = await pdfService.downloadArchivoPDF(remitoPrevia.numero_remito, false);
            pdfBuffer = res.buffer;
          } catch (e) {
            logger.warn('No se pudo descargar buffer PDF:', e.message);
          }

          // Enviar email a infraestructura
          await emailService.enviarAInfraestructura(remitoCompleto, rutaPDFParaEmail, pdfBuffer);
          logger.info('✓ EMAIL A INFRAESTRUCTURA ENVIADO');

          // Enviar email al solicitante
          const urlConfirmacion = tokenService.generarUrlConfirmacion(
            remitoCompleto.id,
            remitoCompleto.solicitante?.email,
            process.env.FRONTEND_URL || 'http://localhost:3000'
          );
          await emailService.enviarAlSolicitante(remitoCompleto, rutaPDFParaEmail, urlConfirmacion, pdfBuffer);
          logger.info('✓ EMAIL AL SOLICITANTE ENVIADO');

          logger.info('=== ENVÍO DE EMAILS EN ESTADO "EN_TRANSITO" - COMPLETADO ===');
        } catch (emailError) {
          logger.error('✗ ERROR ENVIANDO EMAILS EN ESTADO "EN_TRANSITO"', {
            error: emailError.message,
            stack: emailError.stack
          });
        }
      });
    }

    return remitoActualizado;
  }

  /**
   * Generar remito de devolución automático
   * Cuando se devuelven artículos préstamo
   */
  async generarRemitoDevolucion(remitoOriginalId, detalleIdsADevolver, usuarioEmail, options = {}) {
    const { transaction: externalTransaction, ipAddress = null, userAgent = null } = options;

    // Obtener remito original
    const remitoOriginal = await Remito.findByPk(remitoOriginalId);
    if (!remitoOriginal) {
      throw new Error('El remito original no existe');
    }

    // Buscar sede "Deposito" para devoluciones
    const sedeDeposito = await Sede.findOne({
      where: {
        nombre_sede: 'Deposito'
      }
    });

    if (!sedeDeposito) {
      throw new Error('No se encontró la sede "Deposito" para procesar la devolución');
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

    const result = await TransactionWrapper.execute({
      operation: async (transaction) => {
        // Crear remito de devolución
        const numeroRemito = await this.generarNumeroRemito(transaction);
        const remitoDevolucion = await Remito.create({
          numero_remito: numeroRemito,
          fecha: new Date(),
          sede_origen_id: remitoOriginal.sede_destino_id, // Inverted
          sede_destino_id: remitoOriginal.sede_origen_id,  // Inverted
          solicitante_id: remitoOriginal.solicitante_id,
          tecnico_asignado_id: remitoOriginal.tecnico_asignado_id,
          estado: 'preparado',
          observaciones: `Devolución de remito ${remitoOriginal.numero_remito}`
        }, { transaction });

        // Crear detalles de devolución
        for (const detalleOriginal of detallesADevolver) {
          // NOTA: hooks: false para evitar que el hook afterCreate cree historial duplicado
          // El historial de devolución se crea explícitamente más abajo con tipo 'devolucion'
          await RemitoDetalle.create({
            remito_id: remitoDevolucion.id,
            inventario_id: detalleOriginal.inventario_id,
            es_prestamo: false,
            devuelto: false
          }, { transaction, hooks: false });

          // Actualizar ubicación y estado: devolver a Deposito y marcar como disponible
          await Inventario.update(
            {
              sede_id: sedeDeposito.id,
              estado: 'disponible' // Revertir estado a disponible cuando se devuelve el artículo
            },
            {
              where: { id: detalleOriginal.inventario_id },
              transaction
            }
          );

          // Marcar como devuelto en remito original
          await detalleOriginal.update(
            { devuelto: true },
            { transaction }
          );

          // Crear historial de devolución
          await HistorialMovimiento.create({
            inventario_id: detalleOriginal.inventario_id,
            remito_id: remitoDevolucion.id,
            sede_origen_id: remitoOriginal.sede_destino_id,
            sede_destino_id: sedeDeposito.id,
            tipo_movimiento: 'devolucion',
            fecha_movimiento: new Date(),
            observaciones: `Devolución de préstamo - Remito original: ${remitoOriginal.numero_remito}`
          }, { transaction });
        }

        return remitoDevolucion;
      },
      usuarioEmail: usuarioEmail || 'sistema@megatlon.com.ar',
      modulo: 'remitos',
      accion: 'generar_devolucion',
      recurso: 'Remito',
      descripcion: `Generó remito de devolución para remito ${remitoOriginal.numero_remito} con ${detallesADevolver.length} artículo(s)`,
      valoresNuevos: {
        remito_original_id: remitoOriginalId,
        articulos_devueltos: detallesADevolver.length
      },
      ipAddress,
      userAgent,
      transaction: externalTransaction
    });

    logger.info('Remito de devolución creado:', {
      remitoOriginalId,
      remitoDevolucionId: result.data.id,
      articulosDevueltos: detallesADevolver.length
    });

    return result.data;
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

  /**
   * Confirmar recepción de un remito mediante token JWT
   * @param {number} remitoId - ID del remito
   * @param {string} token - Token JWT de confirmación
   * @returns {Promise<object>} Remito actualizado con estado COMPLETADO
   */
  async confirmarRecepcion(remitoId, token) {
    logger.info('Iniciando confirmación de recepción:', { remitoId });

    // 1. Validar token JWT (fuera de transacción)
    let tokenPayload;
    try {
      tokenPayload = tokenService.validarTokenConfirmacion(token);
    } catch (tokenError) {
      throw new Error(`Token de confirmación ${tokenError.message}`);
    }

    // 2. Validar que el remitoId del token coincide
    if (tokenPayload.remitoId.toString() !== remitoId.toString()) {
      throw new Error('El token no corresponde a este remito');
    }

    logger.info('Token validado correctamente:', {
      remitoId: tokenPayload.remitoId,
      email: tokenPayload.email
    });

    // 3. Obtener remito para validaciones (fuera de transacción)
    const remitoPrevia = await Remito.findByPk(remitoId, {
      include: [
        {
          model: Personal,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
        },
        {
          model: Personal,
          as: 'tecnicoAsignado',
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Sede,
          as: 'sedeOrigen',
          attributes: ['id', 'nombre_sede']
        },
        {
          model: Sede,
          as: 'sedeDestino',
          attributes: ['id', 'nombre_sede']
        },
        {
          model: RemitoDetalle,
          as: 'detalles',
          include: [{
            model: Inventario,
            as: 'inventarioDetalle',
            attributes: ['id', 'numero_serie', 'marca', 'modelo', 'tipo_articulo_id'],
            include: [{
              model: TipoArticulo,
              as: 'tipoArticulo',
              attributes: ['id', 'nombre']
            }]
          }]
        }
      ]
    });

    if (!remitoPrevia) {
      throw new Error('El remito no existe');
    }

    // 3.1 Validar que el email del token coincide con receptor O solicitante
    const emailToken = tokenPayload.email.toLowerCase();
    const emailSolicitante = remitoPrevia.solicitante?.email?.toLowerCase();
    const emailReceptor = remitoPrevia.receptor_email?.toLowerCase();

    const esEmailValido = emailToken === emailSolicitante || (emailReceptor && emailToken === emailReceptor);

    if (!esEmailValido) {
      logger.warn('Email del token no coincide:', {
        emailToken,
        emailSolicitante,
        emailReceptor,
        remitoId
      });
      throw new Error('El email del token no coincide con el solicitante ni con el receptor del remito');
    }

    // 4. Verificar que el remito no esté ya confirmado
    if (remitoPrevia.estado === 'completado') {
      throw new Error('Este remito ya fue confirmado previamente');
    }

    const estadoAnterior = remitoPrevia.estado;
    const fechaConfirmacion = new Date();

    const result = await TransactionWrapper.execute({
      operation: async (transaction) => {
        const remito = await Remito.findByPk(remitoId, {
          include: [
            { model: Personal, as: 'solicitante' },
            { model: Personal, as: 'tecnicoAsignado' },
            { model: Sede, as: 'sedeOrigen' },
            { model: Sede, as: 'sedeDestino' },
            {
              model: RemitoDetalle, as: 'detalles',
              include: [{
                model: Inventario, as: 'inventarioDetalle',
                include: [{ model: TipoArticulo, as: 'tipoArticulo' }]
              }]
            }
          ],
          transaction
        });

        // Actualizar estado del remito a COMPLETADO
        remito.estado = 'completado';
        await remito.save({ transaction });

        logger.info('Estado del remito actualizado a COMPLETADO:', {
          numeroRemito: remito.numero_remito
        });

        return remito;
      },
      usuarioEmail: tokenPayload.email || 'confirmacion_automatica@sistema.com',
      modulo: 'remitos',
      accion: 'confirmar_recepcion',
      recurso: 'Remito',
      recursoId: remitoId,
      descripcion: `Confirmación de recepción del remito ${remitoPrevia.numero_remito}`,
      valoresAnteriores: { estado: estadoAnterior },
      valoresNuevos: { estado: 'completado' },
      ipAddress: 'token-confirmation'
    });

    const remito = result.data;

    // Generar PDF con watermark de confirmación (fuera de transacción - best effort)
    const remitoCompleto = remito.toJSON();
    remitoCompleto.es_prestamo = remito.detalles && remito.detalles.some(d => d.es_prestamo);
    remitoCompleto.estado = 'completado';

    let resultadoPDFConfirmado;
    try {
      logger.info('=== GENERACIÓN DE PDF CONFIRMADO - INICIANDO ===');

      resultadoPDFConfirmado = await pdfService.generarPDF(
        remitoCompleto,
        {
          confirmado: true,
          fechaConfirmacion: fechaConfirmacion
        }
      );

      logger.info('✓ PDF CONFIRMADO GENERADO EXITOSAMENTE', {
        rutaPDF: resultadoPDFConfirmado.url
      });
    } catch (pdfError) {
      logger.error('✗ ERROR GENERANDO PDF CONFIRMADO', {
        error: pdfError.message
      });
      // No lanzamos error, el remito ya fue confirmado
    }

    logger.info('Confirmación de recepción completada exitosamente:', {
      numeroRemito: remito.numero_remito,
      fechaConfirmacion
    });

    // Enviar email de confirmación (asincrónico - best effort)
    if (resultadoPDFConfirmado) {
      setImmediate(async () => {
        try {
          await emailService.enviarConfirmacionRecepcion(
            remitoCompleto,
            resultadoPDFConfirmado.url,
            tokenPayload.email,
            fechaConfirmacion,
            resultadoPDFConfirmado.buffer
          );
          logger.info('Email de confirmación enviado');
        } catch (emailError) {
          logger.error('Error enviando email de confirmación:', {
            error: emailError.message
          });
        }
      });
    }

    return {
      success: true,
      numeroRemito: remito.numero_remito,
      estado: 'completado',
      fechaConfirmacion: fechaConfirmacion.toLocaleString('es-AR'),
      pdfConfirmado: resultadoPDFConfirmado?.url || null
    };
  }

  /**
   * Reenviar emails del remito (a infraestructura y solicitante)
   * @param {number} remitoId - ID del remito
   * @returns {Promise<object>} Resultado del reenvío
   */
  async reenviarEmails(remitoId) {
    try {
      logger.info('=== REENVÍO DE EMAILS - INICIANDO ===', { remitoId });

      // 1. Obtener remito con relaciones
      const remito = await Remito.findByPk(remitoId, {
        include: [
          {
            model: Personal,
            as: 'solicitante',
            attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
          },
          {
            model: Personal,
            as: 'tecnicoAsignado',
            attributes: ['id', 'nombre', 'apellido', 'email']
          },
          {
            model: Sede,
            as: 'sedeOrigen',
            attributes: ['id', 'nombre_sede']
          },
          {
            model: Sede,
            as: 'sedeDestino',
            attributes: ['id', 'nombre_sede']
          },
          {
            model: RemitoDetalle,
            as: 'detalles',
            include: [{
              model: Inventario,
              as: 'inventarioDetalle',
              attributes: ['id', 'numero_serie', 'marca', 'modelo', 'tipo_articulo_id'],
              include: [{
                model: TipoArticulo,
                as: 'tipoArticulo',
                attributes: ['id', 'nombre']
              }]
            }]
          }
        ]
      });

      if (!remito) {
        throw new Error('El remito no existe');
      }

      logger.info('✓ Remito encontrado', {
        remitoId,
        numeroRemito: remito.numero_remito,
        solicitante: remito.solicitante?.email,
        estado: remito.estado
      });

      // 2. Verificar si el PDF existe
      // 2. Verificar si el PDF existe en Storage
      const nombreArchivo = pdfService.generarNombreArchivo(remito.numero_remito, false);
      let rutaArchivo;

      try {
        const infoPDF = await pdfService.obtenerArchivoPDF(remito.numero_remito, false);
        rutaArchivo = infoPDF.url;
        logger.info('✓ PDF encontrado en Storage', {
          remitoId,
          url: rutaArchivo
        });
      } catch (error) {
        logger.warn('⚠ PDF no encontrado en Storage, regenerando...');

        // Regenerar PDF
        const remitoCompletoJSON = remito.toJSON();
        remitoCompletoJSON.es_prestamo = remito.detalles && remito.detalles.some(d => d.es_prestamo);

        const resultadoPDF = await pdfService.generarPDF(remitoCompletoJSON, { confirmado: false });
        rutaArchivo = resultadoPDF.url;

        logger.info('✓ PDF regenerado exitosamente', {
          remitoId,
          url: resultadoPDF.url,
          tamaño: resultadoPDF.size
        });
      }

      // Usar obtener para asegurar que todas las relaciones se cargan correctamente
      const remitoCompleto = await this.obtener(remitoId);

      // Ejecutar envío de emails en segundo plano para evitar timeouts
      // 3. Reenviar email a infraestructura
      try {
        logger.info('📧 Enviando email a infraestructura...', {
          remitoId,
          numeroRemito: remitoCompleto.numero_remito,
          emailInfraestructura: process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar'
        });
        // Descargar el PDF como buffer para enviar (si no se obtuvo antes al generar)
        let pdfBuffer = null;
        try {
          const res = await pdfService.downloadArchivoPDF(remitoCompleto.numero_remito, false);
          pdfBuffer = res.buffer;
        } catch (err) {
          logger.warn('Error descargando PDF para reenvío, se intentará con URL:', err.message);
        }

        await emailService.enviarAInfraestructura(remitoCompleto, rutaArchivo, pdfBuffer);
        logger.info('✓ Email a infraestructura enviado exitosamente', {
          remitoId,
          numeroRemito: remitoCompleto.numero_remito,
          timestamp: new Date().toISOString()
        });
      } catch (emailError) {
        logger.error('✗ Error enviando email a infraestructura', {
          remitoId,
          numeroRemito: remitoCompleto.numero_remito,
          error: emailError.message,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Error enviando email a infraestructura: ${emailError.message}`);
      }

      // 4. Reenviar email al solicitante con link de confirmación
      try {
        logger.info('📧 Enviando email al solicitante...', {
          remitoId,
          numeroRemito: remitoCompleto.numero_remito,
          emailSolicitante: remitoCompleto.solicitante?.email,
          solicitanteName: `${remitoCompleto.solicitante?.nombre} ${remitoCompleto.solicitante?.apellido}`
        });
        const urlConfirmacion = tokenService.generarUrlConfirmacion(
          remitoCompleto.id,
          remitoCompleto.solicitante?.email,
          process.env.FRONTEND_URL || 'http://localhost:3000'
        );

        // Descargar el PDF como buffer para enviar de nuevo si es necesario
        let pdfBufferSolicitante = null;
        try {
          const res = await pdfService.downloadArchivoPDF(remitoCompleto.numero_remito, false);
          pdfBufferSolicitante = res.buffer;
        } catch (err) { }

        await emailService.enviarAlSolicitante(remitoCompleto, rutaArchivo, urlConfirmacion, pdfBufferSolicitante);

        logger.info('✓ Email al solicitante enviado exitosamente', {
          remitoId,
          numeroRemito: remitoCompleto.numero_remito,
          emailSolicitante: remitoCompleto.solicitante?.email,
          timestamp: new Date().toISOString()
        });
      } catch (emailError) {
        logger.error('✗ Error enviando email al solicitante', {
          remitoId,
          numeroRemito: remitoCompleto.numero_remito,
          emailSolicitante: remitoCompleto.solicitante?.email,
          error: emailError.message,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Error enviando email al solicitante: ${emailError.message}`);
      }

      logger.info('=== REENVÍO DE EMAILS - COMPLETADO EXITOSAMENTE ===', {
        remitoId,
        numeroRemito: remitoCompleto.numero_remito,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        numeroRemito: remitoCompleto.numero_remito,
        emailInfraestructura: 'infraestructura@megatlon.com.ar',
        emailSolicitante: remitoCompleto.solicitante?.email,
        timestamp: new Date().toISOString(),
        mensaje: 'Emails reenviados exitosamente'
      };
    } catch (error) {
      logger.error('=== REENVÍO DE EMAILS - ERROR ===', {
        error: error.message,
        remitoId,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Enviar aviso de devolución próxima para un préstamo específico
   * Se ejecuta cuando un artículo vence en 1 día
   */
  async enviarAvisoDevolucionProxima(remitoDetalleId) {
    try {
      logger.info('Enviando aviso de devolución próxima:', { remitoDetalleId });

      // Obtener el detalle del remito con todas sus relaciones
      const detalle = await RemitoDetalle.findByPk(remitoDetalleId, {
        include: [
          {
            association: 'remito',
            include: [
              { association: 'solicitante', attributes: ['id', 'nombre', 'apellido', 'email'] },
              { association: 'tecnicoAsignado', attributes: ['id', 'nombre', 'apellido'] },
              { association: 'sedeOrigen', attributes: ['id', 'nombre_sede'] },
              { association: 'sedeDestino', attributes: ['id', 'nombre_sede'] }
            ]
          },
          { association: 'inventarioDetalle' }
        ]
      });

      if (!detalle || !detalle.remito) {
        throw new Error('Detalle de remito no encontrado');
      }

      if (!detalle.es_prestamo) {
        throw new Error('Este detalle no es un préstamo');
      }

      const remito = detalle.remito;
      const inventario = detalle.inventarioDetalle;
      const fechaVencimiento = new Date(detalle.fecha_devolucion_esperada);

      // Formato dd-mm-yyyy
      const day = String(fechaVencimiento.getDate()).padStart(2, '0');
      const month = String(fechaVencimiento.getMonth() + 1).padStart(2, '0');
      const year = fechaVencimiento.getFullYear();
      const fechaFormato = `${day}-${month}-${year}`;

      const descripcionArticulo = `${inventario?.tipoArticulo?.nombre || 'Artículo'} - ${inventario?.marca} ${inventario?.modelo}${inventario?.numero_serie ? ` (SN: ${inventario.numero_serie})` : ''}`;
      const asunto = `AVISO: Devolución mañana - Remito ${remito.numero_remito}`;

      const contenidoEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d9534f; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
    .alert-box { background-color: #f8d7da; border-left: 4px solid #d9534f; padding: 15px; margin: 15px 0; }
    .article-box { background-color: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    strong { color: #d9534f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>⚠️ RECORDATORIO: DEVOLUCIÓN MAÑANA</h2>
    </div>
    <div class="content">
      <div class="alert-box">
        <p><strong style="font-size: 16px;">El artículo en préstamo debe ser devuelto MAÑANA (${fechaFormato})</strong></p>
      </div>

      <p>Este es un aviso de que el siguiente artículo debe ser devuelto en la fecha especificada:</p>

      <div class="article-box">
        <p><strong>Artículo:</strong> ${descripcionArticulo}</p>
        <p><strong>Remito:</strong> ${remito.numero_remito}</p>
        <p><strong>Fecha de devolución:</strong> <strong style="color: #d9534f; font-size: 16px;">${fechaFormato}</strong></p>
      </div>

      <p><strong>Información del remito:</strong></p>
      <ul>
        <li>Solicitante: ${remito.solicitante?.nombre} ${remito.solicitante?.apellido}</li>
        <li>Técnico asignado: ${remito.tecnicoAsignado?.nombre} ${remito.tecnicoAsignado?.apellido}</li>
        <li>Sede origen (devolución): ${remito.sedeOrigen?.nombre_sede}</li>
        <li>Sede actual (destino): ${remito.sedeDestino?.nombre_sede}</li>
      </ul>

      <p>Por favor, asegúrate de devolver el artículo en la fecha indicada para evitar demoras operacionales.</p>
    </div>
    <div class="footer">
      <p>Este es un email automático del Sistema de Gestión Empresarial. No responder a este email.</p>
    </div>
  </div>
</body>
</html>
      `;

      // Enviar a infraestructura
      await emailService.enviarEmailHTML(
        'infraestructura@megatlon.com.ar',
        asunto,
        contenidoEmail
      );

      // Enviar al solicitante
      if (remito.solicitante?.email) {
        await emailService.enviarEmailHTML(
          remito.solicitante.email,
          asunto,
          contenidoEmail
        );
      }

      logger.info('Aviso de devolución próxima enviado exitosamente', {
        remitoDetalleId,
        remitoId: remito.id,
        numeroRemito: remito.numero_remito,
        fechaVencimiento: fechaFormato,
        solicitanteEmail: remito.solicitante?.email
      });

      return {
        success: true,
        mensaje: 'Aviso de devolución próxima enviado exitosamente',
        detalles: {
          remitoNumero: remito.numero_remito,
          articulo: descripcionArticulo,
          fechaVencimiento: fechaFormato,
          emailsEnviados: [
            'infraestructura@megatlon.com.ar',
            remito.solicitante?.email
          ].filter(Boolean)
        }
      };
    } catch (error) {
      logger.error('Error enviando aviso de devolución próxima:', {
        error: error.message,
        remitoDetalleId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Asignar receptor alternativo a un remito en tránsito
   * @param {string} remitoId - ID del remito
   * @param {string} receptorNombre - Nombre completo del receptor
   * @param {string} receptorEmail - Email del receptor
   * @param {string} usuarioEmail - Email del usuario que realiza la acción
   * @returns {Promise<object>} Resultado de la operación
   */
  async asignarReceptor(remitoId, receptorNombre, receptorEmail, usuarioEmail) {
    try {
      logger.info('=== ASIGNAR RECEPTOR - INICIANDO ===', {
        remitoId,
        receptorNombre,
        receptorEmail,
        usuarioEmail
      });

      // 1. Obtener remito con todas las relaciones
      const remito = await Remito.findByPk(remitoId, {
        include: [
          {
            model: Personal,
            as: 'solicitante',
            attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
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
              attributes: ['id', 'numero_serie', 'marca', 'modelo', 'tipo_articulo_id'],
              include: [{
                model: TipoArticulo,
                as: 'tipoArticulo',
                attributes: ['id', 'nombre']
              }]
            }]
          }
        ]
      });

      if (!remito) {
        throw new Error('El remito no existe');
      }

      // 2. Validar que el remito está en estado "en_transito"
      if (remito.estado !== 'en_transito') {
        throw new Error(`Solo se puede asignar receptor a remitos en estado "en_transito". Estado actual: "${remito.estado}"`);
      }

      logger.info('✓ Remito validado', {
        numeroRemito: remito.numero_remito,
        estado: remito.estado
      });

      // 3. Actualizar campos de receptor
      await remito.update({
        receptor_nombre: receptorNombre,
        receptor_email: receptorEmail.toLowerCase()
      });

      logger.info('✓ Receptor asignado en base de datos', {
        numeroRemito: remito.numero_remito,
        receptorNombre,
        receptorEmail
      });

      // 4. Regenerar PDF con información de receptor
      const remitoCompleto = remito.toJSON();
      remitoCompleto.es_prestamo = remito.detalles && remito.detalles.some(d => d.es_prestamo);
      remitoCompleto.receptor_nombre = receptorNombre;
      remitoCompleto.receptor_email = receptorEmail;

      let rutaPDF;
      try {
        logger.info('📄 Regenerando PDF con receptor...', {
          numeroRemito: remito.numero_remito,
          receptorNombre
        });

        const resultadoPDF = await pdfService.generarPDF(remitoCompleto, { confirmado: false });
        rutaPDF = resultadoPDF.path;

        logger.info('✓ PDF regenerado con receptor', {
          numeroRemito: remito.numero_remito,
          rutaPDF,
          tamaño: resultadoPDF.size
        });
      } catch (pdfError) {
        logger.error('✗ Error regenerando PDF', {
          error: pdfError.message,
          numeroRemito: remito.numero_remito
        });
        throw new Error(`Error generando PDF: ${pdfError.message}`);
      }

      // 5. Enviar email al receptor con link de confirmación
      try {
        logger.info('📧 Enviando email al receptor...', {
          numeroRemito: remito.numero_remito,
          receptorEmail,
          receptorNombre
        });

        const urlConfirmacion = tokenService.generarUrlConfirmacion(
          remito.id,
          receptorEmail,
          process.env.FRONTEND_URL || 'http://localhost:3000'
        );

        await emailService.enviarAlReceptor(remitoCompleto, rutaPDF, urlConfirmacion, receptorNombre, receptorEmail);

        logger.info('✓ Email al receptor enviado', {
          numeroRemito: remito.numero_remito,
          receptorEmail
        });
      } catch (emailError) {
        logger.error('✗ Error enviando email al receptor', {
          error: emailError.message,
          numeroRemito: remito.numero_remito,
          receptorEmail
        });
        throw new Error(`Error enviando email al receptor: ${emailError.message}`);
      }

      // 6. Enviar email al solicitante informando del cambio
      try {
        logger.info('📧 Enviando email al solicitante...', {
          numeroRemito: remito.numero_remito,
          solicitanteEmail: remito.solicitante?.email,
          receptorNombre
        });

        await emailService.enviarNotificacionCambioReceptor(
          remitoCompleto,
          rutaPDF,
          remito.solicitante?.email,
          receptorNombre,
          receptorEmail
        );

        logger.info('✓ Email al solicitante enviado', {
          numeroRemito: remito.numero_remito,
          solicitanteEmail: remito.solicitante?.email
        });
      } catch (emailError) {
        logger.error('✗ Error enviando email al solicitante', {
          error: emailError.message,
          numeroRemito: remito.numero_remito,
          solicitanteEmail: remito.solicitante?.email
        });
        // No lanzar error, es solo notificación
      }

      // 7. Enviar copia a infraestructura
      try {
        logger.info('📧 Enviando copia a infraestructura...', {
          numeroRemito: remito.numero_remito
        });

        await emailService.enviarAInfraestructura(remitoCompleto, rutaPDF);

        logger.info('✓ Email a infraestructura enviado', {
          numeroRemito: remito.numero_remito
        });
      } catch (emailError) {
        logger.error('✗ Error enviando email a infraestructura', {
          error: emailError.message,
          numeroRemito: remito.numero_remito
        });
        // No lanzar error, es solo notificación
      }

      logger.info('=== ASIGNAR RECEPTOR - COMPLETADO EXITOSAMENTE ===', {
        numeroRemito: remito.numero_remito,
        receptorNombre,
        receptorEmail
      });

      return {
        success: true,
        numeroRemito: remito.numero_remito,
        receptorNombre,
        receptorEmail,
        mensaje: `Receptor asignado exitosamente. Emails enviados a ${receptorEmail} y ${remito.solicitante?.email}`
      };
    } catch (error) {
      logger.error('=== ASIGNAR RECEPTOR - ERROR ===', {
        error: error.message,
        remitoId,
        receptorNombre,
        receptorEmail,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Resolver personal asociado a un usuario autenticado.
   * Si no existe en la BD, intenta auto-provisioning desde Azure AD.
   * @param {Object} user - Datos del usuario autenticado (email, role, groups, etc.)
   * @returns {Promise<Object|null>} Registro de Personal con rol incluido, o null si no se pudo resolver
   */
  async resolverPersonal(user) {
    // Buscar por email
    let personal = await Personal.findOne({
      where: { email: user.email.toLowerCase(), activo: true },
      include: [{
        model: Rol,
        as: 'rol',
        attributes: ['nombre']
      }]
    });

    if (personal) return personal;

    // Intentar auto-provisioning
    logger.info('Personal no encontrado, intentando auto-provisioning:', { email: user.email });

    try {
      await personalService.autoProvisionarPersonal(user, {
        role: user.role || 'user',
        permissions: []
      });

      personal = await Personal.findOne({
        where: { email: user.email.toLowerCase(), activo: true },
        include: [{
          model: Rol,
          as: 'rol',
          attributes: ['nombre']
        }]
      });
    } catch (provisioningError) {
      logger.warn('Error en auto-provisioning:', {
        email: user.email,
        error: provisioningError.message
      });
    }

    return personal;
  }
}

export default new RemitoService();
