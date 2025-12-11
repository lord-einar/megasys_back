'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar campos de feedback del responsable de sede al informe
    await queryInterface.addColumn('visita_informes', 'comentarios_responsable_sede', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Comentarios adicionales del responsable de la sede'
    });

    await queryInterface.addColumn('visita_informes', 'comentarios_responsable_fecha', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha y hora cuando se agregaron los comentarios del responsable'
    });

    await queryInterface.addColumn('visita_informes', 'comentarios_responsable_nombre', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Nombre o email de quien agregó los comentarios'
    });

    // Agregar token_feedback a visitas
    await queryInterface.addColumn('visitas', 'token_feedback', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      comment: 'Token único para que el responsable de sede agregue comentarios post-visita'
    });

    // Agregar índice para token_feedback
    await queryInterface.addIndex('visitas', ['token_feedback'], {
      unique: true,
      name: 'visitas_token_feedback_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('visitas', 'visitas_token_feedback_unique');
    await queryInterface.removeColumn('visitas', 'token_feedback');
    await queryInterface.removeColumn('visita_informes', 'comentarios_responsable_nombre');
    await queryInterface.removeColumn('visita_informes', 'comentarios_responsable_fecha');
    await queryInterface.removeColumn('visita_informes', 'comentarios_responsable_sede');
  }
};
