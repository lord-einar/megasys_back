/**
 * Migración: Agregar campo es_prueba a tabla sedes
 *
 * Permite marcar sedes como "de prueba" para excluirlas de reportes y estadísticas
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sedes', 'es_prueba', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si la sede es de prueba (excluida de estadísticas y reportes)'
    });

    // Crear índice para optimizar consultas que filtren por es_prueba
    await queryInterface.addIndex('sedes', ['es_prueba'], {
      name: 'idx_sedes_es_prueba'
    });

    console.log('✓ Campo es_prueba agregado a tabla sedes');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('sedes', 'idx_sedes_es_prueba');
    await queryInterface.removeColumn('sedes', 'es_prueba');
    console.log('✓ Campo es_prueba removido de tabla sedes');
  }
};
