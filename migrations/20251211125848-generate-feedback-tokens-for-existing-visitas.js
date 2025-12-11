'use strict';

const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener todas las visitas que no tienen token_feedback
    const [visitas] = await queryInterface.sequelize.query(
      'SELECT id FROM visitas WHERE token_feedback IS NULL'
    );

    console.log(`Generando tokens para ${visitas.length} visitas existentes...`);

    // Generar token único para cada visita
    for (const visita of visitas) {
      const token = crypto.randomBytes(24).toString('hex');
      await queryInterface.sequelize.query(
        'UPDATE visitas SET token_feedback = :token WHERE id = :id',
        {
          replacements: { token, id: visita.id }
        }
      );
    }

    console.log(`✓ Tokens generados correctamente para ${visitas.length} visitas`);
  },

  async down (queryInterface, Sequelize) {
    // No need to revert, tokens are harmless
    console.log('No action needed for down migration');
  }
};
