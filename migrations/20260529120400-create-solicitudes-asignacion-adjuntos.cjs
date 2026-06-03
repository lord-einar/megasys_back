'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes_asignacion_adjuntos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      solicitud_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'solicitudes_asignacion', key: 'id' },
        onDelete: 'CASCADE'
      },
      tipo: {
        type: Sequelize.ENUM('denuncia', 'rotura', 'otro'),
        allowNull: false,
        defaultValue: 'otro'
      },
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      url: {
        type: Sequelize.TEXT,
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
        references: { model: 'personal', key: 'id' }
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

    await queryInterface.addIndex('solicitudes_asignacion_adjuntos', ['solicitud_id']);
    await queryInterface.addIndex('solicitudes_asignacion_adjuntos', ['tipo']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes_asignacion_adjuntos');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_solicitudes_asignacion_adjuntos_tipo";`
    );
  }
};
