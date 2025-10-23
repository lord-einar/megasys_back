// src/models/TipoServicio.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const TipoServicio = sequelize.define('TipoServicio', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      msg: 'Este tipo de servicio ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El nombre del tipo de servicio es requerido'
      }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'tipos_servicio'
});

module.exports = TipoServicio