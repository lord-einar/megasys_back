#!/usr/bin/env node

/**
 * Script para insertar datos iniciales de Inventario
 * Crea la sede "Depósito" y los tipos de artículos
 */

require('dotenv').config();
const { sequelize } = require('../src/shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // Obtener los modelos
    const { Sede, TipoArticulo, Empresa } = require('../src/models');

    // 1. Obtener o crear empresa (usamos la primera que encuentre o creamos una)
    let empresa = await Empresa.findOne({ where: { activo: true } });

    if (!empresa) {
      console.log('⚠️  No se encontró empresa activa. Creando una...');
      empresa = await Empresa.create({
        nombre: 'Empresa Principal',
        razon_social: 'Empresa Principal S.A.',
        cuit: '00000000000',
        email: 'info@empresa.com',
        telefono: '+54 11 0000-0000',
        direccion: 'Calle Principal 123',
        activo: true
      });
      console.log('✅ Empresa creada:', empresa.nombre);
    }

    // 2. Crear la sede "Depósito"
    const sedeDepositoData = {
      id: uuidv4(),
      nombre_sede: 'Depósito',
      direccion: 'Juan Diaz de Solis 1851',
      localidad: 'Vicente Lopez',
      provincia: 'Buenos Aires',
      pais: 'Argentina',
      codigo_postal: '1638',
      ip_red: '192.168.101.0',
      empresa_id: empresa.id,
      activo: true
    };

    let sedeDeposito = await Sede.findOne({
      where: { nombre_sede: 'Depósito', activo: true }
    });

    if (sedeDeposito) {
      console.log('✅ Sede "Depósito" ya existe:', sedeDeposito.id);
    } else {
      sedeDeposito = await Sede.create(sedeDepositoData);
      console.log('✅ Sede "Depósito" creada:', sedeDeposito.id);
      console.log('   Dirección:', sedeDeposito.direccion);
      console.log('   IP Red:', sedeDeposito.ip_red);
    }

    // 3. Crear tipos de artículos
    const tiposArticulos = [
      { nombre: 'PC', descripcion: 'Computadoras de escritorio' },
      { nombre: 'Notebooks', descripcion: 'Laptops y computadoras portátiles' },
      { nombre: 'Monitores', descripcion: 'Pantallas de computadora' },
      { nombre: 'Teléfonos IP', descripcion: 'Teléfonos de red VoIP' },
      { nombre: 'Impresoras', descripcion: 'Impresoras y multifuncionales' },
      { nombre: 'NVR', descripcion: 'Equipos de grabación de video' },
      { nombre: 'Cámaras', descripcion: 'Cámaras de seguridad y vigilancia' },
      { nombre: 'Periféricos', descripcion: 'Periféricos de computadora (mouse, teclado, etc.)' }
    ];

    console.log('\n📦 Creando tipos de artículos...');
    for (const tipo of tiposArticulos) {
      const existe = await TipoArticulo.findOne({
        where: { nombre: tipo.nombre, activo: true }
      });

      if (existe) {
        console.log(`✅ Tipo "${tipo.nombre}" ya existe`);
      } else {
        await TipoArticulo.create({
          id: uuidv4(),
          nombre: tipo.nombre,
          descripcion: tipo.descripcion,
          activo: true
        });
        console.log(`✅ Tipo "${tipo.nombre}" creado`);
      }
    }

    console.log('\n✅ Seed completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar seed:', error.message);
    if (error.errors) {
      error.errors.forEach(e => console.error(`   - ${e.message}`));
    }
    process.exit(1);
  }
};

seedData();
