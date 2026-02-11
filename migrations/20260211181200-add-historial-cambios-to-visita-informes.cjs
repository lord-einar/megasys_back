'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Verificar si la columna ya existe
      const tableDescription = await queryInterface.describeTable('visita_informes');

      if (!tableDescription.historial_cambios) {
        // Agregar columna historial_cambios
        await queryInterface.addColumn(
          'visita_informes',
          'historial_cambios',
          {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: [],
            comment: 'Array de objetos con historial de cambios: [{ fecha, usuario, cambios }]'
          },
          { transaction }
        );

        // Agregar índice GIN para búsquedas en JSONB
        const indexes = await queryInterface.showIndex('visita_informes', { transaction });
        const indexExists = indexes.some(index => index.name === 'idx_visita_informes_historial_cambios');

        if (!indexExists) {
          await queryInterface.sequelize.query(
            'CREATE INDEX IF NOT EXISTS idx_visita_informes_historial_cambios ON visita_informes USING gin(historial_cambios)',
            { transaction }
          );
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Eliminar índice
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_visita_informes_historial_cambios',
        { transaction }
      );

      // Eliminar columna
      await queryInterface.removeColumn('visita_informes', 'historial_cambios', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
