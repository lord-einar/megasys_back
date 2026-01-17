// src/models/PersonalSede.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const PersonalSede = sequelize.define('PersonalSede', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'personal',
      key: 'id'
    }
  },
  sede_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    }
  },
  rol_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'roles',
      key: 'id'
    }
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'personal_sedes',
  indexes: [
    {
      unique: true,
      fields: ['personal_id', 'sede_id'],
      where: {
        activo: true
      },
      name: 'unique_personal_sede_activo'
    },
    {
      fields: ['personal_id']
    },
    {
      fields: ['sede_id']
    },
    {
      fields: ['rol_id']
    },
    {
      fields: ['activo']
    }
  ],
  scopes: {
    activos: {
      where: {
        activo: true
      }
    }
  }
});

export default PersonalSede;
