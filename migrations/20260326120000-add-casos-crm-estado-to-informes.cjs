'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('visita_informes', 'casos_crm_estado', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Estado de casos CRM vinculados: [{ numeroCaso, titulo, estado, observacion }]'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('visita_informes', 'casos_crm_estado');
  }
};
