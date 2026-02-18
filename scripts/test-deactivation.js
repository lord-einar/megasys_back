import 'dotenv/config';
import entraSyncService from '../src/modules/personal/services/entraSyncService.js';
import { sequelize } from '../src/shared/utils/database.js';
import Personal from '../src/models/Personal.js';
import { Op } from 'sequelize';

async function testDeactivation() {
    console.log('🧪 Iniciando prueba de Baja de Usuarios...');
    try {
        await sequelize.authenticate();

        // 1. Ejecutar Sincronización
        console.log('🔄 Ejecutando syncGerentes()...');
        const result = await entraSyncService.syncGerentes();
        console.log('📊 Resultado sync:', result.stats);

        // 2. Verificar Usuarios Deshabilitados Específicos
        const emailsToCheck = [
            'jserafin@megatlon.com.ar',
            'lalbornoz@megatlon.com.ar',
            'qferreyra@megatlon.com.ar',
            'mpippo@megatlon.com.ar',
            'dmolina@megatlon.com.ar',
            'nantenucci@megtalon.com.ar',
            'ccernuda@megatlon.com.ar'
        ];

        console.log('\n--- VERIFICACIÓN DE ESTADO EN DB ---');
        const users = await Personal.findAll({
            where: { email: { [Op.in]: emailsToCheck } },
            attributes: ['email', 'activo']
        });

        let allDeactivated = true;
        users.forEach(u => {
            console.log(`User: ${u.email.padEnd(30)} | Activo: ${u.activo}`);
            if (u.activo) allDeactivated = false;
        });

        if (allDeactivated && users.length > 0) {
            console.log('\n✅ ÉXITO: Todos los usuarios objetivo fueron desactivados.');
        } else {
            console.log('\n⚠️ ADVERTENCIA: Algunos usuarios permanecen activos.');
        }

    } catch (error) {
        console.error('❌ Error en la prueba:', error);
    } finally {
        await sequelize.close();
    }
}

testDeactivation();
