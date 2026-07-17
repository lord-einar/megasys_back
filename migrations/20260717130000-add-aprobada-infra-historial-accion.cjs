'use strict';

/**
 * Nueva acción de historial 'aprobada_infra': la aprobación de Infraestructura
 * pasa a ser un paso explícito, separado de asignar el equipo o solicitar compra.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE enum_solicitudes_asignacion_historial_accion ADD VALUE IF NOT EXISTS 'aprobada_infra';`
    );
  },

  async down() {
    // No-op: Postgres no soporta remover valores de un ENUM sin recrear el tipo.
  }
};
