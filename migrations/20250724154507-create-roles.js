// migrations/20241201120001-create-roles.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      nombre: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      nivel_jerarquia: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Agregar índices
    await queryInterface.addIndex('roles', ['nombre'], {
      unique: true,
      name: 'idx_roles_nombre'
    });
    
    await queryInterface.addIndex('roles', ['nivel_jerarquia'], {
      name: 'idx_roles_nivel'
    });

    await queryInterface.addIndex('roles', ['activo'], {
      name: 'idx_roles_activo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('roles');
  }
};