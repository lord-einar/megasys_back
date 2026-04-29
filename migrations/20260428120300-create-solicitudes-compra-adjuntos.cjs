'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes_compra_adjuntos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      solicitud_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'solicitudes_compra', key: 'id' },
        onDelete: 'CASCADE'
      },
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      nombre_original: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      tamanio: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      subido_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('solicitudes_compra_adjuntos', ['solicitud_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes_compra_adjuntos');
  }
};
