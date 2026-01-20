// src/shared/services/auditService.js - SERVICIO DE AUDITORÍA CENTRALIZADO
import { Auditoria } from '../../models/index.js';
import logger from '../utils/logger.js';

/**
 * Servicio centralizado para logging de auditoría
 * Registra todas las acciones de los usuarios para auditoría y compliance
 */
class AuditService {
  /**
   * Registrar una acción de auditoría
   * @param {Object} params - Parámetros de auditoría
   * @param {string} params.usuario_email - Email del usuario que realizó la acción
   * @param {string} [params.usuario_id] - ID del usuario (UUID)
   * @param {string} params.modulo - Módulo afectado (ej: 'inventario', 'sedes')
   * @param {string} params.accion - Tipo de acción (crear, actualizar, eliminar, cambiar_estado, etc.)
   * @param {string} params.recurso - Tipo de recurso afectado (ej: 'Inventario', 'Sede')
   * @param {string} [params.recurso_id] - ID del recurso afectado
   * @param {string} [params.descripcion] - Descripción detallada
   * @param {Object} [params.valores_anteriores] - Valores antes del cambio
   * @param {Object} [params.valores_nuevos] - Valores después del cambio
   * @param {string} [params.ip_address] - IP del cliente
   * @param {string} [params.user_agent] - User agent del navegador
   * @param {string} [params.resultado='exitoso'] - Resultado (exitoso, fallido, parcial)
   * @param {string} [params.mensaje_error] - Mensaje de error si falló
   * @returns {Promise<Object>} Registro de auditoría creado
   */
  static async registrarAccion(params) {
    try {
      const {
        usuario_email,
        usuario_id = null,
        modulo,
        accion,
        recurso,
        recurso_id = null,
        descripcion = null,
        valores_anteriores = null,
        valores_nuevos = null,
        ip_address = null,
        user_agent = null,
        resultado = 'exitoso',
        mensaje_error = null
      } = params;

      // Validar parámetros requeridos
      if (!usuario_email || !modulo || !accion || !recurso) {
        throw new Error('Faltan parámetros requeridos para auditoría (usuario_email, modulo, accion, recurso)');
      }

      // Crear registro de auditoría
      const registro = await Auditoria.create({
        usuario_email,
        usuario_id,
        modulo,
        accion,
        recurso,
        recurso_id,
        descripcion,
        valores_anteriores: valores_anteriores ? JSON.stringify(valores_anteriores) : null,
        valores_nuevos: valores_nuevos ? JSON.stringify(valores_nuevos) : null,
        ip_address,
        user_agent,
        resultado,
        mensaje_error,
        fecha_accion: new Date()
      });

      return registro;
    } catch (error) {
      // Log del error pero no lanzar excepción para no detener la operación principal
      logger.error('Error registrando auditoría:', {
        mensaje: error.message,
        stack: error.stack,
        params
      });
      return null;
    }
  }

  /**
   * Registrar múltiples acciones en una transacción
   * @param {Array<Object>} acciones - Array de acciones a registrar
   * @param {Object} transaction - Transacción de Sequelize
   * @returns {Promise<Array>} Registros de auditoría creados
   */
  static async registrarMultiples(acciones, transaction = null) {
    try {
      const registros = [];
      for (const accion of acciones) {
        const registro = await Auditoria.create({
          ...accion,
          valores_anteriores: accion.valores_anteriores ? JSON.stringify(accion.valores_anteriores) : null,
          valores_nuevos: accion.valores_nuevos ? JSON.stringify(accion.valores_nuevos) : null,
          fecha_accion: new Date()
        }, { transaction });
        registros.push(registro);
      }
      return registros;
    } catch (error) {
      logger.error('Error registrando múltiples auditorías:', error.message);
      return [];
    }
  }

  /**
   * Obtener historial de auditoría para un usuario
   * @param {string} usuario_email - Email del usuario
   * @param {Object} [opciones] - Opciones de filtrado
   * @returns {Promise<Array>} Registros de auditoría
   */
  static async obtenerHistorialUsuario(usuario_email, opciones = {}) {
    const {
      limite = 100,
      offset = 0,
      modulo = null,
      accion = null,
      desde = null,
      hasta = null
    } = opciones;

    const where = { usuario_email };

    if (modulo) where.modulo = modulo;
    if (accion) where.accion = accion;
    if (desde || hasta) {
      where.fecha_accion = {};
      if (desde) where.fecha_accion.$gte = new Date(desde);
      if (hasta) where.fecha_accion.$lte = new Date(hasta);
    }

    return await Auditoria.findAll({
      where,
      order: [['fecha_accion', 'DESC']],
      limit: parseInt(limite),
      offset: parseInt(offset)
    });
  }

  /**
   * Obtener historial para un recurso específico
   * @param {string} recurso_id - ID del recurso
   * @param {Object} [opciones] - Opciones de filtrado
   * @returns {Promise<Array>} Registros de auditoría
   */
  static async obtenerHistorialRecurso(recurso_id, opciones = {}) {
    const {
      limite = 50,
      offset = 0,
      modulo = null
    } = opciones;

    const where = { recurso_id };
    if (modulo) where.modulo = modulo;

    return await Auditoria.findAll({
      where,
      order: [['fecha_accion', 'DESC']],
      limit: parseInt(limite),
      offset: parseInt(offset)
    });
  }

  /**
   * Obtener estadísticas de auditoría
   * @param {Object} [opciones] - Opciones de filtrado
   * @returns {Promise<Object>} Estadísticas
   */
  static async obtenerEstadisticas(opciones = {}) {
    const {
      desde = null,
      hasta = null
    } = opciones;

    const where = {};
    if (desde || hasta) {
      where.fecha_accion = {};
      if (desde) where.fecha_accion.$gte = new Date(desde);
      if (hasta) where.fecha_accion.$lte = new Date(hasta);
    }

    // Total de registros
    const total = await Auditoria.count({ where });

    // Acciones por tipo
    const acciones = await Auditoria.findAll({
      attributes: [
        'accion',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      where,
      group: ['accion'],
      raw: true
    });

    // Usuarios más activos
    const usuarios = await Auditoria.findAll({
      attributes: [
        'usuario_email',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      where,
      group: ['usuario_email'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    // Módulos más accedidos
    const modulos = await Auditoria.findAll({
      attributes: [
        'modulo',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      where,
      group: ['modulo'],
      raw: true
    });

    return {
      total,
      acciones,
      usuarios_activos: usuarios,
      modulos_accedidos: modulos,
      periodo: { desde, hasta }
    };
  }

  /**
   * Limpiar auditoría antigua (archivar registros)
   * Mantiene auditoría de los últimos N días
   * @param {number} diasRetener - Días a retener (default: 90)
   * @returns {Promise<number>} Registros eliminados
   */
  static async limpiarAntigua(diasRetener = 90) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasRetener);

    try {
      const deletedCount = await Auditoria.destroy({
        where: {
          fecha_accion: {
            $lt: fechaLimite
          }
        }
      });

      logger.info(`Se eliminaron ${deletedCount} registros de auditoría antiguos`);
      return deletedCount;
    } catch (error) {
      logger.error('Error limpiando auditoría antigua:', error.message);
      return 0;
    }
  }
}

export default AuditService;
