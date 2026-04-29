'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes_compra_historial', {
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
      accion: {
        type: Sequelize.ENUM(
          'creada',
          'editada',
          'aprobada_infra',
          'aprobada_rrhh',
          'rechazada',
          'comprada',
          'reenviada_infra',
          'cancelada',
          'adjunto_agregado',
          'adjunto_eliminado'
        ),
        allowNull: false
      },
      actor_personal_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
      },
      actor_grupo: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      comentario: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      diff: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('solicitudes_compra_historial', ['solicitud_id']);
    await queryInterface.addIndex('solicitudes_compra_historial', ['solicitud_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes_compra_historial');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_historial_accion";');
  }
};
