'use strict';

/**
 * Agrega el estado "borrador" para remitos iniciados desde Compras y una
 * bandera para identificar remitos generados desde solicitudes de asignación.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE enum_remitos_estado ADD VALUE IF NOT EXISTS 'borrador';`
    );

    await queryInterface.addColumn('remitos', 'generado_desde_solicitud_asignacion', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addIndex('remitos', ['generado_desde_solicitud_asignacion']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('remitos', ['generado_desde_solicitud_asignacion']);
    await queryInterface.removeColumn('remitos', 'generado_desde_solicitud_asignacion');
    // No-op para el enum: Postgres no permite quitar valores sin recrear el tipo.
  }
};
