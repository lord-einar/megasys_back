/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // =====================================================
    // 1. SIMPLIFICAR TABLA PROVEEDORES
    //    Remover telefono y email (se manejan en ejecutivos/soporte)
    // =====================================================
    await queryInterface.removeColumn('proveedores', 'telefono');
    await queryInterface.removeColumn('proveedores', 'email');

    // =====================================================
    // 2. REESTRUCTURAR TABLA SOPORTE_NIVELES
    //    Cambiar de servicio_id a proveedor_id + tipo_servicio_id
    // =====================================================

    // 2a. Remover índice y FK existente de servicio_id
    await queryInterface.removeIndex('soporte_niveles', 'idx_soporte_servicio_nivel');
    await queryInterface.removeColumn('soporte_niveles', 'servicio_id');

    // 2b. Agregar proveedor_id
    await queryInterface.addColumn('soporte_niveles', 'proveedor_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'proveedores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // 2c. Agregar tipo_servicio_id
    await queryInterface.addColumn('soporte_niveles', 'tipo_servicio_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'tipos_servicio',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // 2d. Hacer email nullable (al menos uno de email/telefono/web debe existir)
    await queryInterface.changeColumn('soporte_niveles', 'email', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    // 2e. Crear nuevo índice unique (proveedor + tipo_servicio + nivel)
    await queryInterface.addIndex('soporte_niveles', ['proveedor_id', 'tipo_servicio_id', 'nivel'], {
      unique: true,
      name: 'idx_soporte_proveedor_tipo_nivel'
    });

    // 2f. Índices individuales para búsquedas
    await queryInterface.addIndex('soporte_niveles', ['proveedor_id'], {
      name: 'idx_soporte_proveedor'
    });

    await queryInterface.addIndex('soporte_niveles', ['tipo_servicio_id'], {
      name: 'idx_soporte_tipo_servicio'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir en orden inverso

    // Remover índices nuevos
    await queryInterface.removeIndex('soporte_niveles', 'idx_soporte_tipo_servicio');
    await queryInterface.removeIndex('soporte_niveles', 'idx_soporte_proveedor');
    await queryInterface.removeIndex('soporte_niveles', 'idx_soporte_proveedor_tipo_nivel');

    // Revertir email a NOT NULL
    await queryInterface.changeColumn('soporte_niveles', 'email', {
      type: Sequelize.STRING(100),
      allowNull: false
    });

    // Remover columnas nuevas
    await queryInterface.removeColumn('soporte_niveles', 'tipo_servicio_id');
    await queryInterface.removeColumn('soporte_niveles', 'proveedor_id');

    // Restaurar servicio_id
    await queryInterface.addColumn('soporte_niveles', 'servicio_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'servicios',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Restaurar índice original
    await queryInterface.addIndex('soporte_niveles', ['servicio_id', 'nivel'], {
      unique: true,
      name: 'idx_soporte_servicio_nivel'
    });

    // Restaurar columnas de proveedores
    await queryInterface.addColumn('proveedores', 'email', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('proveedores', 'telefono', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  }
};
