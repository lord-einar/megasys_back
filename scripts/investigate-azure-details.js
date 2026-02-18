import 'dotenv/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import { msalConfig } from '../src/modules/auth/config/msalConfig.js';
import { sequelize, Personal, Sede } from '../src/models/index.js';
import { Op } from 'sequelize';

async function investigateAzureDetails() {
    console.log('🕵️ Iniciando investigación profunda de datos Azure...');

    try {
        await sequelize.authenticate();

        // 1. Obtener Token
        const cca = new ConfidentialClientApplication(msalConfig);
        const tokenResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
        const accessToken = tokenResponse.accessToken;

        // 2. Obtener Grupos y Miembros
        console.log('☁️  Analizando grupos y membresías...');
        const groupsUrl = "https://graph.microsoft.com/v1.0/groups?$filter=startswith(displayName,'Megacore_')&$select=id,displayName";
        const groupsResponse = await axios.get(groupsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const targetGroups = groupsResponse.data.value.filter(g => g.displayName.endsWith('_Gerentes'));

        const userMap = new Map(); // email -> { groups: [], azureData: {} }

        for (const group of targetGroups) {
            const membersUrl = `https://graph.microsoft.com/v1.0/groups/${group.id}/members?$select=id,displayName,mail,jobTitle,officeLocation,department,city,usageLocation,streetAddress,state`;
            const membersResponse = await axios.get(membersUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

            for (const member of membersResponse.data.value) {
                if (!member.mail) continue;
                const email = member.mail.toLowerCase();

                if (!userMap.has(email)) {
                    userMap.set(email, {
                        groups: [],
                        azureData: member
                    });
                }
                userMap.get(email).groups.push(group.displayName);
            }
        }

        // 3. Analizar Multi-Grupos
        console.log('\n🔍 --- USUARIOS EN MÚLTIPLES GRUPOS ---');
        const multiGroupUsers = Array.from(userMap.values()).filter(u => u.groups.length > 1);

        if (multiGroupUsers.length === 0) {
            console.log('✅ Ningún usuario pertenece a más de un grupo de Gerentes.');
        } else {
            multiGroupUsers.forEach(u => {
                console.log(`👤 ${u.azureData.mail} (${u.groups.length} grupos):`);
                u.groups.forEach(g => console.log(`   - ${g}`));
            });
        }

        // 4. Analizar Atributos de Sede (Buscando "Central" u otros)
        console.log('\n🔍 --- ANÁLISIS DE ATRIBUTOS (Muestreo) ---');
        console.log('Revisando campos: officeLocation, department, city, streetAddress...');

        // Filtramos usuarios que tengan algo en esos campos
        const interestingUsers = Array.from(userMap.values()).filter(u =>
            u.azureData.officeLocation || u.azureData.department || u.azureData.city
        ).slice(0, 10); // Muestra top 10

        interestingUsers.forEach(u => {
            const d = u.azureData;
            console.log(`\n👤 ${d.mail}`);
            console.log(`   JobTitle: ${d.jobTitle}`);
            console.log(`   Office: ${d.officeLocation || 'N/A'}`);
            console.log(`   Dept: ${d.department || 'N/A'}`);
            console.log(`   City: ${d.city || 'N/A'}`);
        });

        // 5. Ver Sedes de los 22 Usuarios "Solo Local"
        console.log('\n🔍 --- SEDE ASIGNADA LOCALMENTE (Usuarios específicos) ---');
        const specificEmails = [
            'cboldrini@fiter.com.ar', 'ccernuda@megatlon.com.ar', 'cmolinari@megatlon.com.ar',
            'dmolina@megatlon.com.ar', 'egagliardo@megatlon.com.ar', 'fabianmarquez@megatlon.com.ar',
            'feggerstorfer@megatlon.com.ar', 'ggalceran@megatlon.com.ar', 'glesta@megatlon.com.ar',
            'jserafin@megatlon.com.ar', 'lalbornoz@megatlon.com.ar', 'ltorrealba@fiter.com.ar',
            'ltorrealba@megatlon.com.ar', 'mcpaez@megatlon.com.ar', 'mgambin@megatlon.com.ar',
            'mleon@megatlon.com.ar', 'mpippo@megatlon.com.ar', 'mzarza@megatlon.com.ar',
            'nantenucci@megtalon.com.ar', 'nburis@megatlon.com.ar', 'qferreyra@megatlon.com.ar',
            'rmancini@megatlon.com.ar'
        ];

        const localUsers = await Personal.findAll({
            where: { email: { [Op.in]: specificEmails } },
            include: [{ model: Sede, as: 'sede', attributes: ['nombre_sede'] }]
        });

        localUsers.forEach(u => {
            const sede = u.sede ? u.sede.nombre_sede : 'SIN SEDE';
            const groups = userMap.get(u.email)?.groups.join(', ') || 'NO EN AZURE (Actual)';
            const isActive = u.activo ? 'ACTIVO' : 'INACTIVO';
            console.log(`${u.email.padEnd(30)} | Sede: ${sede.padEnd(20)} | ${isActive} | Grupos: ${groups}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sequelize.close();
    }
}

investigateAzureDetails();
