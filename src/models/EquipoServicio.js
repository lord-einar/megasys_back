// src/models/EquipoServicio.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const EquipoServicio = sequelize.define('EquipoServicio', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  servicio_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'servicios',
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
  mac: {
    type: DataTypes.STRING(17),
    allowNull: true,
    validate: {
      is: {
        args: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
        msg: 'El formato de la dirección MAC no es válido (formato: XX:XX:XX:XX:XX:XX)'
      }
    }
  },
  modelo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  marca: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  numero_serie: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'equipos_servicio',
  indexes: [
    {
      fields: ['servicio_id']
    },
    {
      fields: ['sede_id']
    },
    {
      fields: ['mac']
    },
    {
      fields: ['activo']
    }
  ]
});

export default EquipoServicio;
