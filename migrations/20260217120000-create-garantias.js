/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 1. Crear tabla garantias
    await queryInterface.createTable('garantias', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      inventario_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'inventario',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fabricante: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      tipo: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      nombre: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      estado: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      estado_original: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      duracion_meses: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      tipo_entrega: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      codigo_tipo: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      pais: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      origen: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      datos_originales: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      consultado_en: {
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

    await queryInterface.addIndex('garantias', ['inventario_id'], {
      name: 'idx_garantias_inventario_id'
    });
    await queryInterface.addIndex('garantias', ['estado'], {
      name: 'idx_garantias_estado'
    });
    await queryInterface.addIndex('garantias', ['fecha_fin'], {
      name: 'idx_garantias_fecha_fin'
    });

    // 2. Agregar columnas de garantía a inventario
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_inventario_garantia_estado" AS ENUM (
          'sin_consultar', 'consultando', 'con_garantia', 'sin_garantia', 'error'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "inventario"
      ADD COLUMN "garantia_estado" "enum_inventario_garantia_estado" NOT NULL DEFAULT 'sin_consultar';
    `);

    await queryInterface.addColumn('inventario', 'garantia_consultada_en', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('inventario', 'garantia_fecha_fin', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inventario', 'garantia_fecha_fin');
    await queryInterface.removeColumn('inventario', 'garantia_consultada_en');
    await queryInterface.removeColumn('inventario', 'garantia_estado');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventario_garantia_estado";');

    await queryInterface.dropTable('garantias');
  }
};
