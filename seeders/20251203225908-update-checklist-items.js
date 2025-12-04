'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Primero eliminar todos los items existentes
    await queryInterface.bulkDelete('visita_checklist_items', null, {});

    // Insertar los nuevos items
    const items = [
      { nombre: 'Limpieza de rack', descripcion: 'Verificar y realizar limpieza del rack de equipos', orden: 1 },
      { nombre: 'Cámaras funcionando', descripcion: 'Comprobar que todas las cámaras estén operativas', orden: 2 },
      { nombre: 'NVR Grabando', descripcion: 'Verificar que el NVR esté grabando correctamente', orden: 3 },
      { nombre: 'Teléfonos funcionando con volumen', descripcion: 'Comprobar el funcionamiento y volumen adecuado de los teléfonos', orden: 4 },
      { nombre: 'Acceso, molinetes y QR', descripcion: 'Verificar sistemas de control de acceso, molinetes y lectura de QR', orden: 5 },
      { nombre: 'Gerente con acceso a cámaras', descripcion: 'Confirmar que el gerente tenga acceso al sistema de cámaras', orden: 6 },
      { nombre: 'Impresoras ok', descripcion: 'Verificar el correcto funcionamiento de las impresoras', orden: 7 },
      { nombre: 'Wifi socios/acceso', descripcion: 'Comprobar conectividad wifi para socios y acceso', orden: 8 },
      { nombre: 'Pantallas de publicidad', descripcion: 'Verificar que las pantallas de publicidad estén funcionando', orden: 9 }
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
    // Revertir a los items anteriores si es necesario
    await queryInterface.bulkDelete('visita_checklist_items', null, {});

    const itemsAnteriores = [
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
      itemsAnteriores.map(i => ({
        id: Sequelize.literal('gen_random_uuid()'),
        ...i,
        activo: true,
        created_at: now,
        updated_at: now
      }))
    );
  }
};
