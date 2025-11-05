'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sede_asignaciones', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      sede_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      fecha_asignacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      fecha_fin_asignacion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Crear índice único para sede_id, personal_id cuando activo es true
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sede_personal_active_unique
      ON sede_asignaciones (sede_id, personal_id)
      WHERE activo = true
    `);

    // Crear índices para búsquedas comunes
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sede_asignacion_sede_id
      ON sede_asignaciones (sede_id)
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sede_asignacion_personal_id
      ON sede_asignaciones (personal_id)
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sede_asignacion_activo
      ON sede_asignaciones (activo)
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('sede_asignaciones');
  }
};
