'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const addEnumValue = async (typeName, value) => {
      await queryInterface.sequelize.query(`
        ALTER TYPE ${typeName} ADD VALUE IF NOT EXISTS '${value}';
      `);
    };

    await addEnumValue('enum_solicitudes_compra_motivo', 'cambio_equipo');
    await addEnumValue('enum_solicitudes_compra_motivo', 'otro');

    for (const estado of [
      'pendiente_pedido',
      'pedido',
      'recibido',
      'entregado_sistemas',
      'entregado_destinatario',
      'finalizada'
    ]) {
      await addEnumValue('enum_solicitudes_compra_estado', estado);
    }

    for (const accion of [
      'pedido',
      'recibido',
      'entregado_sistemas',
      'entregado_destinatario',
      'finalizada'
    ]) {
      await addEnumValue('enum_solicitudes_compra_historial_accion', accion);
    }

    await queryInterface.addColumn('solicitudes_compra', 'compras_estado_fecha', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('solicitudes_compra', 'compras_entrega_observacion', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('solicitudes_compra', 'imei', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('solicitudes_compra', 'numero_serie_final', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('solicitudes_compra', 'sistemas_fecha', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('solicitudes_compra', 'sistemas_observacion', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      CREATE TYPE enum_solicitudes_compra_adjuntos_tipo AS ENUM ('denuncia', 'rotura', 'otro');
    `).catch(() => null);
    await queryInterface.addColumn('solicitudes_compra_adjuntos', 'tipo', {
      type: Sequelize.ENUM('denuncia', 'rotura', 'otro'),
      allowNull: false,
      defaultValue: 'otro'
    });
    await queryInterface.addIndex('solicitudes_compra_adjuntos', ['tipo']);

    await queryInterface.changeColumn('inventario', 'sede_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'sedes', key: 'id' },
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('solicitudes_compra', 'compras_estado_fecha');
    await queryInterface.removeColumn('solicitudes_compra', 'compras_entrega_observacion');
    await queryInterface.removeColumn('solicitudes_compra', 'imei');
    await queryInterface.removeColumn('solicitudes_compra', 'numero_serie_final');
    await queryInterface.removeColumn('solicitudes_compra', 'sistemas_fecha');
    await queryInterface.removeColumn('solicitudes_compra', 'sistemas_observacion');
    await queryInterface.removeColumn('solicitudes_compra_adjuntos', 'tipo');
    await queryInterface.changeColumn('inventario', 'sede_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'sedes', key: 'id' },
      onDelete: 'RESTRICT'
    });
  }
};
