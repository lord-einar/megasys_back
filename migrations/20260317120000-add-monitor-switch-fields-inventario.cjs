'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Monitor fields
    await queryInterface.addColumn('inventario', 'pulgadas', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    await queryInterface.addColumn('inventario', 'tipo_conector', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Conectores del monitor, ej: HDMI,VGA,DisplayPort'
    });

    // Switch fields
    await queryInterface.addColumn('inventario', 'puertos_ethernet', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('inventario', 'puertos_sfp', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('inventario', 'poe', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inventario', 'pulgadas');
    await queryInterface.removeColumn('inventario', 'tipo_conector');
    await queryInterface.removeColumn('inventario', 'puertos_ethernet');
    await queryInterface.removeColumn('inventario', 'puertos_sfp');
    await queryInterface.removeColumn('inventario', 'poe');
  }
};
