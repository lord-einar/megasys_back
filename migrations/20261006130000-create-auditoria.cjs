'use strict';

/**
 * Crea la tabla de auditoría. El modelo Auditoria y AuditService existían,
 * pero la tabla nunca se creó: cada registro fallaba en silencio (AuditService
 * captura el error para no cortar la operación principal).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auditoria', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      usuario_email: { type: Sequelize.STRING(100), allowNull: false },
      usuario_id: { type: Sequelize.UUID, allowNull: true },
      modulo: { type: Sequelize.STRING(50), allowNull: false },
      accion: { type: Sequelize.STRING(50), allowNull: false },
      recurso: { type: Sequelize.STRING(100), allowNull: false },
      recurso_id: { type: Sequelize.UUID, allowNull: true },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      valores_anteriores: { type: Sequelize.JSON, allowNull: true },
      valores_nuevos: { type: Sequelize.JSON, allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      resultado: {
        type: Sequelize.ENUM('exitoso', 'fallido', 'parcial'),
        allowNull: false,
        defaultValue: 'exitoso'
      },
      mensaje_error: { type: Sequelize.TEXT, allowNull: true },
      fecha_accion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('auditoria', ['usuario_email', 'fecha_accion']);
    await queryInterface.addIndex('auditoria', ['modulo', 'accion']);
    await queryInterface.addIndex('auditoria', ['recurso_id', 'fecha_accion']);
    await queryInterface.addIndex('auditoria', ['fecha_accion']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auditoria');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_auditoria_resultado";');
  }
};
