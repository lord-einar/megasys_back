'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const items = [
      { nombre: 'Estado de equipos de cómputo', descripcion: 'Verificar que las computadoras y equipos estén funcionando correctamente', orden: 1 },
      { nombre: 'Funcionamiento de red', descripcion: 'Comprobar conectividad de red, velocidad y estabilidad', orden: 2 },
      { nombre: 'Sistema de cámaras operativo', descripcion: 'Verificar que todas las cámaras de seguridad estén activas y grabando', orden: 3 },
      { nombre: 'Telefonía funcionando', descripcion: 'Comprobar que el sistema telefónico esté operativo', orden: 4 },
      { nombre: 'Sistema de grabación activo', descripcion: 'Verificar que los sistemas de grabación estén funcionando', orden: 5 },
      { nombre: 'Software actualizado', descripcion: 'Verificar actualizaciones de software crítico', orden: 6 },
      { nombre: 'Licencias vigentes', descripcion: 'Comprobar que las licencias de software estén activas', orden: 7 },
      { nombre: 'Backups funcionando', descripcion: 'Verificar que los respaldos automáticos estén operativos', orden: 8 }
    ];

    const now = new Date();

    return queryInterface.bulkInsert('visita_checklist_items',
      items.map(i => ({
        id: Sequelize.literal('gen_random_uuid()'),
        ...i,
        activo: true,
        created_at: now,
        updated_at: now
      }))
    );
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('visita_checklist_items', null, {});
  }
};
