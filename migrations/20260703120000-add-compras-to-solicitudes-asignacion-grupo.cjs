'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_solicitudes_asignacion_solicitante_grupo ADD VALUE IF NOT EXISTS 'compras';
    `);
  },

  async down() {
    // Postgres no soporta remover valores de un ENUM sin recrear el tipo.
    // Se deja como no-op: revertir requeriría verificar que ninguna fila use 'compras'.
  }
};
