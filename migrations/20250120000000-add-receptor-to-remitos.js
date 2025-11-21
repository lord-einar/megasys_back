'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('remitos', 'receptor_nombre', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Nombre completo de la persona que recibe el remito (si es diferente al solicitante)'
    });

    await queryInterface.addColumn('remitos', 'receptor_email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Email de la persona que recibe el remito (si es diferente al solicitante)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('remitos', 'receptor_email');
    await queryInterface.removeColumn('remitos', 'receptor_nombre');
  }
};
