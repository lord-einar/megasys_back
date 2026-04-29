'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes_compra', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      numero: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        unique: true
      },
      tipo_equipo: {
        type: Sequelize.ENUM('celular', 'notebook'),
        allowNull: false
      },
      motivo: {
        type: Sequelize.ENUM(
          'nuevo_ingreso',
          'nuevo_puesto',
          'reposicion_robo',
          'reposicion_perdida',
          'reposicion_rotura'
        ),
        allowNull: false
      },
      observacion_solicitante: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      beneficiario_personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'personal', key: 'id' },
        onDelete: 'RESTRICT'
      },
      inventario_actual_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inventario', key: 'id' },
        onDelete: 'SET NULL'
      },
      denuncia_presentada: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      solicitante_personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'personal', key: 'id' },
        onDelete: 'RESTRICT'
      },
      solicitante_grupo: {
        type: Sequelize.ENUM('infraestructura', 'rrhh', 'compras'),
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM(
          'pendiente_infra',
          'aprobada_infra',
          'aprobada_rrhh',
          'comprada',
          'rechazada',
          'cancelada'
        ),
        allowNull: false,
        defaultValue: 'pendiente_infra'
      },
      // Aprobación Infraestructura
      infra_aprobador_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
      },
      infra_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      infra_observacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      infra_catalogo_equipo_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'catalogo_equipos', key: 'id' },
        onDelete: 'RESTRICT'
      },
      // Aprobación RRHH
      rrhh_aprobador_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
      },
      rrhh_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rrhh_observacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Compra
      compras_responsable_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
      },
      compras_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      compras_numero_oc: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      compras_observacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      inventario_creado_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inventario', key: 'id' },
        onDelete: 'SET NULL'
      },
      // Rechazo
      rechazo_motivo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rechazo_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
      },
      rechazo_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      // Cancelación
      cancelacion_motivo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancelado_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onDelete: 'SET NULL'
      },
      cancelado_fecha: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('solicitudes_compra', ['estado']);
    await queryInterface.addIndex('solicitudes_compra', ['tipo_equipo']);
    await queryInterface.addIndex('solicitudes_compra', ['beneficiario_personal_id']);
    await queryInterface.addIndex('solicitudes_compra', ['solicitante_personal_id']);
    await queryInterface.addIndex('solicitudes_compra', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes_compra');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_tipo_equipo";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_motivo";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_solicitante_grupo";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_estado";');
  }
};
