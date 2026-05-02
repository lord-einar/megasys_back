'use strict';

/**
 * La migración previa intentó relajar inventario.sede_id a NULL via
 * queryInterface.changeColumn, pero el cambio no terminó aplicándose en
 * todas las DBs. Forzamos el ALTER vía SQL para asegurar que un inventario
 * pueda existir sin sede asignada (caso de personal con múltiples sedes
 * a cargo).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE inventario ALTER COLUMN sede_id DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    // No revertimos: si hay registros con sede_id NULL, el down rompería.
    // Si se necesita volver atrás, hacerlo manualmente luego de migrar datos.
  }
};
