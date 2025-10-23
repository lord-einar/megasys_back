// migrations/20241201120004-create-inventario.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventario', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tipo_articulo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tipos_articulo',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      marca: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      modelo: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      numero_serie: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      service_tag: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      sede_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      estado: {
        type: Sequelize.ENUM('disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'),
        allowNull: false,
        defaultValue: 'disponible'
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      fecha_adquisicion: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      valor_adquisicion: {
        type: Sequelize.DECIMAL(12, 2),
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

    // Agregar índices
    await queryInterface.addIndex('inventario', ['numero_serie'], {
      unique: true,
      name: 'idx_inventario_numero_serie',
      where: {
        numero_serie: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('inventario', ['tipo_articulo_id'], {
      name: 'idx_inventario_tipo_articulo'
    });

    await queryInterface.addIndex('inventario', ['sede_id'], {
      name: 'idx_inventario_sede'
    });

    await queryInterface.addIndex('inventario', ['estado'], {
      name: 'idx_inventario_estado'
    });

    await queryInterface.addIndex('inventario', ['activo'], {
      name: 'idx_inventario_activo'
    });

    await queryInterface.addIndex('inventario', ['marca', 'modelo'], {
      name: 'idx_inventario_marca_modelo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('inventario');
  }
};