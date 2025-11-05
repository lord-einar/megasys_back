// migrations/20241201120005-create-proveedores.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabla de proveedores
    await queryInterface.createTable('proveedores', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      empresa: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      direccion: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Tabla de ejecutivos de cuentas
    await queryInterface.createTable('ejecutivos_cuentas', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      proveedor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'proveedores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Tabla de tipos de servicio
    await queryInterface.createTable('tipos_servicio', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      nombre: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Tabla de servicios
    await queryInterface.createTable('servicios', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      tipo_servicio_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tipos_servicio',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      proveedor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'proveedores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Tabla de soporte por niveles
    await queryInterface.createTable('soporte_niveles', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
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
      nivel: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Tabla intermedia sede-servicios
    await queryInterface.createTable('sede_servicios', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      fecha_contratacion: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      fecha_vencimiento: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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

    // Índices para proveedores
    await queryInterface.addIndex('proveedores', ['empresa'], {
      name: 'idx_proveedores_empresa'
    });
    await queryInterface.addIndex('proveedores', ['activo'], {
      name: 'idx_proveedores_activo'
    });

    // Índices para ejecutivos de cuentas
    await queryInterface.addIndex('ejecutivos_cuentas', ['proveedor_id'], {
      name: 'idx_ejecutivos_proveedor'
    });

    // Índices para tipos de servicio
    await queryInterface.addIndex('tipos_servicio', ['nombre'], {
      unique: true,
      name: 'idx_tipos_servicio_nombre'
    });

    // Índices para servicios
    await queryInterface.addIndex('servicios', ['tipo_servicio_id'], {
      name: 'idx_servicios_tipo'
    });
    await queryInterface.addIndex('servicios', ['proveedor_id'], {
      name: 'idx_servicios_proveedor'
    });

    // Índices para soporte niveles
    await queryInterface.addIndex('soporte_niveles', ['servicio_id', 'nivel'], {
      unique: true,
      name: 'idx_soporte_servicio_nivel'
    });

    // Índices para sede-servicios
    await queryInterface.addIndex('sede_servicios', ['sede_id', 'servicio_id'], {
      unique: true,
      name: 'idx_sede_servicios_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sede_servicios');
    await queryInterface.dropTable('soporte_niveles');
    await queryInterface.dropTable('servicios');
    await queryInterface.dropTable('tipos_servicio');
    await queryInterface.dropTable('ejecutivos_cuentas');
    await queryInterface.dropTable('proveedores');
  }
};
