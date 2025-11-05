'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear la secuencia para generar números de remito
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS remito_numero_seq START 1 INCREMENT 1`
    );

    console.log('✅ Secuencia remito_numero_seq creada');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar la secuencia
    await queryInterface.sequelize.query(
      `DROP SEQUENCE IF EXISTS remito_numero_seq`
    );
  }
};
