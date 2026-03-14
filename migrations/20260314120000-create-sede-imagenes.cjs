'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sede_imagenes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      sede_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sedes', key: 'id' },
        onDelete: 'CASCADE'
      },
      titulo: {
        type: Sequelize.STRING(255),
        allowNull: true
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
        type: Sequelize.STRING(50),
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

    await queryInterface.addIndex('sede_imagenes', ['sede_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sede_imagenes');
  }
};
