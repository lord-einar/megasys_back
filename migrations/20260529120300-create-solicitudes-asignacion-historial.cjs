'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes_asignacion_historial', {
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
      accion: {
        type: Sequelize.ENUM(
          'creada',
          'editada',
          'equipo_asignado',
          'aprobada_rrhh',
          'rechazada',
          'cancelada',
          'remito_generado',
          'finalizada',
          'reenviada_infra',
          'adjunto_agregado'
        ),
        allowNull: false
      },
      actor_personal_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' }
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
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addIndex('solicitudes_asignacion_historial', ['solicitud_id']);
    await queryInterface.addIndex('solicitudes_asignacion_historial', ['solicitud_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes_asignacion_historial');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_solicitudes_asignacion_historial_accion";`
    );
  }
};
