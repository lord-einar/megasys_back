'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('personal_sedes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      sede_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      rol_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Crear índices
    await queryInterface.addIndex('personal_sedes', ['personal_id']);
    await queryInterface.addIndex('personal_sedes', ['sede_id']);
    await queryInterface.addIndex('personal_sedes', ['rol_id']);
    await queryInterface.addIndex('personal_sedes', ['activo']);

    // Índice único para personal+sede cuando está activo
    await queryInterface.addIndex('personal_sedes', ['personal_id', 'sede_id'], {
      unique: true,
      where: { activo: true },
      name: 'unique_personal_sede_activo'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('personal_sedes');
  }
};
