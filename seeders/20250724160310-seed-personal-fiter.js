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

    // Obtener rol Club Manager
    const rolesResult = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE nombre = 'Club Manager'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (rolesResult.length === 0) {
      throw new Error('Rol "Club Manager" no encontrado');
    }

    const clubManagerRolId = rolesResult[0].id;

    // Obtener todas las sedes de Fiter
    const sedesResult = await queryInterface.sequelize.query(
      "SELECT id, nombre_sede FROM sedes WHERE empresa_id = ? ORDER BY nombre_sede",
      {
        replacements: [fiterId],
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    );

    const sedesMap = {};
    sedesResult.forEach(sede => {
      sedesMap[sede.nombre_sede] = sede.id;
    });

    // Helper function to split nombre completo
    function splitNombreCompleto(nombreCompleto) {
      const partes = nombreCompleto.trim().split(/\s+/);
      if (partes.length === 1) {
        return { nombre: partes[0], apellido: partes[0] };
      } else {
        const nombre = partes.slice(0, -1).join(' ');
        const apellido = partes[partes.length - 1];
        return { nombre, apellido };
      }
    }

    // Datos de personal Fiter
    const personalData = [
      {
        sede: 'Fiter Abasto',
        nombre: 'Fatima Carrillo',
        email: 'fcarrillo@fiter.com.ar',
        telefono: '11 3699-6879',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Abasto']
      },
      {
        sede: 'Fiter Adrogué',
        nombre: 'Jimena Castro',
        email: 'jcastro@fiter.com.ar',
        telefono: '11 3683-6019',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Adrogué']
      },
      {
        sede: 'Fiter Almagro',
        nombre: 'Hernan Schmilchuk',
        email: 'hschmilchuk@fiter.com.ar',
        telefono: '11 6646-1000',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Almagro']
      },
      {
        sede: 'Fiter Barrio Norte',
        nombre: 'Yanina Morell',
        email: 'ymorell@fiter.com.ar',
        telefono: '11 3683-9938',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Barrio Norte']
      },
      {
        sede: 'Fiter Caballito',
        nombre: 'Ivan Sivori',
        email: 'gsivori@fiter.com.ar',
        telefono: '11 3882 1359',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Caballito']
      },
      {
        sede: 'Fiter Caballito 2',
        nombre: 'Luis Albornoz',
        email: 'lalbornoz@fiter.com.ar',
        telefono: '11-3588-9335',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Caballito 2']
      },
      {
        sede: 'Fiter Caballito 3',
        nombre: 'Lucas Coria',
        email: 'lcoria@fiter.com.ar',
        telefono: '114406-9398',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Caballito 3']
      },
      {
        sede: 'Fiter Center',
        nombre: 'Amelia Wild',
        email: 'awild@fiter.com.ar',
        telefono: '11 5603-7579',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Center']
      },
      {
        sede: 'Fiter Cid Campeador',
        nombre: 'Brian Hindle',
        email: 'bhindle@fiter.com.ar',
        telefono: '11 3155-5309',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Cid Campeador']
      },
      {
        sede: 'Fiter Congreso',
        nombre: 'Alejandro Diaz',
        email: 'adiaz@fiter.com.ar',
        telefono: '11 3701-8352',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Congreso']
      },
      {
        sede: 'Fiter Flores',
        nombre: 'Ana Rivas',
        email: 'arivas@fiter.com.ar',
        telefono: '1102789-3505',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Flores']
      },
      {
        sede: 'Fiter Hollywood',
        nombre: 'Andres Vallenilla',
        email: 'avallenilla@fiter.com.ar',
        telefono: '',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Hollywood']
      },
      {
        sede: 'Fiter Lomas',
        nombre: 'Cristina Sanchez',
        email: 'csanchez@fiter.com.ar',
        telefono: '11 5661-5550',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Lomas']
      },
      {
        sede: 'Fiter Microcentro',
        nombre: 'Karlen Morantes',
        email: 'kmorantes@fiter.com.ar',
        telefono: '11 2868-6987',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Microcentro']
      },
      {
        sede: 'Fiter Núñez',
        nombre: 'Laura Abramowitz',
        email: 'labramowitz@fiter.com.ar',
        telefono: '11 4195-7008',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Núñez']
      },
      {
        sede: 'Fiter Palermo',
        nombre: 'Martina Diaz',
        email: 'diaz@fiter.com.ar',
        telefono: '11 5603-7579',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Palermo']
      },
      {
        sede: 'Fiter Quilmes',
        nombre: 'Ana Vera',
        email: 'avera@fiter.com.ar',
        telefono: '11 2868 6987',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Quilmes']
      },
      {
        // Pablo Bidone aparece en múltiples sedes
        nombre: 'Pablo Bidone',
        email: 'pbidone@fiter.com.ar',
        telefono: '+598 95 462 935',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Buceo', 'Fiter Punta Carretas']
      },
      {
        sede: 'Fiter Maldonado',
        nombre: 'Roman Spagnuolo',
        email: 'rspagnuolo@fiter.com.ar',
        telefono: '+54 9 11 2827-9358',
        rol: 'Club Manager',
        sedesPrincipales: ['Fiter Maldonado']
      }
    ];

    // Mapeo para evitar duplicados de personas
    const personalMap = {};
    const personalToInsert = [];
    const personalSedesInsert = [];

    for (const person of personalData) {
      const personKey = person.email.toLowerCase();

      let personId;

      // Si ya existe esta persona, reutilizar su ID
      if (personalMap[personKey]) {
        personId = personalMap[personKey];
      } else {
        personId = uuidv4();
        personalMap[personKey] = personId;

        const { nombre, apellido } = splitNombreCompleto(person.nombre);

        // Asignar sede principal (la primera de la lista)
        const sedePrincipalNombre = person.sedesPrincipales[0];
        const sedePrincipalId = sedesMap[sedePrincipalNombre];

        if (!sedePrincipalId) {
          throw new Error(`Sede "${sedePrincipalNombre}" no encontrada para ${person.nombre}`);
        }

        personalToInsert.push({
          id: personId,
          nombre: nombre,
          apellido: apellido,
          email: person.email,
          telefono: person.telefono || null,
          sede_id: sedePrincipalId,
          rol_id: clubManagerRolId, // Asignar Club Manager en ambas tablas para unificar con Megatlon
          privilegio_app: 'user',
          activo: true,
          fecha_ingreso: new Date().toISOString().split('T')[0],
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // Crear registros en personal_sedes para CADA sede asignada
      for (const sedeNombre of person.sedesPrincipales) {
        const sedeId = sedesMap[sedeNombre];

        if (!sedeId) {
          throw new Error(`Sede "${sedeNombre}" no encontrada`);
        }

        personalSedesInsert.push({
          id: uuidv4(),
          personal_id: personId,
          sede_id: sedeId,
          rol_id: clubManagerRolId,
          fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_fin: null,
          activo: true,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    // Insertar personal
    if (personalToInsert.length > 0) {
      await queryInterface.bulkInsert('personal', personalToInsert);
      console.log(`✅ ${personalToInsert.length} personas Fiter creadas`);
    }

    // Insertar personal_sedes
    if (personalSedesInsert.length > 0) {
      await queryInterface.bulkInsert('personal_sedes', personalSedesInsert);
      console.log(`✅ ${personalSedesInsert.length} asignaciones de sedes creadas`);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar asignaciones personal_sedes para personal de Fiter
    const fiterlEmails = [
      'fcarrillo@fiter.com.ar', 'jcastro@fiter.com.ar', 'hschmilchuk@fiter.com.ar',
      'ymorell@fiter.com.ar', 'gsivori@fiter.com.ar', 'lalbornoz@fiter.com.ar',
      'lcoria@fiter.com.ar', 'awild@fiter.com.ar', 'bhindle@fiter.com.ar',
      'adiaz@fiter.com.ar', 'arivas@fiter.com.ar', 'avallenilla@fiter.com.ar',
      'csanchez@fiter.com.ar', 'kmorantes@fiter.com.ar', 'labramowitz@fiter.com.ar',
      'diaz@fiter.com.ar', 'avera@fiter.com.ar', 'pbidone@fiter.com.ar',
      'rspagnuolo@fiter.com.ar'
    ];

    const emails = fiterlEmails.map(e => `'${e}'`).join(',');

    await queryInterface.sequelize.query(
      `DELETE FROM personal_sedes
       WHERE personal_id IN (SELECT id FROM personal WHERE email IN (${emails}))`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM personal WHERE email IN (${emails})`
    );
  }
};
