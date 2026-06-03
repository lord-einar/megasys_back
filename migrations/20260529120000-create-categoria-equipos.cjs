'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categoria_equipos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      nombre: {
        type: Sequelize.STRING(80),
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tipo: {
        type: Sequelize.ENUM('notebook', 'celular', 'ambos'),
        allowNull: false,
        defaultValue: 'ambos'
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addIndex('categoria_equipos', ['tipo']);
    await queryInterface.addIndex('categoria_equipos', ['activo']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('categoria_equipos');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_categoria_equipos_tipo";`);
  }
};
