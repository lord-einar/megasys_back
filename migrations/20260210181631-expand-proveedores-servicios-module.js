/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 1. Agregar tipo_servicio_id a ejecutivos_cuentas
    await queryInterface.addColumn('ejecutivos_cuentas', 'tipo_servicio_id', {
      type: Sequelize.UUID,
      allowNull: true, // Permitir null para ejecutivos existentes
      references: {
        model: 'tipos_servicio',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('ejecutivos_cuentas', ['tipo_servicio_id'], {
      name: 'idx_ejecutivos_cuentas_tipo_servicio'
    });

    // 2. Agregar id_servicio a servicios (identificador alfanumérico único)
    await queryInterface.addColumn('servicios', 'id_servicio', {
      type: Sequelize.STRING(50),
      allowNull: true, // Permitir null temporalmente para servicios existentes
      unique: true
    });

    await queryInterface.addIndex('servicios', ['id_servicio'], {
      name: 'idx_servicios_id_servicio',
      unique: true
    });

    // 3. Agregar web a soporte_niveles (URL del portal de gestión)
    await queryInterface.addColumn('soporte_niveles', 'web', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    // 4. Crear tabla equipos_servicio
    await queryInterface.createTable('equipos_servicio', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      servicio_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'servicios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sede_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mac: {
        type: Sequelize.STRING(17),
        allowNull: true,
        comment: 'Dirección MAC del equipo (formato: XX:XX:XX:XX:XX:XX)'
      },
      modelo: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      marca: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      numero_serie: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Número de serie del equipo'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Índices para equipos_servicio
    await queryInterface.addIndex('equipos_servicio', ['servicio_id'], {
      name: 'idx_equipos_servicio_servicio'
    });

    await queryInterface.addIndex('equipos_servicio', ['sede_id'], {
      name: 'idx_equipos_servicio_sede'
    });

    await queryInterface.addIndex('equipos_servicio', ['mac'], {
      name: 'idx_equipos_servicio_mac'
    });

    await queryInterface.addIndex('equipos_servicio', ['activo'], {
      name: 'idx_equipos_servicio_activo'
    });

    // 5. Crear tabla reclamos
    await queryInterface.createTable('reclamos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      numero_reclamo: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Número único de reclamo generado automáticamente'
      },
      servicio_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'servicios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      sede_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      equipo_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'equipos_servicio',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Equipo relacionado con el reclamo (opcional)'
      },
      titulo: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Título o resumen breve del reclamo'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Descripción detallada del problema'
      },
      estado: {
        type: Sequelize.ENUM('abierto', 'en_proceso', 'resuelto', 'cerrado', 'cancelado'),
        allowNull: false,
        defaultValue: 'abierto'
      },
      prioridad: {
        type: Sequelize.ENUM('baja', 'media', 'alta', 'critica'),
        allowNull: false,
        defaultValue: 'media'
      },
      fecha_apertura: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_resolucion: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha en que se resolvió el reclamo'
      },
      creado_por_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Personal que creó el reclamo'
      },
      asignado_a_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Personal técnico asignado para resolver'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Observaciones adicionales o seguimiento'
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Índices para reclamos
    await queryInterface.addIndex('reclamos', ['numero_reclamo'], {
      name: 'idx_reclamos_numero',
      unique: true
    });

    await queryInterface.addIndex('reclamos', ['servicio_id'], {
      name: 'idx_reclamos_servicio'
    });

    await queryInterface.addIndex('reclamos', ['sede_id'], {
      name: 'idx_reclamos_sede'
    });

    await queryInterface.addIndex('reclamos', ['equipo_id'], {
      name: 'idx_reclamos_equipo'
    });

    await queryInterface.addIndex('reclamos', ['estado'], {
      name: 'idx_reclamos_estado'
    });

    await queryInterface.addIndex('reclamos', ['prioridad'], {
      name: 'idx_reclamos_prioridad'
    });

    await queryInterface.addIndex('reclamos', ['creado_por_id'], {
      name: 'idx_reclamos_creado_por'
    });

    await queryInterface.addIndex('reclamos', ['asignado_a_id'], {
      name: 'idx_reclamos_asignado_a'
    });

    await queryInterface.addIndex('reclamos', ['fecha_apertura'], {
      name: 'idx_reclamos_fecha_apertura'
    });

    await queryInterface.addIndex('reclamos', ['activo'], {
      name: 'idx_reclamos_activo'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir en orden inverso para respetar las dependencias

    // 5. Eliminar tabla reclamos
    await queryInterface.dropTable('reclamos');

    // 4. Eliminar tabla equipos_servicio
    await queryInterface.dropTable('equipos_servicio');

    // 3. Eliminar columna web de soporte_niveles
    await queryInterface.removeColumn('soporte_niveles', 'web');

    // 2. Eliminar columna id_servicio de servicios
    await queryInterface.removeIndex('servicios', 'idx_servicios_id_servicio');
    await queryInterface.removeColumn('servicios', 'id_servicio');

    // 1. Eliminar columna tipo_servicio_id de ejecutivos_cuentas
    await queryInterface.removeIndex('ejecutivos_cuentas', 'idx_ejecutivos_cuentas_tipo_servicio');
    await queryInterface.removeColumn('ejecutivos_cuentas', 'tipo_servicio_id');
  }
};
