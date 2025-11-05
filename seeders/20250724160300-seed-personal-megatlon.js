'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');

    // Obtener IDs de Megatlon, roles y sedes necesarias
    const empresas = await queryInterface.sequelize.query(
      "SELECT id FROM empresas WHERE nombre_empresa = 'Megatlon'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (empresas.length === 0) {
      throw new Error('Empresa Megatlon no encontrada');
    }

    const megatlonId = empresas[0].id;

    // Obtener roles por nombre
    const rolesResult = await queryInterface.sequelize.query(
      "SELECT id, nombre FROM roles",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const rolesMap = {};
    rolesResult.forEach(role => {
      rolesMap[role.nombre] = role.id;
    });

    // Obtener sedes de Megatlon
    const sedesResult = await queryInterface.sequelize.query(
      "SELECT id, nombre_sede FROM sedes WHERE empresa_id = ? ORDER BY nombre_sede",
      {
        replacements: [megatlonId],
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    );

    const sedesMap = {};
    sedesResult.forEach(sede => {
      sedesMap[sede.nombre_sede] = sede.id;
    });

    // Datos de personal por sede - Mapeo exacto de roles a IDs
    const personalData = [
      // ALCORTA
      {
        sede: 'Alcorta',
        personal: [
          { nombre: 'Marina Socolovsky', email: 'msocolovsky@megatlon.com.ar', telefono: '15.5705.2411', rol: 'Gerente Generalista', privilegio: 'user' }
        ]
      },
      // ALMAGRO
      {
        sede: 'Almagro',
        personal: [
          { nombre: 'Mariela Funes', email: 'marielaf@megatlon.com.ar', telefono: '11.3699.7258', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Maria Sol Portunato', email: 'mportunato@megatlon.com.ar', telefono: '11.3143.1550', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Giselle Benítez', email: 'gbenitez@megatlon.com.ar', telefono: '11.2819.4884', rol: 'Gerente de Servicio', privilegio: 'user' },
          { nombre: 'Matias Baez', email: 'mbaez@megatlon.com.ar', telefono: '', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // ALTO PALERMO
      {
        sede: 'Alto Palermo',
        personal: [
          { nombre: 'Juan Ignacio Martinez', email: 'jimartinez@megatlon.com.ar', telefono: '11.3671.0887', rol: 'Coordinador de Venta', privilegio: 'user' },
          { nombre: 'Mariano Espinosa', email: 'mespinosa@megatlon.com.ar', telefono: '11.6915.0927', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // ALTO ROSARIO
      {
        sede: 'Alto Rosario',
        personal: [
          { nombre: 'Alejandro Hornak', email: 'ahornak@megatlon.com.ar', telefono: '341502.3790', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Marcelo Dorigon', email: 'mdorigon@megatlon.com.ar', telefono: '341.384.6203', rol: 'Coordinador de Servicio', privilegio: 'user' }
        ]
      },
      // AÑELO - Sin personal
      {
        sede: 'Añelo',
        personal: []
      },
      // ATENEO
      {
        sede: 'Ateneo',
        personal: [
          { nombre: 'Sergio Canavese', email: 'sergiocanavese@megatlon.com.ar', telefono: '11.5690.3300', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Pablo Spinassi', email: 'pspinassi@megatlon.com.ar', telefono: '11.3699.1454', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Valeria Gonzalez', email: 'vgonzalez@megatlon.com.ar', telefono: '11.4164.2843', rol: 'Coordinador de Servicio', privilegio: 'user' },
          { nombre: 'Laura Ledesma', email: 'mledesma@megatlon.com.ar', telefono: '15.3636.7348', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // BARRACAS
      {
        sede: 'Barracas',
        personal: [
          { nombre: 'Jaqueline Del Vento', email: 'jdelvento@megatlon.com.ar', telefono: '11.4024.6299', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Ariana Gallero', email: 'agallero@megatlon.com.ar', telefono: '11.3921.6317', rol: 'Coordinador de Venta', privilegio: 'user' },
          { nombre: 'Marisa Iglesias', email: 'meiglesias@megatlon.com.ar', telefono: '', rol: 'Coordinador de Servicio', privilegio: 'user' }
        ]
      },
      // BARRIO NORTE
      {
        sede: 'Barrio Norte',
        personal: [
          { nombre: 'Mariano Lantaño', email: 'mlantano@megatlon.com.ar', telefono: '11.03689.4782', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Carina Alvarez', email: 'calvarez@megatlon.com.ar', telefono: '11.3636.7803', rol: 'Coordinador de Servicio', privilegio: 'user' },
          { nombre: 'Diego Pugnali', email: 'dpugnali@megatlon.com.ar', telefono: '11.5995.9134', rol: 'Gerente de Servicio', privilegio: 'user' },
          { nombre: 'Carla Garcia', email: 'cgarcia@megatlon.com.ar', telefono: '11 6928-1367', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // BELGRANO
      {
        sede: 'Belgrano',
        personal: [
          { nombre: 'Sebastian Machado', email: 'smachado@megatlon.com.ar', telefono: '11.5877.6877', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // CABALLITO
      {
        sede: 'Caballito',
        personal: [
          { nombre: 'Fabian Llanos', email: 'fllanos@megatlon.com.ar', telefono: '11.3699.9905', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Federico Apa', email: 'fapa@megatlon.com.ar', telefono: '11.6194.1795', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Gaston Cools', email: 'gcools@megatlon.com.ar', telefono: '11.2279.8395', rol: 'Coordinador de Servicio', privilegio: 'user' },
          { nombre: 'Gustavo Bruno Pedrozo', email: 'gpedrozo@megatlon.com.ar', telefono: '', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // CENTER
      {
        sede: 'Center',
        personal: [
          { nombre: 'Karina Barrera', email: 'kbarrera@megatlon.com.ar', telefono: '11.3923.4486', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Andrea Robledo', email: 'arobledo@megatlon.com.ar', telefono: '11.6532.8816', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // CÓRDOBA BARRIO JARDÍN
      {
        sede: 'Barrio Jardín',
        personal: [
          { nombre: 'Raúl Valdes', email: 'rvaldes@megatlon.com.ar', telefono: '15.3701.5801', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Agustina Rodriguez', email: 'agrodriguez@megatlon.com.ar', telefono: '11.2302.8878', rol: 'Coordinador de Venta', privilegio: 'user' },
          { nombre: 'Marcelo Bahamonde', email: 'mbahamonde@megatlon.com.ar', telefono: '35115629-3207', rol: 'Coordinador de Servicio', privilegio: 'user' },
          { nombre: 'Luciano Carranza', email: 'lcarranza@megatlon.com.ar', telefono: '351.541.2448', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // CÓRDOBA CENTRO
      {
        sede: 'Centro',
        personal: [
          { nombre: 'Julio Altamirano', email: 'jaltamirano@megatlon.com.ar', telefono: '35115220.1494', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // CÓRDOBA CERRO
      {
        sede: 'Cerro',
        personal: [
          { nombre: 'Mariana Sierra', email: 'msierra@megatlon.com.ar', telefono: '351222-8466', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Camila Muñoz', email: 'cmunoz@megatlon.com.ar', telefono: '11.3642.1420', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // DEVOTO
      {
        sede: 'Devoto',
        personal: [
          { nombre: 'Elizabet Palazzo', email: 'epalazzo@megatlon.com.ar', telefono: '11.3699.8508', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Analía Madrid', email: 'fmadrid@megatlon.com.ar', telefono: '11.4147.1740', rol: 'Coordinador de Venta', privilegio: 'user' },
          { nombre: 'Leandro Oddo', email: 'Loddo@megatlon.com.ar', telefono: '11.4927.7165', rol: 'Coordinador de Servicio', privilegio: 'user' }
        ]
      },
      // DISTRITO ARCOS
      {
        sede: 'Distrito Arcos',
        personal: [
          { nombre: 'Marcos Ramirez', email: 'mramirez@megatlon.com.ar', telefono: '11.3906.6806', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Martin Ezequiel Cortez', email: 'mcortez@megatlon.com.ar', telefono: '11.2352.7114', rol: 'Coordinador de Venta', privilegio: 'user' }
        ]
      },
      // DISTRITO TECNOLÓGICO
      {
        sede: 'Distrito Tecnológico',
        personal: [
          { nombre: 'Marcela Regueiro', email: 'mregueiro@megatlon.com.ar', telefono: '11.3699.7201', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Denise Bordon', email: 'dbordon@megatlon.com.ar', telefono: '11 3212-9726', rol: 'Coordinador de Venta', privilegio: 'user' }
        ]
      },
      // FLORESTA
      {
        sede: 'Floresta',
        personal: [
          { nombre: 'Damian Fiorvago', email: 'dfiorvago@megatlon.com.ar', telefono: '11.5346.7426', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Jorge Leguizamon', email: 'jleguizamon@megatlon.com.ar', telefono: '11.4401.1154', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // GONNET
      {
        sede: 'Gonnet',
        personal: [
          { nombre: 'Alejandro Llamas', email: 'allamas@megatlon.com.ar', telefono: '11.2329.3388', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Griselda Ciamberlini', email: 'gciamberlini@megatlon.com.ar', telefono: '11.3598.7791', rol: 'Coordinador de Venta', privilegio: 'user' }
        ]
      },
      // LA IMPRENTA
      {
        sede: 'La Imprenta',
        personal: [
          { nombre: 'Javier Ugo', email: 'javieru@megatlon.com.ar', telefono: '11.3691.7137', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Mercedes Marocchi', email: 'mmarocchi@megatlon.com.ar', telefono: '11.6874.2996', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Alejandro De Nadai', email: 'adenadai@megatlon.com.ar', telefono: '11.3695.2614', rol: 'Gerente de Servicio', privilegio: 'user' },
          { nombre: 'Martin Lavega', email: 'mlavega@megatlon.com.ar', telefono: '15.7026.1295', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // MARTÍNEZ I
      {
        sede: 'Martínez I',
        personal: [
          { nombre: 'Fernando Laso', email: 'flaso@megatlon.com.ar', telefono: '11.3699.7981', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Victoria Bacelar', email: 'mbacelar@megatlon.com.ar', telefono: '', rol: 'Coordinador de Servicio', privilegio: 'user' }
        ]
      },
      // MARTÍNEZ II
      {
        sede: 'Martínez II',
        personal: [
          { nombre: 'Victor Ortiz', email: 'vortiz@megatlon.com.ar', telefono: '11.4915.1218', rol: 'Coordinador de Venta', privilegio: 'user' },
          { nombre: 'Veronica Sanchez', email: 'veronicasanchez@megatlon.com.ar', telefono: '11.2377.6469', rol: 'Gerente de Servicio', privilegio: 'user' }
        ]
      },
      // NÚÑEZ
      {
        sede: 'Núñez',
        personal: [
          { nombre: 'Rosana Mancini', email: 'rosanam@megatlon.com.ar', telefono: '11.4403.4277', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Luciana Navarro', email: 'lnavarro@megatlon.com.ar', telefono: '11.5338.8027', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Juan Pablo Estrella', email: 'jprodriguezestrella@megatlon.com.ar', telefono: '11.3689.8942', rol: 'Gerente de Servicio', privilegio: 'user' },
          { nombre: 'Cristina Dionisi', email: 'cdionisi@megatlon.com.ar', telefono: '11.3909.4617', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // OLIVOS
      {
        sede: 'Olivos',
        personal: [
          { nombre: 'Lucía Saez', email: 'lucias@megatlon.com.ar', telefono: '11.3699.8838', rol: 'Gerente Generalista', privilegio: 'user' }
        ]
      },
      // PILAR
      {
        sede: 'Pilar',
        personal: [
          { nombre: 'Mariano Dominguez', email: 'mdominguez@megatlon.com.ar', telefono: '11.4025.7431', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Mario Vega', email: 'mvega@megatlon.com.ar', telefono: '11.03599.8987', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Nicolás Monacci', email: 'nmonacci@megatlon.com.ar', telefono: '11.4401.4711', rol: 'Coordinador de Servicio', privilegio: 'user' },
          { nombre: 'Jessica Cristina Vargas', email: 'jcvargas@megatlon.com.ar', telefono: '11.2303.3986', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // PUERTO MADERO
      {
        sede: 'Puerto Madero',
        personal: [
          { nombre: 'Mónica Tatare', email: 'mtatare@megatlon.com.ar', telefono: '11.3641.8761', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Cristian Fajardo', email: 'cfajardo@megatlon.com.ar', telefono: '', rol: 'Coordinador de Venta', privilegio: 'user' }
        ]
      },
      // RACING
      {
        sede: 'Racing Club',
        personal: [
          { nombre: 'Javier De Nino', email: 'jdenino@megatlon.com.ar', telefono: '11.5749.6528', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Natalia Nieva', email: 'nnieva@megatlon.com.ar', telefono: '11.2300.7785', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Ezequiel Schneider', email: 'eschneider@megatlon.com.ar', telefono: '', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // RECOLETA
      {
        sede: 'Recoleta',
        personal: [
          { nombre: 'Nicolas Acosta', email: 'nacosta@megatlon.com.ar', telefono: '11.3627.2411', rol: 'Gerente Comercial', privilegio: 'user' },
          { nombre: 'Ezequiel Cappelutti', email: 'ecappelutti@megatlon.com.ar', telefono: '', rol: 'Coordinador de Servicio', privilegio: 'user' }
        ]
      },
      // ROSARIO
      {
        sede: 'Rosario',
        personal: [
          { nombre: 'Alejandro Mengarelli', email: 'amengarelli@megatlon.com.ar', telefono: '341.15389.7946', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Andres Lugli', email: 'alugli@megatlon.com.ar', telefono: '0341.383.3711', rol: 'Coordinador de Venta', privilegio: 'user' },
          { nombre: 'Nicolas Agri', email: 'nagri@megatlon.com.ar', telefono: '341.668.6523', rol: 'Gerente de Servicio', privilegio: 'user' },
          { nombre: 'Sofia Zabala', email: 'szabala@megatlon.com.ar', telefono: '341.388.7990', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      },
      // VILLA CRESPO
      {
        sede: 'Villa Crespo',
        personal: [
          { nombre: 'Fabian Jigena', email: 'fjigena@megatlon.com.ar', telefono: '11.6924.2210', rol: 'Gerente Generalista', privilegio: 'user' },
          { nombre: 'Ailin Olivieri', email: 'aolivieri@megatlon.com.ar', telefono: '11.2278.3814', rol: 'Coordinador de Servicio', privilegio: 'user' },
          { nombre: 'Matias Rey', email: 'mrey@megatlon.com.ar', telefono: '15.3636.6880', rol: 'Coordinador de Pileta', privilegio: 'user' }
        ]
      }
    ];

    // Helper function to split nombre completo into nombre y apellido
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

    // Preparar datos para inserción en tabla personal
    const personalToInsert = [];

    for (const sedeData of personalData) {
      const sedeId = sedesMap[sedeData.sede];

      if (!sedeId) {
        console.warn(`Advertencia: Sede "${sedeData.sede}" no encontrada en la BD`);
        continue;
      }

      for (const person of sedeData.personal) {
        const rolId = rolesMap[person.rol];

        if (!rolId) {
          throw new Error(`Rol "${person.rol}" no encontrado en la BD`);
        }

        const { nombre, apellido } = splitNombreCompleto(person.nombre);

        personalToInsert.push({
          id: uuidv4(),
          nombre: nombre,
          apellido: apellido,
          email: person.email,
          telefono: person.telefono || null,
          sede_id: sedeId,
          rol_id: rolId,
          privilegio_app: person.privilegio,
          activo: true,
          fecha_ingreso: new Date().toISOString().split('T')[0],
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    if (personalToInsert.length > 0) {
      await queryInterface.bulkInsert('personal', personalToInsert);
      console.log(`✅ ${personalToInsert.length} personas cargadas exitosamente`);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Solo eliminar personal de Megatlon
    const megatlonSedesQuery = `
      SELECT p.id FROM personal p
      INNER JOIN sedes s ON p.sede_id = s.id
      WHERE s.empresa_id = (SELECT id FROM empresas WHERE nombre_empresa = 'Megatlon')
    `;

    const personalIds = await queryInterface.sequelize.query(megatlonSedesQuery, {
      type: queryInterface.sequelize.QueryTypes.SELECT
    });

    if (personalIds.length > 0) {
      const ids = personalIds.map(p => p.id);
      await queryInterface.sequelize.query(
        `DELETE FROM personal WHERE id IN ('${ids.join("','")}')`,
        { type: queryInterface.sequelize.QueryTypes.DELETE }
      );
    }
  }
};
