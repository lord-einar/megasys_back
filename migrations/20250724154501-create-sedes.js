// migrations/20241201120000-create-sedes.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sedes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre_empresa: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      nombre_sede: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      direccion: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      localidad: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      provincia: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      pais: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Argentina'
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      ip_sede: {
        type: Sequelize.STRING(15),
        allowNull: true
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
    await queryInterface.addIndex('sedes', ['nombre_empresa', 'nombre_sede'], {
      unique: true,
      name: 'idx_sedes_empresa_sede'
    });
    
    await queryInterface.addIndex('sedes', ['activo'], {
      name: 'idx_sedes_activo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sedes');
  }
};