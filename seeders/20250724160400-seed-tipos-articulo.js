'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');

    const tiposArticulo = [
      {
        id: uuidv4(),
        nombre: 'Notebooks',
        descripcion: 'Computadoras portátiles',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'PC',
        descripcion: 'Computadoras de escritorio',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Periféricos',
        descripcion: 'Periféricos de computadora (teclados, mouses, webcams, etc.)',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Monitor',
        descripcion: 'Monitores y pantallas',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Cámara',
        descripcion: 'Cámaras de video y fotografía',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Impresora',
        descripcion: 'Impresoras y multifuncionales',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'NVR',
        descripcion: 'Network Video Recorder - Sistemas de grabación de video en red',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('tipos_articulo', tiposArticulo);
    console.log(`✅ ${tiposArticulo.length} tipos de artículos creados`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('tipos_articulo', null, {});
  }
};
