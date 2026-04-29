'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('catalogo_equipos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      tipo: {
        type: Sequelize.ENUM('celular', 'notebook'),
        allowNull: false
      },
      marca: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      modelo: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex('catalogo_equipos', ['tipo']);
    await queryInterface.addIndex('catalogo_equipos', ['activo']);
    await queryInterface.addConstraint('catalogo_equipos', {
      fields: ['tipo', 'marca', 'modelo'],
      type: 'unique',
      name: 'catalogo_equipos_tipo_marca_modelo_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('catalogo_equipos');
    // ENUMs en Postgres quedan colgados si no se drop-ean explícitamente
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_catalogo_equipos_tipo";');
  }
};
