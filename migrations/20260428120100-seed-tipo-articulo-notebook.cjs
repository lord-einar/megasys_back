'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO tipos_articulo (id, nombre, descripcion, activo, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Notebook', 'Computadora portátil asignada a personal', true, NOW(), NOW())
      ON CONFLICT (nombre) DO NOTHING;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DELETE FROM tipos_articulo WHERE nombre = 'Notebook';`);
  }
};
