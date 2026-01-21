'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Crear la tabla categorias_problemas
        await queryInterface.createTable('categorias_problemas', {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                defaultValue: Sequelize.UUIDV4
            },
            nombre: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true
            },
            codigo: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true,
                comment: 'Código para compatibilidad con datos históricos'
            },
            descripcion: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            icono: {
                type: Sequelize.STRING(50),
                allowNull: true,
                defaultValue: 'question-mark-circle',
                comment: 'Nombre del icono heroicons'
            },
            color: {
                type: Sequelize.STRING(20),
                allowNull: true,
                defaultValue: '#6b7280',
                comment: 'Color en formato hexadecimal'
            },
            orden: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                comment: 'Para ordenar las categorías en el formulario'
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

        // 2. Crear índices
        await queryInterface.addIndex('categorias_problemas', ['activo']);
        await queryInterface.addIndex('categorias_problemas', ['orden']);
        await queryInterface.addIndex('categorias_problemas', ['codigo'], { unique: true });

        // 3. Insertar categorías por defecto basadas en el ENUM existente
        await queryInterface.bulkInsert('categorias_problemas', [
            {
                id: Sequelize.literal('gen_random_uuid()'),
                nombre: 'Telefonía',
                codigo: 'telefonia',
                descripcion: 'Problemas relacionados con el sistema telefónico',
                icono: 'phone',
                color: '#3b82f6',
                orden: 1,
                activo: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                id: Sequelize.literal('gen_random_uuid()'),
                nombre: 'Red',
                codigo: 'red',
                descripcion: 'Problemas de conectividad y red',
                icono: 'wifi',
                color: '#10b981',
                orden: 2,
                activo: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                id: Sequelize.literal('gen_random_uuid()'),
                nombre: 'Cámaras de Seguridad',
                codigo: 'camaras_seguridad',
                descripcion: 'Problemas con el sistema de cámaras de seguridad',
                icono: 'video-camera',
                color: '#ef4444',
                orden: 3,
                activo: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                id: Sequelize.literal('gen_random_uuid()'),
                nombre: 'Grabaciones',
                codigo: 'grabaciones',
                descripcion: 'Problemas con el sistema de grabación',
                icono: 'film',
                color: '#f59e0b',
                orden: 4,
                activo: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                id: Sequelize.literal('gen_random_uuid()'),
                nombre: 'Otro',
                codigo: 'otro',
                descripcion: 'Otros problemas no categorizados',
                icono: 'question-mark-circle',
                color: '#6b7280',
                orden: 5,
                activo: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);

        // 4. Agregar nueva columna categoria_id a visita_problemas_resueltos
        await queryInterface.addColumn('visita_problemas_resueltos', 'categoria_id', {
            type: Sequelize.UUID,
            allowNull: true, // Temporalmente nullable para migración
            references: {
                model: 'categorias_problemas',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        // 5. Migrar datos del ENUM al nuevo campo categoria_id
        // Esto se hace mediante una consulta SQL directa
        // Usamos cast ::text para comparar el ENUM con VARCHAR
        await queryInterface.sequelize.query(`
      UPDATE visita_problemas_resueltos vpr
      SET categoria_id = cp.id
      FROM categorias_problemas cp
      WHERE cp.codigo = vpr.categoria::text
    `);

        // 6. Crear índice en categoria_id
        await queryInterface.addIndex('visita_problemas_resueltos', ['categoria_id']);

        // 7. Eliminar la columna ENUM antigua (categoria)
        // NOTA: En PostgreSQL, también necesitamos eliminar el tipo ENUM si no se usa en otro lugar
        await queryInterface.removeColumn('visita_problemas_resueltos', 'categoria');

        // 8. Intentar eliminar el tipo ENUM (puede fallar si se usa en otro lugar, pero está bien)
        try {
            await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_visita_problemas_resueltos_categoria"');
        } catch (error) {
            console.log('No se pudo eliminar el tipo ENUM, puede que aún esté en uso:', error.message);
        }

        // 9. Hacer categoria_id NOT NULL ahora que todos los datos están migrados
        await queryInterface.changeColumn('visita_problemas_resueltos', 'categoria_id', {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
                model: 'categorias_problemas',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    },

    async down(queryInterface, Sequelize) {
        // 1. Agregar de vuelta la columna ENUM categoria
        await queryInterface.addColumn('visita_problemas_resueltos', 'categoria', {
            type: Sequelize.ENUM('telefonia', 'red', 'camaras_seguridad', 'grabaciones', 'otro'),
            allowNull: true,
            defaultValue: 'otro'
        });

        // 2. Migrar datos de vuelta del categoria_id al ENUM
        // Usamos cast al tipo ENUM para asignar el valor correcto
        await queryInterface.sequelize.query(`
      UPDATE visita_problemas_resueltos vpr
      SET categoria = cp.codigo::enum_visita_problemas_resueltos_categoria
      FROM categorias_problemas cp
      WHERE cp.id = vpr.categoria_id
    `);

        // 3. Hacer categoria NOT NULL
        await queryInterface.changeColumn('visita_problemas_resueltos', 'categoria', {
            type: Sequelize.ENUM('telefonia', 'red', 'camaras_seguridad', 'grabaciones', 'otro'),
            allowNull: false,
            defaultValue: 'otro'
        });

        // 4. Eliminar índice y columna categoria_id
        await queryInterface.removeIndex('visita_problemas_resueltos', ['categoria_id']);
        await queryInterface.removeColumn('visita_problemas_resueltos', 'categoria_id');

        // 5. Eliminar tabla categorias_problemas
        await queryInterface.dropTable('categorias_problemas');
    }
};
