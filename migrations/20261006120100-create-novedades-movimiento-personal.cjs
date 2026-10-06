'use strict';

/**
 * Novedades de cambio de sede del personal detectadas por la sincronización
 * con Entra ID. Un super_admin las revisa y confirma (moviendo los equipos
 * asignados a la sede nueva) o las descarta.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('novedades_movimiento_personal', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'personal', key: 'id' },
        onDelete: 'CASCADE'
      },
      sede_anterior_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'sedes', key: 'id' }
      },
      sede_nueva_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'sedes', key: 'id' }
      },
      origen: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'entra_sync'
      },
      estado: {
        type: Sequelize.ENUM('pendiente', 'confirmada', 'descartada'),
        allowNull: false,
        defaultValue: 'pendiente'
      },
      equipos_trasladados: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      resuelto_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' }
      },
      resuelto_en: {
        type: Sequelize.DATE,
        allowNull: true
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('novedades_movimiento_personal', ['estado']);
    await queryInterface.addIndex('novedades_movimiento_personal', ['personal_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('novedades_movimiento_personal');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_novedades_movimiento_personal_estado";');
  }
};
