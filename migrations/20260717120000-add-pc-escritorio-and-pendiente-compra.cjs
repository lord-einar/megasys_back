'use strict';

/**
 * Habilita "PC de escritorio" como tercer tipo de equipo y el estado
 * "pendiente_compra" en las solicitudes de asignación.
 *
 * - enum_solicitudes_asignacion_tipo_equipo  += 'pc_escritorio'
 * - enum_solicitudes_compra_tipo_equipo       += 'pc_escritorio'
 * - enum_categoria_equipos_tipo               += 'pc'
 * - enum_solicitudes_asignacion_estado        += 'pendiente_compra'
 * - enum_solicitudes_asignacion_historial_accion += 'solicitud_compra'
 *
 * Postgres no permite quitar valores de un ENUM sin recrear el tipo, por eso
 * el down() se deja como no-op (mismo criterio que la migración de 'compras').
 */
module.exports = {
  async up(queryInterface) {
    const alters = [
      `ALTER TYPE enum_solicitudes_asignacion_tipo_equipo ADD VALUE IF NOT EXISTS 'pc_escritorio';`,
      `ALTER TYPE enum_solicitudes_compra_tipo_equipo ADD VALUE IF NOT EXISTS 'pc_escritorio';`,
      `ALTER TYPE enum_categoria_equipos_tipo ADD VALUE IF NOT EXISTS 'pc';`,
      `ALTER TYPE enum_solicitudes_asignacion_estado ADD VALUE IF NOT EXISTS 'pendiente_compra';`,
      `ALTER TYPE enum_solicitudes_asignacion_historial_accion ADD VALUE IF NOT EXISTS 'solicitud_compra';`
    ];

    for (const sql of alters) {
      await queryInterface.sequelize.query(sql);
    }
  },

  async down() {
    // No-op: Postgres no soporta remover valores de un ENUM sin recrear el tipo.
  }
};
