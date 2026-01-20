// src/shared/utils/transactionWrapper.js - UTILIDAD DE TRANSACCIONES CON AUDITORÍA
import { sequelize } from './database.js';
import AuditService from '../services/auditService.js';
import logger from './logger.js';

/**
 * Wrapper para ejecutar operaciones dentro de transacciones automáticas
 * Maneja: validación, ejecución, auditoría y rollback automático
 */
class TransactionWrapper {
  /**
   * Ejecutar operación dentro de transacción
   * @param {Object} params - Parámetros de la operación
   * @param {Function} params.operation - Función async a ejecutar dentro de la transacción
   * @param {string} params.usuarioEmail - Email del usuario realizando la operación
   * @param {string} [params.usuarioId] - ID del usuario (UUID)
   * @param {string} params.modulo - Módulo afectado (inventario, sedes, etc.)
   * @param {string} params.accion - Tipo de acción (crear, actualizar, eliminar, cambiar_estado)
   * @param {string} params.recurso - Tipo de recurso afectado
   * @param {string} [params.recursoId] - ID del recurso afectado
   * @param {Object} [params.valoresAnteriores] - Valores antes de la operación
   * @param {string} [params.descripcion] - Descripción adicional
   * @param {string} [params.ipAddress] - IP del cliente
   * @param {string} [params.userAgent] - User agent del navegador
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async execute(params) {
    const {
      operation,
      usuarioEmail,
      usuarioId = null,
      modulo,
      accion,
      recurso,
      recursoId = null,
      valoresAnteriores = null,
      descripcion = null,
      ipAddress = null,
      userAgent = null
    } = params;

    // Validar parámetros requeridos
    if (!operation || typeof operation !== 'function') {
      throw new Error('Se requiere una función operation válida');
    }
    if (!usuarioEmail || !modulo || !accion || !recurso) {
      throw new Error('Faltan parámetros requeridos: usuarioEmail, modulo, accion, recurso');
    }

    let transaction = null;
    let resultado = 'exitoso';
    let mensajeError = null;
    let valoresNuevos = null;
    let operationResult = null;

    try {
      // Crear transacción
      transaction = await sequelize.transaction();

      // Ejecutar operación dentro de la transacción
      operationResult = await operation(transaction);

      // Guardar valores nuevos del resultado
      valoresNuevos = operationResult?.data || operationResult;

      // Commit de la transacción
      await transaction.commit();

      logger.debug(`Operación exitosa: ${modulo}/${accion}/${recurso}`);
    } catch (error) {
      // Rollback de la transacción en caso de error
      if (transaction) {
        await transaction.rollback();
      }

      resultado = 'fallido';
      mensajeError = error.message;

      logger.error(`Error en transacción ${modulo}/${accion}/${recurso}:`, {
        mensaje: error.message,
        stack: error.stack
      });

      // Re-lanzar el error para que el controlador lo maneje
      throw error;
    } finally {
      // Registrar la auditoría (aunque sea fallida)
      try {
        await AuditService.registrarAccion({
          usuario_email: usuarioEmail,
          usuario_id: usuarioId,
          modulo,
          accion,
          recurso,
          recurso_id: recursoId,
          descripcion,
          valores_anteriores: valoresAnteriores,
          valores_nuevos: valoresNuevos,
          ip_address: ipAddress,
          user_agent: userAgent,
          resultado,
          mensaje_error: mensajeError
        });
      } catch (auditError) {
        logger.warn('Error registrando auditoría:', auditError.message);
        // No lanzar error de auditoría para no interrumpir la operación
      }
    }

    return {
      success: true,
      data: operationResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ejecutar múltiples operaciones en una sola transacción
   * @param {Object} params - Parámetros
   * @param {Array<Function>} params.operations - Array de funciones async a ejecutar
   * @param {string} params.usuarioEmail - Email del usuario
   * @param {string} [params.usuarioId] - ID del usuario
   * @param {string} params.modulo - Módulo afectado
   * @param {string} params.descripcion - Descripción general de la operación
   * @param {string} [params.ipAddress] - IP del cliente
   * @param {string} [params.userAgent] - User agent
   * @returns {Promise<Array>} Resultados de todas las operaciones
   */
  static async executeBatch(params) {
    const {
      operations,
      usuarioEmail,
      usuarioId = null,
      modulo,
      descripcion,
      ipAddress = null,
      userAgent = null
    } = params;

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      throw new Error('Se requiere un array de operaciones válido');
    }

    let transaction = null;
    let resultados = [];
    let resultado = 'exitoso';
    let mensajeError = null;

    try {
      // Crear una sola transacción para todas las operaciones
      transaction = await sequelize.transaction();

      // Ejecutar todas las operaciones secuencialmente dentro de la misma transacción
      for (let i = 0; i < operations.length; i++) {
        const operationResult = await operations[i](transaction);
        resultados.push(operationResult);
      }

      // Commit de la transacción
      await transaction.commit();

      logger.debug(`Operaciones batch exitosas en ${modulo}: ${operations.length} operaciones`);
    } catch (error) {
      // Rollback de la transacción en caso de error
      if (transaction) {
        await transaction.rollback();
      }

      resultado = 'fallido';
      mensajeError = error.message;

      logger.error(`Error en transacción batch ${modulo}:`, {
        mensaje: error.message,
        operacionesProcesadas: resultados.length,
        stack: error.stack
      });

      // Re-lanzar el error
      throw error;
    } finally {
      // Registrar auditoría general de la operación batch
      try {
        await AuditService.registrarAccion({
          usuario_email: usuarioEmail,
          usuario_id: usuarioId,
          modulo,
          accion: 'batch',
          recurso: 'múltiples',
          descripcion: `${descripcion} (${resultados.length} operaciones procesadas)`,
          ip_address: ipAddress,
          user_agent: userAgent,
          resultado,
          mensaje_error: mensajeError
        });
      } catch (auditError) {
        logger.warn('Error registrando auditoría batch:', auditError.message);
      }
    }

    return {
      success: true,
      data: resultados,
      total: resultados.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtener objeto de transacción para uso manual
   * Útil cuando se necesita control más fino sobre la transacción
   * @returns {Promise<Object>} Objeto de transacción de Sequelize
   */
  static async getTransaction() {
    return await sequelize.transaction();
  }

  /**
   * Commit de transacción
   * @param {Object} transaction - Objeto de transacción
   * @returns {Promise<void>}
   */
  static async commit(transaction) {
    if (transaction) {
      await transaction.commit();
    }
  }

  /**
   * Rollback de transacción
   * @param {Object} transaction - Objeto de transacción
   * @returns {Promise<void>}
   */
  static async rollback(transaction) {
    if (transaction) {
      await transaction.rollback();
    }
  }
}

export default TransactionWrapper;
