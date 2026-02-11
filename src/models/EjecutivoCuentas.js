// src/models/EjecutivoCuentas.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const EjecutivoCuentas = sequelize.define('EjecutivoCuentas', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  proveedor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'proveedores',
      key: 'id'
    }
  },
  tipo_servicio_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'tipos_servicio',
      key: 'id'
    }
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre del ejecutivo es requerido'
      }
    }
  },
  apellido: {
    type: DataTypes.STRING(100),
    allowNull: true, // Temporalmente null para datos existentes
    validate: {
      notEmpty: {
        msg: 'El apellido del ejecutivo es requerido'
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
  tableName: 'ejecutivos_cuentas'
});

export default EjecutivoCuentas;