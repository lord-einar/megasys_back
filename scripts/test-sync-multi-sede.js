import 'dotenv/config';
import entraSyncService from '../src/modules/personal/services/entraSyncService.js';
import { sequelize, Personal, Sede } from '../src/models/index.js';

async function testSyncFull() {
    console.log('🧪 Iniciando prueba INTEGRAL de Sincronización (Sedes, Multi-Sede, Roles, Bajas)...');
    try {
        await sequelize.authenticate();

        // 1. Ejecutar Sincronización
        console.log('🔄 Ejecutando syncGerentes()...');
        const result = await entraSyncService.syncGerentes();
        console.log('📊 Resultado sync:', result.stats);

        // 2. Verificaciones Específicas
        console.log('\n--- VERIFICACIÓN DE CASOS DE USO ---');

        const checkUser = async (email, expectedSedeName, expectedActive, description) => {
            const user = await Personal.findOne({
                where: { email },
                include: [{ model: Sede, as: 'sede' }]
            });

            const sedeName = user?.sede?.nombre_sede || 'NULL';
            const active = user?.activo;

            let status = '✅ OK';
            if (expectedSedeName === 'NULL') {
                if (user.sede_id !== null) status = '❌ FALLO (Esperaba NULL)';
            } else {
                if (sedeName !== expectedSedeName) status = `❌ FALLO (Esperaba ${expectedSedeName})`;
            }

            if (expectedActive !== undefined && active !== expectedActive) {
                status = `❌ FALLO ACTIVIDAD (Esperaba ${expectedActive})`;
            }

            console.log(`User: ${email.padEnd(30)} | Sede: ${sedeName.padEnd(20)} | Activo: ${active} | ${description} -> ${status}`);
        };

        // Casos de prueba basados en investigación previa
        await checkUser('mgambin@megatlon.com.ar', 'NULL', true, 'Multi-Sede (22 grupos) debe ser NULL');
        await checkUser('cboldrini@fiter.com.ar', 'NULL', true, 'Multi-Sede Fiter (13 grupos) debe ser NULL');
        await checkUser('ximenas@megatlon.com.ar', 'NULL', true, 'Regional (11 grupos) debe ser NULL');

        await checkUser('ggalceran@megatlon.com.ar', 'Barracas', true, 'Single-Sede (Barracas)');
        await checkUser('mzarza@megatlon.com.ar', 'Caballito', true, 'Single-Sede (Caballito)');

        await checkUser('jserafin@megatlon.com.ar', 'Alcorta', false, 'Inactivo (Baja)'); // Nota: Inactivos MANTIENEN su última sede conocida o la que viene del grupo si aun estan? 
        // Si jserafin está en "MegaCore_Alcorta_Gerentes" peeeero accountEnabled=false, 
        // el código actual processedEmails.add(email) y luego update({activo:false}).
        // PERO NO ACTUALIZA LA SEDE si entra en el if(accountEnabled===false). 
        // Asi que mantiene la que tenía. Correcto.

    } catch (error) {
        console.error('❌ Error en la prueba:', error);
    } finally {
        await sequelize.close();
    }
}

testSyncFull();
