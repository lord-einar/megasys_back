'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if columns exist before adding them (idempotent migration)
    const [informesColumns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'visita_informes'`
    );
    const informesColumnNames = informesColumns.map(c => c.column_name);

    const [visitasColumns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'visitas'`
    );
    const visitasColumnNames = visitasColumns.map(c => c.column_name);

    // Agregar campos de tracking de comentarios al informe solo si no existen
    if (!informesColumnNames.includes('comentarios_responsable_fecha')) {
      await queryInterface.addColumn('visita_informes', 'comentarios_responsable_fecha', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha y hora cuando se agregaron los comentarios del responsable'
      });
    }

    if (!informesColumnNames.includes('comentarios_responsable_nombre')) {
      await queryInterface.addColumn('visita_informes', 'comentarios_responsable_nombre', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Nombre o email de quien agregó los comentarios'
      });
    }

    // Agregar token_feedback a visitas solo si no existe
    if (!visitasColumnNames.includes('token_feedback')) {
      await queryInterface.addColumn('visitas', 'token_feedback', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'Token único para que el responsable de sede agregue comentarios post-visita'
      });
    }

    // Agregar índice para token_feedback solo si no existe
    const [indexes] = await queryInterface.sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'visitas' AND indexname = 'visitas_token_feedback_unique'`
    );

    if (indexes.length === 0) {
      await queryInterface.addIndex('visitas', ['token_feedback'], {
        unique: true,
        name: 'visitas_token_feedback_unique'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Check if objects exist before removing them
    const [indexes] = await queryInterface.sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'visitas' AND indexname = 'visitas_token_feedback_unique'`
    );

    if (indexes.length > 0) {
      await queryInterface.removeIndex('visitas', 'visitas_token_feedback_unique');
    }

    const [visitasColumns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'visitas'`
    );
    const visitasColumnNames = visitasColumns.map(c => c.column_name);

    const [informesColumns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'visita_informes'`
    );
    const informesColumnNames = informesColumns.map(c => c.column_name);

    if (visitasColumnNames.includes('token_feedback')) {
      await queryInterface.removeColumn('visitas', 'token_feedback');
    }

    if (informesColumnNames.includes('comentarios_responsable_nombre')) {
      await queryInterface.removeColumn('visita_informes', 'comentarios_responsable_nombre');
    }

    if (informesColumnNames.includes('comentarios_responsable_fecha')) {
      await queryInterface.removeColumn('visita_informes', 'comentarios_responsable_fecha');
    }
  }
};
