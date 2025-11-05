'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { v4: uuidv4 } = require('uuid');

    // Obtener IDs de ambas empresas
    const empresas = await queryInterface.sequelize.query(
      "SELECT id, nombre_empresa FROM empresas WHERE nombre_empresa IN ('Megatlon', 'Fiter') ORDER BY nombre_empresa",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (empresas.length < 2) {
      throw new Error('Empresas Megatlon y/o Fiter no encontradas. Ejecuta primero el seeder de empresas.');
    }

    const megatlonId = empresas.find(e => e.nombre_empresa === 'Megatlon').id;
    const fiterId = empresas.find(e => e.nombre_empresa === 'Fiter').id;

    // Sedes Megatlon
    const sedesMegatlon = [
      { nombre_sede: 'Alcorta', direccion: 'J. Salguero 3172', localidad: 'CABA', provincia: 'CABA', telefono: '4805-1312', ip_sede: '192.168.128.0' },
      { nombre_sede: 'Almagro', direccion: 'Humahuaca 3850', localidad: 'CABA', provincia: 'CABA', telefono: '4862-7925', ip_sede: '192.168.103.0' },
      { nombre_sede: 'Alto Palermo', direccion: 'Arenales 3370', localidad: 'CABA', provincia: 'CABA', telefono: '4821-6811', ip_sede: '192.168.114.0' },
      { nombre_sede: 'Ateneo', direccion: 'Riobamba 165', localidad: 'CABA', provincia: 'CABA', telefono: '4372-1106', ip_sede: '192.168.111.0' },
      { nombre_sede: 'Barracas', direccion: 'Iriarte 2056', localidad: 'CABA', provincia: 'CABA', telefono: '4301-4327', ip_sede: '192.168.130.0' },
      { nombre_sede: 'Barrio Norte', direccion: 'Rodríguez Peña 1062', localidad: 'CABA', provincia: 'CABA', telefono: '11 6841-1909', ip_sede: '192.168.106.0' },
      { nombre_sede: 'Belgrano', direccion: 'Vuelta de Obligado 2250', localidad: 'CABA', provincia: 'CABA', telefono: '4784-6635', ip_sede: '192.168.112.0' },
      { nombre_sede: 'Caballito', direccion: 'Yerbal 854', localidad: 'CABA', provincia: 'CABA', telefono: '4431-9201', ip_sede: '192.168.130.0' },
      { nombre_sede: 'Center', direccion: 'Reconquista 335', localidad: 'CABA', provincia: 'CABA', telefono: '4322-7690', ip_sede: '192.168.109.0' },
      { nombre_sede: 'Devoto', direccion: 'Av. Fco. Beiró 5175', localidad: 'CABA', provincia: 'CABA', telefono: '4566-7231', ip_sede: '192.168.105.0' },
      { nombre_sede: 'Distrito Arcos', direccion: 'Godoy Cruz 2626', localidad: 'CABA', provincia: 'CABA', telefono: '2078-5400', ip_sede: '192.168.133.0' },
      { nombre_sede: 'Distrito Tecnológico', direccion: 'Av. Caseros 3039', localidad: 'CABA', provincia: 'CABA', telefono: '2120-3100', ip_sede: '192.168.141.0' },
      { nombre_sede: 'Floresta', direccion: 'Av. Jonte 4180', localidad: 'CABA', provincia: 'CABA', telefono: '4639-8236', ip_sede: '192.168.102.0' },
      { nombre_sede: 'La Imprenta', direccion: 'Migueletes 1023', localidad: 'CABA', provincia: 'CABA', telefono: '4777-1573', ip_sede: '192.168.104.0' },
      { nombre_sede: 'Núñez', direccion: 'Av. Libertador 8000', localidad: 'CABA', provincia: 'CABA', telefono: '4702-1193', ip_sede: '192.168.123.0' },
      { nombre_sede: 'Puerto Madero', direccion: 'Alicia Moreau de Justo 1600', localidad: 'CABA', provincia: 'CABA', telefono: '4342-6818', ip_sede: '192.168.129.0' },
      { nombre_sede: 'Recoleta', direccion: 'Arenales 1930', localidad: 'CABA', provincia: 'CABA', telefono: '4811-2565', ip_sede: '192.168.115.0' },
      { nombre_sede: 'Villa Crespo', direccion: 'Juan B. Justo 2650', localidad: 'CABA', provincia: 'CABA', telefono: '4854-0595', ip_sede: '192.168.108.0' },
      { nombre_sede: 'Gonnet', direccion: 'Camino Parque Centenario 4000', localidad: 'La Plata', provincia: 'Buenos Aires', telefono: '0221-484-6160', ip_sede: '192.168.131.0' },
      { nombre_sede: 'Martínez I', direccion: 'Gral. Alvear 1136', localidad: 'Martínez', provincia: 'Buenos Aires', telefono: '6196-3308', ip_sede: '192.168.120.0' },
      { nombre_sede: 'Martínez II', direccion: 'Arenales 1815', localidad: 'Martínez', provincia: 'Buenos Aires', telefono: '4733-3006', ip_sede: '192.168.140.0' },
      { nombre_sede: 'Olivos', direccion: 'Av. Libertador 2421', localidad: 'Olivos', provincia: 'Buenos Aires', telefono: '2078-5300', ip_sede: '192.168.135.0' },
      { nombre_sede: 'Pilar', direccion: 'Panamericana Km 49,5', localidad: 'Pilar', provincia: 'Buenos Aires', telefono: '0230-438-4111', ip_sede: '192.168.125.0' },
      { nombre_sede: 'Racing Club', direccion: 'Av. Mitre 934', localidad: 'Avellaneda', provincia: 'Buenos Aires', telefono: '6841-1906', ip_sede: '192.168.113.0' },
      { nombre_sede: 'Barrio Jardín', direccion: 'Av. Elías Yofre 800', localidad: 'Córdoba', provincia: 'Córdoba', telefono: '0351-570-7474', ip_sede: '192.168.137.0' },
      { nombre_sede: 'Centro', direccion: 'Av. Gral. Paz 195', localidad: 'Córdoba', provincia: 'Córdoba', telefono: '0351-570-7484', ip_sede: '192.168.138.0' },
      { nombre_sede: 'Cerro', direccion: 'José Otero 1430', localidad: 'Córdoba', provincia: 'Córdoba', telefono: '0351-570-7464', ip_sede: '192.168.139.0' },
      { nombre_sede: 'Alto Rosario', direccion: 'Junín 501 (Shopping Alto Rosario)', localidad: 'Rosario', provincia: 'Santa Fe', telefono: '0341-528-3190', ip_sede: '192.168.136.0' },
      { nombre_sede: 'Rosario', direccion: 'Tucumán 1239', localidad: 'Rosario', provincia: 'Santa Fe', telefono: '0341-528-2703', ip_sede: '192.168.124.0' },
      { nombre_sede: 'Añelo', direccion: 'Complejo Hally', localidad: 'Añelo', provincia: 'Neuquén', telefono: '11 5618 2921', ip_sede: '192.168.143.0' }
    ];

    // Sedes Fiter
    const sedesFiter = [
      { nombre_sede: 'Fiter Abasto', direccion: 'Av. Corrientes 3234', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.203.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Adrogué', direccion: 'Seguí 675', localidad: 'Adrogué', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.210.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Almagro', direccion: 'Castro Barros 148', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.205.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Almagro 2', direccion: 'Av. Medrano 976', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: null, pais: 'Argentina' },
      { nombre_sede: 'Fiter Barrio Norte', direccion: 'Mansilla 2929', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.202.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Caballito', direccion: 'Rosario 744', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.204.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Caballito 2', direccion: 'Av. Acoyte 54', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.219.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Caballito 3', direccion: 'Av. Rivadavia 4475', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.215.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Cid Campeador', direccion: 'Franklin 710', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 4982-4666', ip_sede: '10.213.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Congreso', direccion: 'Pasco 48', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.212.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Flores', direccion: 'Lautaro 71', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.206.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Hollywood', direccion: 'Humboldt 1575', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.208.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Lomas', direccion: 'Av. Meeks 250', localidad: 'Lomas de Zamora', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.220.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Microcentro', direccion: 'Lavalle 828', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.207.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Núñez', direccion: 'Miguel B. Sánchez 1013', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.209.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Palermo', direccion: 'Humboldt 2439', localidad: 'CABA', provincia: 'Buenos Aires', telefono: '011 2120-1400', ip_sede: '10.216.0.0', pais: 'Argentina' },
      { nombre_sede: 'Fiter Punta Carretas', direccion: '21 de Setiembre 2724', localidad: 'Montevideo', provincia: 'Montevideo', telefono: '+598 95 080 875', ip_sede: '10.102.0.0', pais: 'Uruguay' },
      { nombre_sede: 'Fiter Buceo', direccion: 'Rivera 3434', localidad: 'Montevideo', provincia: 'Montevideo', telefono: '+598 94 563 314', ip_sede: '10.103.0.0', pais: 'Uruguay' },
      { nombre_sede: 'Fiter Maldonado', direccion: 'Cecilia Burgueño (entre Sarandí y 18 de Julio)', localidad: 'Maldonado', provincia: 'Maldonado', telefono: '+598 95 447 516', ip_sede: '10.104.0.0', pais: 'Uruguay' }
    ];

    // Preparar sedes para inserción
    const sedesToInsert = [
      ...sedesMegatlon.map(sede => ({
        id: uuidv4(),
        empresa_id: megatlonId,
        nombre_sede: sede.nombre_sede,
        direccion: sede.direccion,
        localidad: sede.localidad,
        provincia: sede.provincia,
        pais: 'Argentina',
        telefono: sede.telefono,
        ip_sede: sede.ip_sede,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      })),
      ...sedesFiter.map(sede => ({
        id: uuidv4(),
        empresa_id: fiterId,
        nombre_sede: sede.nombre_sede,
        direccion: sede.direccion,
        localidad: sede.localidad,
        provincia: sede.provincia,
        pais: sede.pais,
        telefono: sede.telefono,
        ip_sede: sede.ip_sede,
        activo: true,
        created_at: new Date(),
        updated_at: new Date()
      }))
    ];

    await queryInterface.bulkInsert('sedes', sedesToInsert);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('sedes', null, {});
  }
};
