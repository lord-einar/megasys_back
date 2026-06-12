'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventario', 'imei', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    // índice único condicional (igual que numero_serie)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX inventario_imei_unique
      ON inventario(imei)
      WHERE imei IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS inventario_imei_unique;`);
    await queryInterface.removeColumn('inventario', 'imei');
  }
};
