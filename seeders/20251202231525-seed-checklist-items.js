'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const items = [
      {
        id: uuidv4(),
        nombre: 'Limpieza rack',
        descripcion: 'Verificar limpieza y orden del rack de comunicaciones',
        orden: 1,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'NVR grabando',
        descripcion: 'Verificar que el NVR esté grabando correctamente todas las cámaras',
        orden: 2,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Teléfonos funcionando y con volumen',
        descripcion: 'Verificar tono y volumen de los teléfonos de la sede',
        orden: 3,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('visita_checklist_items', items, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('visita_checklist_items', null, {});
  }
};
