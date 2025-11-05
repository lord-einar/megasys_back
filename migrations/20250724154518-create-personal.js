// migrations/20241201120003-create-personal.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('personal', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false
      },
      nombre: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      apellido: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      sede_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'sedes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      rol_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      privilegio_app: {
        type: Sequelize.ENUM('super_admin', 'helpdesk', 'support', 'user'),
        allowNull: true,
        defaultValue: 'user'
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      fecha_ingreso: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE')
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
    await queryInterface.addIndex('personal', ['email'], {
      unique: true,
      name: 'idx_personal_email'
    });

    await queryInterface.addIndex('personal', ['sede_id'], {
      name: 'idx_personal_sede'
    });

    await queryInterface.addIndex('personal', ['rol_id'], {
      name: 'idx_personal_rol'
    });

    await queryInterface.addIndex('personal', ['activo'], {
      name: 'idx_personal_activo'
    });

    await queryInterface.addIndex('personal', ['apellido', 'nombre'], {
      name: 'idx_personal_nombre_completo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('personal');
  }
};