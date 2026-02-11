'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Verificar si las columnas ya existen antes de agregarlas
      const tableDescription = await queryInterface.describeTable('visita_informes');

      // Agregar columna editado_por_id si no existe
      if (!tableDescription.editado_por_id) {
        await queryInterface.addColumn(
          'visita_informes',
          'editado_por_id',
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'personal',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
            comment: 'ID del usuario que editó el informe (null si nunca fue editado)'
          },
          { transaction }
        );
      }

      // Agregar columna fecha_ultima_edicion si no existe
      if (!tableDescription.fecha_ultima_edicion) {
        await queryInterface.addColumn(
          'visita_informes',
          'fecha_ultima_edicion',
          {
            type: Sequelize.DATE,
            allowNull: true,
            comment: 'Fecha y hora de la última edición del informe'
          },
          { transaction }
        );
      }

      // Agregar columna veces_editado si no existe
      if (!tableDescription.veces_editado) {
        await queryInterface.addColumn(
          'visita_informes',
          'veces_editado',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Contador de veces que se editó el informe'
          },
          { transaction }
        );
      }

      // Agregar índice si no existe
      const indexes = await queryInterface.showIndex('visita_informes', { transaction });
      const indexExists = indexes.some(index => index.name === 'idx_visita_informes_editado_por');

      if (!indexExists) {
        await queryInterface.addIndex(
          'visita_informes',
          ['editado_por_id'],
          {
            name: 'idx_visita_informes_editado_por',
            transaction
          }
        );
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
      await queryInterface.removeIndex(
        'visita_informes',
        'idx_visita_informes_editado_por',
        { transaction }
      );

      // Eliminar columnas
      await queryInterface.removeColumn('visita_informes', 'veces_editado', { transaction });
      await queryInterface.removeColumn('visita_informes', 'fecha_ultima_edicion', { transaction });
      await queryInterface.removeColumn('visita_informes', 'editado_por_id', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
