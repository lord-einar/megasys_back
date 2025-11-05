// migrations/20250724154501-create-sedes.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sedes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      empresa_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'empresas',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
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
        allowNull: true,
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
    await queryInterface.addIndex('sedes', ['empresa_id', 'nombre_sede'], {
      unique: true,
      name: 'idx_sedes_empresa_sede'
    });

    await queryInterface.addIndex('sedes', ['activo'], {
      name: 'idx_sedes_activo'
    });

    await queryInterface.addIndex('sedes', ['empresa_id'], {
      name: 'idx_sedes_empresa_id'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sedes');
  }
};