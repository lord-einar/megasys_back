'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_inventario_estado" ADD VALUE IF NOT EXISTS 'producto_proveedor';`
    );
  },

  async down() {
    // PostgreSQL no permite eliminar valores de un ENUM directamente.
    // Para revertir habría que recrear el tipo, lo cual es complejo y destructivo.
    // Se deja como no-op intencional.
  }
};
