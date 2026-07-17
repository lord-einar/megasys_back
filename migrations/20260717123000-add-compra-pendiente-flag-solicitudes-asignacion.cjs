'use strict';

/**
 * "Compra pendiente" no es un estado del workflow sino una bandera paralela:
 * la solicitud puede aprobarse igual sin stock, y el equipo se asigna más tarde
 * (editando la solicitud) cuando entra el stock comprado.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('solicitudes_asignacion', 'compra_pendiente', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addIndex('solicitudes_asignacion', ['compra_pendiente']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('solicitudes_asignacion', ['compra_pendiente']);
    await queryInterface.removeColumn('solicitudes_asignacion', 'compra_pendiente');
  }
};
