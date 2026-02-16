'use strict';

/**
 * Migración para agregar el estado 'devuelto_parcial' al ENUM de remitos.
 * 
 * En PostgreSQL, ALTER TYPE ... ADD VALUE es la forma segura de extender un ENUM
 * sin recrear la columna ni afectar datos existentes.
 * 
 * NOTA: ALTER TYPE ADD VALUE no es transaccional en PostgreSQL < 12.
 * En PG 12+, se puede usar dentro de una transacción si es la única sentencia.
 * Por seguridad, usamos queryInterface.sequelize.query directamente.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Verificar si el valor ya existe para evitar errores en re-ejecuciones
        const [results] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'devuelto_parcial' 
        AND enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'enum_remitos_estado'
        )
      ) as exists;
    `);

        if (!results[0].exists) {
            // Agregar el nuevo valor al ENUM existente
            // Se añade BEFORE 'devuelto' para mantener un orden lógico
            await queryInterface.sequelize.query(`
        ALTER TYPE "enum_remitos_estado" ADD VALUE 'devuelto_parcial' BEFORE 'devuelto';
      `);
        }
    },

    async down(queryInterface, Sequelize) {
        // NOTA: PostgreSQL no soporta ALTER TYPE DROP VALUE directamente.
        // Para un rollback completo, habría que recrear el ENUM y actualizar la columna.
        // En la práctica, dejar el valor sin usar es inofensivo.
        // Si se necesita un rollback real, se haría manualmente.
        console.log('NOTA: No se puede eliminar un valor de un ENUM en PostgreSQL sin recrear el tipo.');
        console.log('El valor "devuelto_parcial" permanecerá en el ENUM pero no será usado.');
    }
};
