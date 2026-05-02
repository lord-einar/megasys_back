'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_personal_privilegio_app ADD VALUE IF NOT EXISTS 'rrhh';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_personal_privilegio_app ADD VALUE IF NOT EXISTS 'compras';
    `);
  },

  async down() {
    // Postgres no permite eliminar valores de ENUM sin recrear el tipo.
    // Se deja intencionalmente sin cambios para evitar pérdida de datos.
  }
};
