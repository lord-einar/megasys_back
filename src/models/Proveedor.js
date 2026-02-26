// src/models/Proveedor.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Proveedor = sequelize.define('Proveedor', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  empresa: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre de la empresa es requerido'
      },
      len: {
        args: [2, 100],
        msg: 'El nombre de la empresa debe tener entre 2 y 100 caracteres'
      }
    }
  },
  direccion: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'proveedores',
  indexes: [
    {
      fields: ['empresa']
    },
    {
      fields: ['activo']
    }
  ]
});

export default Proveedor;