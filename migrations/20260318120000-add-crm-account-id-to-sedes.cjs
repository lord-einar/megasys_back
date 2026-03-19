'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sedes', 'crm_account_id', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      comment: 'ID de la cuenta en Dynamics 365 CRM vinculada a esta sede',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sedes', 'crm_account_id');
  },
};
