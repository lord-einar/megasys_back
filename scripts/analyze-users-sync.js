import 'dotenv/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import { Op } from 'sequelize';
import { msalConfig } from '../src/modules/auth/config/msalConfig.js';
import Personal from '../src/models/Personal.js';
import Rol from '../src/models/Rol.js';
import { sequelize } from '../src/shared/utils/database.js';

async function analyzeUsersSync() {
    console.log('🔍 Iniciando Análisis de Usuarios (Azure <-> Local DB)...');

    try {
        await sequelize.authenticate();

        // 1. Obtener Token
        const cca = new ConfidentialClientApplication(msalConfig);
        const tokenResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
        const accessToken = tokenResponse.accessToken;

        // 2. Obtener Usuarios Azure (de los grupos de Gerentes)
        console.log('☁️  Obteniendo usuarios de Azure...');
        const groupsUrl = "https://graph.microsoft.com/v1.0/groups?$filter=startswith(displayName,'Megacore_')&$select=id,displayName";
        const groupsResponse = await axios.get(groupsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const azureGroups = groupsResponse.data.value.filter(g => g.displayName.endsWith('_Gerentes'));

        const azureUsersMap = new Map(); // Map<email, userObject>

        for (const group of azureGroups) {
            const membersUrl = `https://graph.microsoft.com/v1.0/groups/${group.id}/members?$select=id,displayName,givenName,surname,mail,accountEnabled`;
            const membersResponse = await axios.get(membersUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

            for (const member of membersResponse.data.value) {
                if (!member.mail) continue;
                const email = member.mail.toLowerCase();

                // Guardamos el usuario. Si aparece en múltiples grupos, no importa, es el mismo user.
                // Nos interesa su estado global (aunque accountEnabled es por usuario).
                azureUsersMap.set(email, {
                    displayName: member.displayName,
                    givenName: member.givenName,
                    surname: member.surname,
                    accountEnabled: member.accountEnabled,
                    groups: (azureUsersMap.get(email)?.groups || []).concat(group.displayName)
                });
            }
        }
        console.log(`   -> Encontrados ${azureUsersMap.size} usuarios únicos en grupos de Azure.\n`);

        // 3. Obtener Gerentes Locales
        const gerenteRol = await Rol.findOne({ where: { nombre: 'Gerentes' } });
        if (!gerenteRol) throw new Error("Rol 'Gerentes' no encontrado localmente.");

        console.log('💾 Obteniendo Gerentes locales...');
        const localPersonal = await Personal.findAll({
            where: { rol_id: gerenteRol.id },
            attributes: ['id', 'email', 'nombre', 'apellido', 'activo']
        });
        console.log(`   -> Encontrados ${localPersonal.length} gerentes en base de datos.\n`);

        // 4. Analizar Concordancia
        console.log('🔄 Analizando datos...');

        let nameMismatches = 0;
        let azureDisabled = 0;
        let localOnly = 0;
        let azureOnly = 0;
        let perfectMatch = 0;

        console.log('\n--- DIFERENCIAS DE NOMBRES (Azure vs Local) ---');
        for (const [email, azureUser] of azureUsersMap) {
            const localUser = localPersonal.find(p => p.email.toLowerCase() === email);

            if (localUser) {
                // Comparar Nombres
                // Azure a veces tiene el nombre completo en displayName o en parts
                const azGiven = (azureUser.givenName || '').trim();
                const azSur = (azureUser.surname || '').trim();
                const locNombre = localUser.nombre.trim();
                const locApellido = localUser.apellido.trim();

                const matchNombre = azGiven.toLowerCase() === locNombre.toLowerCase();
                const matchApellido = azSur.toLowerCase() === locApellido.toLowerCase();

                if (!matchNombre || !matchApellido) {
                    nameMismatches++;
                    console.log(`❌ [Names Diff] ${email}`);
                    console.log(`   Azure: "${azGiven}" "${azSur}"`);
                    console.log(`   Local: "${locNombre}" "${locApellido}"`);
                } else {
                    perfectMatch++;
                }

                // Check Disabled status
                if (azureUser.accountEnabled === false) {
                    azureDisabled++;
                    console.log(`🚫 [Azure Disabled] ${email} -> Local está: ${localUser.activo ? 'ACTIVO (Se debe desactivar)' : 'Inactivo (Correcto)'}`);
                }

            } else {
                azureOnly++;
                // console.log(`🆕 [Solo Azure] ${email} (Se creará)`);
            }
        }

        console.log('\n--- SOLO EN LOCAL (Posibles Bajas) ---');
        localPersonal.forEach(p => {
            if (!azureUsersMap.has(p.email.toLowerCase())) {
                localOnly++;
                console.log(`⚠️  [Solo Local] ${p.email} - Activo: ${p.activo}`);
            }
        });


        // Resumen
        console.log('\n📊 RESUMEN FINAL:');
        console.log(`   ✅ Nombres Coincidentes (100%): ${perfectMatch}`);
        console.log(`   ❌ Nombres Diferentes: ${nameMismatches}`);
        console.log(`   🚫 Deshabilitados en Azure: ${azureDisabled}`);
        console.log(`   🆕 Solo en Azure (Nuevos): ${azureOnly}`);
        console.log(`   🗑️ Solo en Local (Posibles Bajas): ${localOnly}`);

    } catch (error) {
        console.error('❌ Error en el análisis:', error);
    } finally {
        await sequelize.close();
    }
}

analyzeUsersSync();
