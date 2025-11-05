'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('empresas', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      nombre_empresa: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      cuit: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true
      },
      rason_social: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      direccion: {
        type: Sequelize.STRING(200),
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
    await queryInterface.addIndex('empresas', ['nombre_empresa'], {
      name: 'idx_empresas_nombre'
    });

    await queryInterface.addIndex('empresas', ['activo'], {
      name: 'idx_empresas_activo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('empresas');
  }
};
