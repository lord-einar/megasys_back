'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('personal', 'color', {
            type: Sequelize.STRING(7),
            allowNull: true,
            defaultValue: '#007bff',
            comment: 'Color identificador del técnico para calendario y listas'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('personal', 'color');
    }
};
