// migrations/20241201120002-create-tipos-articulo.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tipos_articulo', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
    await queryInterface.addIndex('tipos_articulo', ['nombre'], {
      unique: true,
      name: 'idx_tipos_articulo_nombre'
    });

    await queryInterface.addIndex('tipos_articulo', ['activo'], {
      name: 'idx_tipos_articulo_activo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tipos_articulo');
  }
};