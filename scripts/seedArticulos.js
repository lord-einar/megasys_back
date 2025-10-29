#!/usr/bin/env node

/**
 * Script para insertar artículos de ejemplo
 */

require('dotenv').config();
const { sequelize } = require('../src/shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    const { Inventario, TipoArticulo, Sede } = require('../src/models');

    // Obtener Depósito y tipos
    const deposito = await Sede.findOne({ where: { nombre_sede: 'Depósito' } });
    const tipos = await TipoArticulo.findAll({ where: { activo: true } });

    if (!deposito) {
      console.error('❌ Sede Depósito no encontrada');
      process.exit(1);
    }

    const tipoMap = {};
    tipos.forEach(t => {
      tipoMap[t.nombre] = t.id;
    });

    const articulos = [
      {
        tipo_articulo_id: tipoMap['PC'],
        marca: 'Dell',
        modelo: 'OptiPlex 7090',
        numero_serie: 'SN-2025-001',
        service_tag: 'ST-DEL-001',
        sede_id: deposito.id,
        estado: 'disponible'
      },
      {
        tipo_articulo_id: tipoMap['Notebooks'],
        marca: 'Lenovo',
        modelo: 'ThinkPad X1 Carbon',
        numero_serie: 'SN-2025-002',
        service_tag: 'ST-LEN-001',
        sede_id: deposito.id,
        estado: 'disponible'
      },
      {
        tipo_articulo_id: tipoMap['Teléfonos IP'],
        marca: 'Cisco',
        modelo: 'IP Phone 7960',
        numero_serie: 'SN-2025-003',
        service_tag: 'ST-CIS-001',
        sede_id: deposito.id,
        estado: 'disponible'
      },
      {
        tipo_articulo_id: tipoMap['Periféricos'],
        marca: 'Logitech',
        modelo: 'MX Master 3',
        numero_serie: 'SN-2025-004',
        service_tag: 'ST-LOG-001',
        sede_id: deposito.id,
        estado: 'disponible'
      }
    ];

    console.log('\n📦 Creando artículos de ejemplo...');
    for (const art of articulos) {
      try {
        await Inventario.create(art);
        console.log(`✅ Artículo creado: ${art.marca} ${art.modelo}`);
      } catch (err) {
        console.error(`❌ Error creando ${art.marca} ${art.modelo}:`, err.message);
      }
    }

    console.log('\n✅ Seed completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar seed:', error.message);
    process.exit(1);
  }
};

seedData();
