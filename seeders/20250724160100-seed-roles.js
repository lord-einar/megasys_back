'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');
    
    await queryInterface.bulkInsert('roles', [
      {
        id: uuidv4(),
        nombre: 'Gerente Generalista',
        descripcion: 'Gerente generalista de sede',
        nivel_jerarquia: 1,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Gerente Comercial',
        descripcion: 'Gerente comercial de sede',
        nivel_jerarquia: 2,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Gerente de Servicio',
        descripcion: 'Gerente de servicio de sede',
        nivel_jerarquia: 3,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Coordinador de Venta',
        descripcion: 'Coordinador de venta de sede',
        nivel_jerarquia: 4,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Coordinador de Servicio',
        descripcion: 'Coordinador de servicio de sede',
        nivel_jerarquia: 5,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Coordinador de Pileta',
        descripcion: 'Coordinador de pileta de sede',
        nivel_jerarquia: 6,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Regional',
        descripcion: 'Regional de sedes',
        nivel_jerarquia: 7,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Club Manager',
        descripcion: 'Club manager de sede',
        nivel_jerarquia: 8,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Soporte Técnico',
        descripcion: 'Personal de soporte técnico',
        nivel_jerarquia: 9,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        nombre: 'Sistemas',
        descripcion: 'Personal de sistemas',
        nivel_jerarquia: 10,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
