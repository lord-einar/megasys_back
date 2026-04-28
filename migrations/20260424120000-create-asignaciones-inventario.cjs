'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asignaciones_inventario', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      inventario_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'inventario', key: 'id' },
        onDelete: 'RESTRICT'
      },
      personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'personal', key: 'id' },
        onDelete: 'RESTRICT'
      },
      fecha_asignacion: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      fecha_devolucion: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('asignaciones_inventario', ['personal_id']);
    await queryInterface.addIndex('asignaciones_inventario', ['inventario_id']);
    await queryInterface.addIndex('asignaciones_inventario', ['activo']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asignaciones_inventario');
  }
};
