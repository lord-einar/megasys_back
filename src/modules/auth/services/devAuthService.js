import Personal from '../../../models/Personal.js';
import { sequelize } from '../../../shared/utils/database.js';
import authService from './authService.js';
import roleService from './roleService.js';
import authResponseFormatter from './authResponseFormatter.js';
import { ROLES } from '../config/roles.js';

const DEV_USERS = [
  {
    key: 'infra',
    nombre: 'Dev',
    apellido: 'Infraestructura',
    email: 'germanojeda83@gmail.com',
    privilegio_app: 'super_admin',
    role: 'super_admin'
  },
  {
    key: 'rrhh',
    nombre: 'Dev',
    apellido: 'RRHH',
    email: 'germanojedait@gmail.com',
    privilegio_app: 'rrhh',
    role: 'rrhh'
  },
  {
    key: 'compras',
    nombre: 'Dev',
    apellido: 'Compras',
    email: 'germanojeda@outlook.com.ar',
    privilegio_app: 'compras',
    role: 'compras'
  }
];

class DevAuthService {
  isEnabled() {
    return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN !== 'false';
  }

  async ensureDevEnumValues() {
    if (process.env.DB_DIALECT !== 'postgres') {
      return;
    }

    await sequelize.query(`
      ALTER TYPE enum_personal_privilegio_app ADD VALUE IF NOT EXISTS 'rrhh';
    `);

    await sequelize.query(`
      ALTER TYPE enum_personal_privilegio_app ADD VALUE IF NOT EXISTS 'compras';
    `);
  }

  getAvailableUsers() {
    return DEV_USERS.map(({ key, email, role }) => ({ key, email, role }));
  }

  async ensureDevUsers() {
    await this.ensureDevEnumValues();

    const personalByKey = {};

    for (const devUser of DEV_USERS) {
      const [personal] = await Personal.findOrCreate({
        where: { email: devUser.email.toLowerCase() },
        defaults: {
          nombre: devUser.nombre,
          apellido: devUser.apellido,
          email: devUser.email.toLowerCase(),
          privilegio_app: devUser.privilegio_app,
          activo: true
        }
      });

      await personal.update({
        nombre: devUser.nombre,
        apellido: devUser.apellido,
        privilegio_app: devUser.privilegio_app,
        activo: true
      });

      personalByKey[devUser.key] = personal;
    }

    return personalByKey;
  }

  async login(identifier) {
    if (!this.isEnabled()) {
      const err = new Error('Login de desarrollo deshabilitado');
      err.statusCode = 403;
      throw err;
    }

    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
    const devUser = DEV_USERS.find(user =>
      user.key === normalizedIdentifier || user.email.toLowerCase() === normalizedIdentifier
    );

    if (!devUser) {
      const err = new Error('Usuario de desarrollo no permitido');
      err.statusCode = 400;
      throw err;
    }

    const personalByKey = await this.ensureDevUsers();
    const personal = personalByKey[devUser.key];

    const groupGuid = ROLES[devUser.role]?.azureGuid;
    const groups = groupGuid ? [groupGuid] : [];
    const roleInfo = roleService.getRoleAndPermissions(groups);
    const token = authService.generateDevJWT(personal, groups);

    return authResponseFormatter.formatAuthData({
      user: {
        id: personal.id,
        email: personal.email,
        name: `${personal.nombre} ${personal.apellido}`,
        groups,
        tenantId: 'local-development',
        privilegioApp: personal.privilegio_app
      },
      token
    }, roleInfo);
  }
}

export default new DevAuthService();
