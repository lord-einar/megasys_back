import 'dotenv/config';
import { sequelize } from '../src/shared/utils/database.js';
import Personal from '../src/models/Personal.js';

async function listUsers() {
    try {
        await sequelize.authenticate();
        const users = await Personal.findAll({
            attributes: ['email'],
            order: [['email', 'ASC']]
        });
        console.log('--- START USERS ---');
        users.forEach(u => console.log(u.email));
        console.log('--- END USERS ---');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

listUsers();
