'use strict';

/**
 * Normaliza el estado legado "pendiente_compra" al workflow actual y registra
 * si el equipo fue asignado por Compras. Esta bandera permite crear el borrador
 * solo cuando también estén completas las aprobaciones de Infra y RRHH.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('solicitudes_asignacion', 'equipo_asignado_por_compras', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.sequelize.query(`
      UPDATE solicitudes_asignacion
      SET estado = 'pendiente_infra',
          compra_pendiente = true
      WHERE estado = 'pendiente_compra'
        AND inventario_asignado_id IS NULL
        AND remito_id IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('solicitudes_asignacion', 'equipo_asignado_por_compras');
    // La normalización de estados no se revierte para no reintroducir un estado legado.
  }
};
