'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');

    await queryInterface.bulkInsert('empresas', [
      {
        id: uuidv4(),
        nombre_empresa: 'Megatlon',
        cuit: '30-12345678-0',
        rason_social: 'Megatlon S.A.',
        email: 'info@megatlon.com.ar',
        telefono: '11-1234-5678',
        direccion: 'Reconquista 335, CABA',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre_empresa: 'Fiter',
        cuit: '30-87654321-0',
        rason_social: 'Fiter S.A.',
        email: 'info@fiter.com.ar',
        telefono: '11-9876-5432',
        direccion: 'Buenos Aires, CABA',
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('empresas', null, {});
  }
};
