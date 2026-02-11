'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ejecutivos_cuentas', 'apellido', {
      type: Sequelize.STRING(100),
      allowNull: true, // Permitir null temporalmente para datos existentes
      after: 'nombre'
    });

    // Actualizar registros existentes con un apellido por defecto si es necesario
    // await queryInterface.sequelize.query(
    //   `UPDATE ejecutivos_cuentas SET apellido = '' WHERE apellido IS NULL`
    // );

    // Luego hacer el campo NOT NULL
    // await queryInterface.changeColumn('ejecutivos_cuentas', 'apellido', {
    //   type: Sequelize.STRING(100),
    //   allowNull: false
    // });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ejecutivos_cuentas', 'apellido');
  }
};
