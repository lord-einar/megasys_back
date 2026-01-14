'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si el item ya existe
    const existingItem = await queryInterface.sequelize.query(
      `SELECT id FROM visita_checklist_items WHERE nombre = 'Funcionamiento de PC de recepción'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Si ya existe, no hacer nada
    if (existingItem.length > 0) {
      console.log('El item "Funcionamiento de PC de recepción" ya existe, saltando...');
      return;
    }

    // Insertar el nuevo item
    const now = new Date();

    return queryInterface.bulkInsert('visita_checklist_items', [
      {
        id: Sequelize.literal('gen_random_uuid()'),
        nombre: 'Funcionamiento de PC de recepción',
        descripcion: 'Verificar que la computadora de recepción esté funcionando correctamente',
        orden: 10,
        activo: true,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Eliminar el item agregado
    return queryInterface.bulkDelete('visita_checklist_items', {
      nombre: 'Funcionamiento de PC de recepción'
    }, {});
  }
};
