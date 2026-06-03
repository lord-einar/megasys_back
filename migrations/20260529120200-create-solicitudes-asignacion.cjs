'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes_asignacion', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      numero: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        unique: true
      },
      tipo_equipo: {
        type: Sequelize.ENUM('notebook', 'celular'),
        allowNull: false
      },
      motivo: {
        type: Sequelize.ENUM(
          'nuevo_ingreso',
          'nuevo_puesto',
          'reposicion_robo',
          'reposicion_perdida',
          'reposicion_rotura',
          'cambio_equipo',
          'otro'
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
        references: { model: 'personal', key: 'id' }
      },
      solicitante_personal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'personal', key: 'id' }
      },
      solicitante_grupo: {
        type: Sequelize.ENUM('infraestructura', 'rrhh'),
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM(
          'pendiente_infra',
          'pendiente_rrhh',
          'aprobada',
          'remito_generado',
          'finalizada',
          'rechazada',
          'cancelada'
        ),
        allowNull: false,
        defaultValue: 'pendiente_infra'
      },
      // Equipo anterior (reposiciones)
      inventario_anterior_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inventario', key: 'id' }
      },
      denuncia_presentada: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      equipo_anterior_accion: {
        type: Sequelize.ENUM('mantenimiento', 'dado_de_baja'),
        allowNull: true
      },
      // Asignación por Infra
      inventario_asignado_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inventario', key: 'id' }
      },
      categoria_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'categoria_equipos', key: 'id' }
      },
      infra_asignador_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' }
      },
      infra_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      infra_observacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Aprobación RRHH
      rrhh_aprobador_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' }
      },
      rrhh_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rrhh_observacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Remito
      remito_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'remitos', key: 'id' }
      },
      // Cierre manual
      cierre_personal_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' }
      },
      cierre_fecha: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cierre_observacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Rechazo
      rechazo_motivo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rechazo_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' }
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
        references: { model: 'personal', key: 'id' }
      },
      cancelado_fecha: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('solicitudes_asignacion', ['estado']);
    await queryInterface.addIndex('solicitudes_asignacion', ['tipo_equipo']);
    await queryInterface.addIndex('solicitudes_asignacion', ['beneficiario_personal_id']);
    await queryInterface.addIndex('solicitudes_asignacion', ['solicitante_personal_id']);
    await queryInterface.addIndex('solicitudes_asignacion', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes_asignacion');
    for (const t of [
      'enum_solicitudes_asignacion_tipo_equipo',
      'enum_solicitudes_asignacion_motivo',
      'enum_solicitudes_asignacion_solicitante_grupo',
      'enum_solicitudes_asignacion_estado',
      'enum_solicitudes_asignacion_equipo_anterior_accion'
    ]) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${t}";`);
    }
  }
};
