'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('soporte_niveles', 'comentario', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'web'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('soporte_niveles', 'comentario');
  }
};
