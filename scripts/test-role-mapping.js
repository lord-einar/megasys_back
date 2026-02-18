import 'dotenv/config';
import entraSyncService from '../src/modules/personal/services/entraSyncService.js';
import { sequelize } from '../src/shared/utils/database.js';
import Personal from '../src/models/Personal.js';
import Rol from '../src/models/Rol.js';
import { Op } from 'sequelize';

async function testRoleMapping() {
    console.log('🧪 Iniciando prueba de Mapeo de Roles...');
    try {
        await sequelize.authenticate();

        // 1. Ejecutar Sincronización
        console.log('🔄 Ejecutando syncGerentes()...');
        const result = await entraSyncService.syncGerentes();
        console.log('📊 Resultado sync:', result.stats);

        // 2. Verificar Mapeos Clave
        console.log('\n--- VERIFICACIÓN DE ROLES ---');

        const roles = await Rol.findAll();
        const roleMap = {};
        roles.forEach(r => roleMap[r.id] = r.nombre);

        // Muestreo de usuarios para ver qué rol se les asignó
        // Buscamos usuarios con ciertos emails conocidos o al azar
        const personal = await Personal.findAll({
            where: { activo: true },
            limit: 20,
            // order: [['updatedAt', 'DESC']]
        });

        console.log('Email'.padEnd(35) + ' | ' + 'Rol Asignado');
        console.log('-'.repeat(60));

        personal.forEach(p => {
            const rolName = roleMap[p.rol_id] || 'DESCONOCIDO';
            console.log(`${p.email.padEnd(35)} | ${rolName}`);
        });

    } catch (error) {
        console.error('❌ Error en la prueba:', error);
    } finally {
        await sequelize.close();
    }
}

testRoleMapping();
