'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. VisitaChecklistItem
    await queryInterface.createTable('visita_checklist_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      orden: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 2. VisitaRecurrencia
    await queryInterface.createTable('visita_recurrencias', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
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
      tecnico_asignado_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      tipo: {
        type: Sequelize.ENUM('urgencia', 'solicitud', 'programada'),
        defaultValue: 'programada',
        allowNull: false
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      frecuencia: {
        type: Sequelize.ENUM('quincenal'),
        defaultValue: 'quincenal',
        allowNull: false
      },
      dia_semana: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      creado_por_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        }
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 3. Visita
    await queryInterface.createTable('visitas', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
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
      tecnico_asignado_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      tipo: {
        type: Sequelize.ENUM('urgencia', 'solicitud', 'programada'),
        defaultValue: 'programada',
        allowNull: false
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      estado: {
        type: Sequelize.ENUM('programada', 'recordatorio_enviado', 'realizada', 'cancelada'),
        defaultValue: 'programada',
        allowNull: false
      },
      es_recurrente: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      recurrencia_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'visita_recurrencias',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      casos_tickets: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      token_solicitudes: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      creado_por_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        }
      },
      fecha_cancelacion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      motivo_cancelacion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 4. VisitaSolicitudPrevia
    await queryInterface.createTable('visita_solicitudes_previas', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      visita_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'visitas',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      solicitante_nombre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      solicitante_email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      resuelta: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      fecha_solicitud: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 5. VisitaInforme
    await queryInterface.createTable('visita_informes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      visita_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'visitas',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tecnico_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'personal',
          key: 'id'
        }
      },
      fecha_realizacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      checklist_items: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: []
      },
      checklist_extra: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      casos_resueltos: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 6. VisitaProblemaResuelto
    await queryInterface.createTable('visita_problemas_resueltos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      informe_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'visita_informes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      categoria: {
        type: Sequelize.ENUM('telefonia', 'red', 'camaras_seguridad', 'grabaciones', 'otro'),
        allowNull: false,
        defaultValue: 'otro'
      },
      causado_por_usuario: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('visita_problemas_resueltos');
    await queryInterface.dropTable('visita_informes');
    await queryInterface.dropTable('visita_solicitudes_previas');
    await queryInterface.dropTable('visitas');
    await queryInterface.dropTable('visita_recurrencias');
    await queryInterface.dropTable('visita_checklist_items');
  }
};
