'use strict';

/**
 * Unifica los tipos de artículo "Notebooks" (seed original) y "Notebook"
 * (creado para solicitudes de asignación) en uno solo: "Notebook".
 *
 * Mueve los equipos de "Notebooks" a "Notebook" y desactiva "Notebooks"
 * (no se borra para conservar la referencia histórica).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO tipos_articulo (id, nombre, descripcion, activo, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Notebook', 'Computadora portátil asignada a personal', true, NOW(), NOW())
      ON CONFLICT (nombre) DO UPDATE SET activo = true;
    `);

    await queryInterface.sequelize.query(`
      UPDATE inventario
      SET tipo_articulo_id = (SELECT id FROM tipos_articulo WHERE nombre = 'Notebook'),
          updated_at = NOW()
      WHERE tipo_articulo_id IN (SELECT id FROM tipos_articulo WHERE nombre = 'Notebooks');
    `);

    await queryInterface.sequelize.query(`
      UPDATE tipos_articulo
      SET activo = false,
          descripcion = 'Unificado en "Notebook" - no usar',
          updated_at = NOW()
      WHERE nombre = 'Notebooks';
    `);
  },

  async down() {
    // No se revierte: después de la unificación no hay forma de saber qué
    // equipos pertenecían originalmente a "Notebooks".
  }
};
