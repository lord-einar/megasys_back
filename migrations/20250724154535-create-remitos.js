// migrations/20241201120006-create-remitos.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabla de remitos
    await queryInterface.createTable('remitos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      numero_remito: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      sede_origen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      sede_destino_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      solicitante_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      tecnico_asignado_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      estado: {
        type: Sequelize.ENUM('preparado', 'en_transito', 'entregado', 'confirmado'),
        allowNull: false,
        defaultValue: 'preparado'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      fecha_entrega: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fecha_confirmacion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Tabla de detalles de remito
    await queryInterface.createTable('remito_detalles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      remito_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'remitos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      inventario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'inventario',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      es_prestamo: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      fecha_devolucion_esperada: {
        type: Sequelize.DATE,
        allowNull: true
      },
      devuelto: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      fecha_devolucion_real: {
        type: Sequelize.DATE,
        allowNull: true
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Tabla de historial de movimientos
    await queryInterface.createTable('historial_movimientos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      inventario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'inventario',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      remito_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'remitos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      sede_origen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      sede_destino_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      tipo_movimiento: {
        type: Sequelize.ENUM('transferencia', 'prestamo', 'devolucion', 'asignacion', 'mantenimiento'),
        allowNull: false
      },
      fecha_movimiento: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Índices para remitos
    await queryInterface.addIndex('remitos', ['numero_remito'], {
      unique: true,
      name: 'idx_remitos_numero'
    });
    await queryInterface.addIndex('remitos', ['fecha'], {
      name: 'idx_remitos_fecha'
    });
    await queryInterface.addIndex('remitos', ['sede_origen_id'], {
      name: 'idx_remitos_sede_origen'
    });
    await queryInterface.addIndex('remitos', ['sede_destino_id'], {
      name: 'idx_remitos_sede_destino'
    });
    await queryInterface.addIndex('remitos', ['estado'], {
      name: 'idx_remitos_estado'
    });
    await queryInterface.addIndex('remitos', ['solicitante_id'], {
      name: 'idx_remitos_solicitante'
    });
    await queryInterface.addIndex('remitos', ['tecnico_asignado_id'], {
      name: 'idx_remitos_tecnico'
    });

    // Índices para remito_detalles
    await queryInterface.addIndex('remito_detalles', ['remito_id', 'inventario_id'], {
      unique: true,
      name: 'idx_remito_detalles_unique'
    });
    await queryInterface.addIndex('remito_detalles', ['es_prestamo'], {
      name: 'idx_remito_detalles_prestamo'
    });
    await queryInterface.addIndex('remito_detalles', ['devuelto'], {
      name: 'idx_remito_detalles_devuelto'
    });
    await queryInterface.addIndex('remito_detalles', ['fecha_devolucion_esperada'], {
      name: 'idx_remito_detalles_fecha_devolucion'
    });

    // Índices para historial_movimientos
    await queryInterface.addIndex('historial_movimientos', ['inventario_id'], {
      name: 'idx_historial_inventario'
    });
    await queryInterface.addIndex('historial_movimientos', ['fecha_movimiento'], {
      name: 'idx_historial_fecha'
    });
    await queryInterface.addIndex('historial_movimientos', ['tipo_movimiento'], {
      name: 'idx_historial_tipo'
    });
    await queryInterface.addIndex('historial_movimientos', ['sede_origen_id'], {
      name: 'idx_historial_sede_origen'
    });
    await queryInterface.addIndex('historial_movimientos', ['sede_destino_id'], {
      name: 'idx_historial_sede_destino'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('historial_movimientos');
    await queryInterface.dropTable('remito_detalles');
    await queryInterface.dropTable('remitos');
  }
};