/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // =====================================================
    // 1. catalogo_equipos
    // =====================================================
    await queryInterface.createTable('catalogo_equipos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
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
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
    await queryInterface.addIndex('catalogo_equipos', ['tipo'], { name: 'idx_catalogo_equipos_tipo' });
    await queryInterface.addIndex('catalogo_equipos', ['activo'], { name: 'idx_catalogo_equipos_activo' });
    await queryInterface.addIndex('catalogo_equipos', ['tipo', 'marca', 'modelo'], {
      unique: true,
      name: 'catalogo_equipos_tipo_marca_modelo_unique'
    });

    // =====================================================
    // 2. solicitudes_compra
    // =====================================================
    await queryInterface.createTable('solicitudes_compra', {
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
        type: Sequelize.ENUM('celular', 'notebook'),
        allowNull: false
      },
      motivo: {
        type: Sequelize.ENUM(
          'nuevo_ingreso', 'nuevo_puesto', 'reposicion_robo',
          'reposicion_perdida', 'reposicion_rotura', 'cambio_equipo', 'otro'
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
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      inventario_actual_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inventario', key: 'id' },
        onUpdate: 'CASCADE',
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
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      solicitante_grupo: {
        type: Sequelize.ENUM('infraestructura', 'rrhh', 'compras'),
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM(
          'pendiente_infra', 'aprobada_infra', 'pendiente_pedido', 'pedido',
          'recibido', 'entregado_sistemas', 'entregado_destinatario',
          'finalizada', 'comprada', 'rechazada', 'cancelada'
        ),
        allowNull: false,
        defaultValue: 'pendiente_infra'
      },
      // Aprobación Infraestructura
      infra_aprobador_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      infra_fecha: { type: Sequelize.DATE, allowNull: true },
      infra_observacion: { type: Sequelize.TEXT, allowNull: true },
      infra_catalogo_equipo_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'catalogo_equipos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      // Aprobación RRHH
      rrhh_aprobador_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      rrhh_fecha: { type: Sequelize.DATE, allowNull: true },
      rrhh_observacion: { type: Sequelize.TEXT, allowNull: true },
      // Compra
      compras_responsable_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      compras_fecha: { type: Sequelize.DATE, allowNull: true },
      compras_numero_oc: { type: Sequelize.STRING(50), allowNull: true },
      compras_observacion: { type: Sequelize.TEXT, allowNull: true },
      compras_estado_fecha: { type: Sequelize.DATE, allowNull: true },
      compras_entrega_observacion: { type: Sequelize.TEXT, allowNull: true },
      imei: { type: Sequelize.STRING(50), allowNull: true },
      numero_serie_final: { type: Sequelize.STRING(100), allowNull: true },
      sistemas_fecha: { type: Sequelize.DATE, allowNull: true },
      sistemas_observacion: { type: Sequelize.TEXT, allowNull: true },
      inventario_creado_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inventario', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      // Rechazo
      rechazo_motivo: { type: Sequelize.TEXT, allowNull: true },
      rechazo_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      rechazo_fecha: { type: Sequelize.DATE, allowNull: true },
      // Cancelación
      cancelacion_motivo: { type: Sequelize.TEXT, allowNull: true },
      cancelado_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cancelado_fecha: { type: Sequelize.DATE, allowNull: true },
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
    await queryInterface.addIndex('solicitudes_compra', ['estado'], { name: 'idx_solicitudes_compra_estado' });
    await queryInterface.addIndex('solicitudes_compra', ['tipo_equipo'], { name: 'idx_solicitudes_compra_tipo_equipo' });
    await queryInterface.addIndex('solicitudes_compra', ['beneficiario_personal_id'], { name: 'idx_solicitudes_compra_beneficiario' });
    await queryInterface.addIndex('solicitudes_compra', ['solicitante_personal_id'], { name: 'idx_solicitudes_compra_solicitante' });
    await queryInterface.addIndex('solicitudes_compra', ['created_at'], { name: 'idx_solicitudes_compra_created_at' });

    // =====================================================
    // 3. solicitudes_compra_adjuntos
    // =====================================================
    await queryInterface.createTable('solicitudes_compra_adjuntos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      solicitud_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'solicitudes_compra', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo: {
        type: Sequelize.ENUM('denuncia', 'rotura', 'otro'),
        allowNull: false,
        defaultValue: 'otro'
      },
      filename: { type: Sequelize.STRING(255), allowNull: false },
      url: { type: Sequelize.STRING(500), allowNull: false },
      nombre_original: { type: Sequelize.STRING(255), allowNull: true },
      tamanio: { type: Sequelize.INTEGER, allowNull: true },
      mime_type: { type: Sequelize.STRING(100), allowNull: true },
      subido_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.addIndex('solicitudes_compra_adjuntos', ['solicitud_id'], { name: 'idx_sc_adjuntos_solicitud_id' });
    await queryInterface.addIndex('solicitudes_compra_adjuntos', ['tipo'], { name: 'idx_sc_adjuntos_tipo' });

    // =====================================================
    // 4. solicitudes_compra_historial
    // =====================================================
    await queryInterface.createTable('solicitudes_compra_historial', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      solicitud_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'solicitudes_compra', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      accion: {
        type: Sequelize.ENUM(
          'creada', 'editada', 'aprobada_infra', 'aprobada_rrhh', 'rechazada',
          'comprada', 'pedido', 'recibido', 'entregado_sistemas',
          'entregado_destinatario', 'finalizada', 'reenviada_infra',
          'cancelada', 'adjunto_agregado', 'adjunto_eliminado'
        ),
        allowNull: false
      },
      actor_personal_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'personal', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      actor_grupo: { type: Sequelize.STRING(50), allowNull: true },
      comentario: { type: Sequelize.TEXT, allowNull: true },
      diff: { type: Sequelize.JSON, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
    await queryInterface.addIndex('solicitudes_compra_historial', ['solicitud_id'], { name: 'idx_sc_historial_solicitud_id' });
    await queryInterface.addIndex('solicitudes_compra_historial', ['solicitud_id', 'created_at'], { name: 'idx_sc_historial_solicitud_created' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('solicitudes_compra_historial');
    await queryInterface.dropTable('solicitudes_compra_adjuntos');
    await queryInterface.dropTable('solicitudes_compra');
    await queryInterface.dropTable('catalogo_equipos');

    const enums = [
      'enum_solicitudes_compra_historial_accion',
      'enum_solicitudes_compra_adjuntos_tipo',
      'enum_solicitudes_compra_estado',
      'enum_solicitudes_compra_solicitante_grupo',
      'enum_solicitudes_compra_motivo',
      'enum_solicitudes_compra_tipo_equipo',
      'enum_catalogo_equipos_tipo'
    ];
    for (const e of enums) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${e}";`);
    }
  }
};
