/**
 * Utility para asignar automáticamente rol "Sistemas" a usuarios de grupos autorizados
 * Grupos autorizados: Infraestructura, Mesa de Ayuda, Soporte
 * (Estos se mapean a los roles existentes)
 */

import { Rol, Personal, sequelize } from '../../models/index.js';
import logger from './logger.js';

/**
 * Roles autorizados que automáticamente reciben rol "Sistemas"
 * Estos son los roles que permiten acceso a gestión de remitos
 */
const AUTHORIZED_ROLES_FOR_SISTEMAS = [
  'Infraestructura',
  'Mesa de Ayuda',
  'Soporte'
];

/**
 * Asignar rol Sistemas a un usuario si su rol_id actual está en la lista autorizada
 * @param {string} personalId - ID del personal
 * @param {string} rolId - ID del rol actual del personal
 * @param {Object} transaction - Transacción de DB (opcional)
 */
async function assignSistemasRoleIfAuthorized(personalId, rolId, transaction = null) {
  try {
    // Obtener el rol actual del personal
    const rolActual = await Rol.findByPk(rolId);

    if (!rolActual) {
      logger.warn('Rol no encontrado al intentar asignar Sistemas:', { rolId });
      return false;
    }

    // Verificar si el rol actual está en la lista autorizada
    const esAutorizado = AUTHORIZED_ROLES_FOR_SISTEMAS.includes(rolActual.nombre);

    if (!esAutorizado) {
      logger.debug('Rol no autorizado para Sistemas:', {
        personalId,
        rolActual: rolActual.nombre
      });
      return false;
    }

    // Obtener rol "Sistemas"
    const rolSistemas = await Rol.findOne({
      where: { nombre: 'Sistemas', activo: true }
    });

    if (!rolSistemas) {
      logger.error('Rol Sistemas no encontrado en base de datos');
      return false;
    }

    // Actualizar personal con rol Sistemas
    const personal = await Personal.findByPk(personalId);

    if (!personal) {
      logger.warn('Personal no encontrado:', { personalId });
      return false;
    }

    // Si ya tiene el rol Sistemas, no hacer nada
    if (personal.rol_id === rolSistemas.id) {
      logger.debug('Personal ya tiene rol Sistemas:', { personalId });
      return true;
    }

    // Actualizar el rol
    await personal.update(
      { rol_id: rolSistemas.id },
      { transaction }
    );

    logger.info('Rol Sistemas asignado automáticamente:', {
      personalId: personal.id,
      nombre: personal.nombre,
      apellido: personal.apellido,
      email: personal.email,
      rolAnterior: rolActual.nombre
    });

    return true;
  } catch (error) {
    logger.error('Error asignando rol Sistemas:', {
      error: error.message,
      personalId,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Asignar rol Sistemas a múltiples usuarios (ej: durante login)
 * @param {Array<string>} personalIds - Array de IDs de personal
 */
async function assignSistemasRoleBatch(personalIds) {
  try {
    const transaction = await sequelize.transaction();

    let assigned = 0;

    for (const personalId of personalIds) {
      const personal = await Personal.findByPk(personalId, { transaction });

      if (!personal) {
        continue;
      }

      const rol = await Rol.findByPk(personal.rol_id, { transaction });

      if (rol && AUTHORIZED_ROLES_FOR_SISTEMAS.includes(rol.nombre)) {
        const rolSistemas = await Rol.findOne({
          where: { nombre: 'Sistemas', activo: true },
          transaction
        });

        if (rolSistemas && personal.rol_id !== rolSistemas.id) {
          await personal.update(
            { rol_id: rolSistemas.id },
            { transaction }
          );
          assigned++;
        }
      }
    }

    await transaction.commit();

    logger.info(`Asignación batch de rol Sistemas completada:`, {
      total: personalIds.length,
      asignados: assigned
    });

    return assigned;
  } catch (error) {
    logger.error('Error en asignación batch de rol Sistemas:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export {
  assignSistemasRoleIfAuthorized,
  assignSistemasRoleBatch,
  AUTHORIZED_ROLES_FOR_SISTEMAS
};

export default {
  assignSistemasRoleIfAuthorized,
  assignSistemasRoleBatch,
  AUTHORIZED_ROLES_FOR_SISTEMAS
};
