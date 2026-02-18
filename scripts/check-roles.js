import 'dotenv/config';
import { sequelize } from '../src/shared/utils/database.js';
import Rol from '../src/models/Rol.js';

async function listRoles() {
    try {
        await sequelize.authenticate();
        const roles = await Rol.findAll();
        console.log('--- ROLES ---');
        roles.forEach(r => console.log(`ID: ${r.id}, Nombre: ${r.nombre}`));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

listRoles();
