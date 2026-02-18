import 'dotenv/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import { msalConfig } from '../src/modules/auth/config/msalConfig.js';
import { sequelize } from '../src/shared/utils/database.js';

async function analyzeJobTitles() {
    console.log('🔍 Analizando JobTitles en Azure...');

    try {
        await sequelize.authenticate();

        const cca = new ConfidentialClientApplication(msalConfig);
        const tokenResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
        const accessToken = tokenResponse.accessToken;

        const groupsUrl = "https://graph.microsoft.com/v1.0/groups?$filter=startswith(displayName,'Megacore_')&$select=id,displayName";
        const groupsResponse = await axios.get(groupsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const targetGroups = groupsResponse.data.value.filter(g => g.displayName.endsWith('_Gerentes'));

        const titles = new Set();
        const userTitles = []; // { email, jobTitle }

        console.log(`📡 Procesando ${targetGroups.length} grupos...`);

        for (const group of targetGroups) {
            const membersUrl = `https://graph.microsoft.com/v1.0/groups/${group.id}/members?$select=id,mail,jobTitle`;
            const membersResponse = await axios.get(membersUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

            for (const member of membersResponse.data.value) {
                if (!member.mail) continue;
                const title = member.jobTitle ? member.jobTitle.trim() : '(Sin Título)';
                titles.add(title);
                userTitles.push({ email: member.mail, title });
            }
        }

        console.log('\n📋 LISTADO DE JOB TITLES ÚNICOS ENCONTRADOS:');
        console.log('='.repeat(50));
        Array.from(titles).sort().forEach(t => console.log(`- ${t}`));
        console.log('='.repeat(50));
        console.log(`Total usuarios procesados: ${userTitles.length}`);
        console.log(`Total títulos unicos: ${titles.size}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sequelize.close();
    }
}

analyzeJobTitles();
