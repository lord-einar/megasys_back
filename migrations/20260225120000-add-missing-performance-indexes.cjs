'use strict';

/**
 * Migration: Add Missing Performance Indexes
 *
 * Agrega índices faltantes identificados en análisis de performance:
 *
 * 1. inventario: índice compuesto (sede_id, tipo_articulo_id, estado, activo)
 *    Para query obtenerArticulosDisponibles() que filtra exactamente por estos 4 campos.
 *    Sin este índice es table scan en cada apertura del selector de remitos.
 *
 * 2. visita_informes: índice en visita_id (FK usada en joins frecuentes)
 *
 * 3. visita_problemas_resueltos: índices en visita_id y categoria_problema_id
 *    Para queries de distribución de problemas por categoría (GROUP BY frecuente).
 *
 * 4. personal: índice único en email (usado en autenticación en cada request)
 *    requireDatabaseRole hace Personal.findOne({ where: { email } }) en cada endpoint protegido.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const safeAddIndex = async (tableName, columns, options) => {
      try {
        await queryInterface.addIndex(tableName, columns, options);
        console.log(`✓ Created index ${options.name} on ${tableName}(${columns.join(', ')})`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate key name')) {
          console.log(`⊙ Index ${options.name} already exists, skipping`);
        } else {
          console.error(`✗ Error creating index ${options.name}:`, error.message);
          throw error;
        }
      }
    };

    console.log('Creating missing performance indexes...\n');

    // ============================================================
    // TABLA: inventario
    // Índice compuesto para obtenerArticulosDisponibles()
    // Query: WHERE sede_id = ? AND tipo_articulo_id = ? AND estado = 'disponible' AND activo = true
    // ============================================================
    await safeAddIndex(
      'inventario',
      ['sede_id', 'tipo_articulo_id', 'estado', 'activo'],
      { name: 'idx_inventario_disponibles_composite' }
    );

    // ============================================================
    // TABLA: personal
    // Índice en email para autenticación (requireDatabaseRole lo usa en cada request)
    // ============================================================
    await safeAddIndex(
      'personal',
      ['email'],
      { name: 'idx_personal_email', unique: false }
    );

    // ============================================================
    // TABLA: visita_informes
    // FK principal usada en joins al listar visitas con sus informes
    // ============================================================
    await safeAddIndex(
      'visita_informes',
      ['visita_id'],
      { name: 'idx_visita_informes_visita' }
    );

    // ============================================================
    // TABLA: visita_problemas_resueltos
    // Usada en GROUP BY por categoría (reportes de distribución de problemas)
    // ============================================================
    await safeAddIndex(
      'visita_problemas_resueltos',
      ['informe_id'],
      { name: 'idx_visita_problemas_informe' }
    );

    await safeAddIndex(
      'visita_problemas_resueltos',
      ['categoria_id'],
      { name: 'idx_visita_problemas_categoria' }
    );

    // ============================================================
    // TABLA: visitas
    // Índice en tipo para queries de distribución por tipo
    // ============================================================
    await safeAddIndex(
      'visitas',
      ['tipo'],
      { name: 'idx_visitas_tipo' }
    );

    console.log('\n✅ Missing performance indexes migration completed');
  },

  async down(queryInterface, Sequelize) {
    const safeRemoveIndex = async (tableName, indexName) => {
      try {
        await queryInterface.removeIndex(tableName, indexName);
        console.log(`✓ Removed index ${indexName} from ${tableName}`);
      } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes("Can't DROP")) {
          console.log(`⊙ Index ${indexName} does not exist, skipping`);
        } else {
          throw error;
        }
      }
    };

    await safeRemoveIndex('visitas', 'idx_visitas_tipo');
    await safeRemoveIndex('visita_problemas_resueltos', 'idx_visita_problemas_categoria');
    await safeRemoveIndex('visita_problemas_resueltos', 'idx_visita_problemas_informe');
    await safeRemoveIndex('visita_informes', 'idx_visita_informes_visita');
    await safeRemoveIndex('personal', 'idx_personal_email');
    await safeRemoveIndex('inventario', 'idx_inventario_disponibles_composite');

    console.log('✅ Missing performance indexes rollback completed');
  }
};
