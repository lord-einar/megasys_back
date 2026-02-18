'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Verificar si las columnas ya existen antes de intentar agregarlas, por seguridad
        const tableInfo = await queryInterface.describeTable('inventario');

        if (!tableInfo.procesador) {
            await queryInterface.addColumn('inventario', 'procesador', {
                type: Sequelize.STRING(100),
                allowNull: true
            });
        }

        if (!tableInfo.memoria) {
            await queryInterface.addColumn('inventario', 'memoria', {
                type: Sequelize.STRING(50),
                allowNull: true
            });
        }

        if (!tableInfo.disco) {
            await queryInterface.addColumn('inventario', 'disco', {
                type: Sequelize.STRING(100),
                allowNull: true
            });
        }

        if (!tableInfo.sistema_operativo) {
            await queryInterface.addColumn('inventario', 'sistema_operativo', {
                type: Sequelize.STRING(100),
                allowNull: true
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('inventario', 'procesador');
        await queryInterface.removeColumn('inventario', 'memoria');
        await queryInterface.removeColumn('inventario', 'disco');
        await queryInterface.removeColumn('inventario', 'sistema_operativo');
    }
};
