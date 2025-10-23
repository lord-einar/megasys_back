// src/models/Proveedor.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

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
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      }
    }
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

module.exports = Proveedor