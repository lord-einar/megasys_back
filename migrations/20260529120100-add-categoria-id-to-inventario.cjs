'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventario', 'categoria_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'categoria_equipos', key: 'id' },
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('inventario', ['categoria_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('inventario', ['categoria_id']);
    await queryInterface.removeColumn('inventario', 'categoria_id');
  }
};
