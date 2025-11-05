'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');

    // Obtener Fiter ID
    const empresas = await queryInterface.sequelize.query(
      "SELECT id FROM empresas WHERE nombre_empresa = 'Fiter'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (empresas.length === 0) {
      throw new Error('Empresa Fiter no encontrada');
    }

    const fiterId = empresas[0].id;

    // 2 nuevas sedes Fiter
    const nuevasSedes = [
      {
        id: uuidv4(),
        empresa_id: fiterId,
        nombre_sede: 'Fiter Quilmes',
        direccion: 'Videla 265',
        localidad: 'Quilmes',
        provincia: 'Buenos Aires',
        pais: 'Argentina',
        telefono: '011 2120-1400',
        ip_sede: null,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        empresa_id: fiterId,
        nombre_sede: 'Fiter Center',
        direccion: 'Florida 770',
        localidad: 'CABA',
        provincia: 'Buenos Aires',
        pais: 'Argentina',
        telefono: '011 2120-1400',
        ip_sede: null,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('sedes', nuevasSedes);
    console.log(`✅ 2 nuevas sedes Fiter creadas: Quilmes y Center`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `DELETE FROM sedes WHERE nombre_sede IN ('Fiter Quilmes', 'Fiter Center')`
    );
  }
};
