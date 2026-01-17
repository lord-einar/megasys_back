// src/models/SoporteNivel.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const SoporteNivel = sequelize.define('SoporteNivel', {
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
  nivel: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: 1,
        msg: 'El nivel debe ser mayor a 0'
      },
      max: {
        args: 10,
        msg: 'El nivel no puede ser mayor a 10'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      }
    }
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: {
        args: /^[\+]?[0-9\s\-\(\)]+$/,
        msg: 'El formato del teléfono no es válido'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'soporte_niveles',
  indexes: [
    {
      unique: true,
      fields: ['servicio_id', 'nivel']
    }
  ]
});

export default SoporteNivel;