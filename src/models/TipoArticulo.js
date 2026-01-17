// src/models/TipoArticulo.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const TipoArticulo = sequelize.define('TipoArticulo', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      msg: 'Este tipo de artículo ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El nombre del tipo de artículo es requerido'
      },
      len: {
        args: [2, 50],
        msg: 'El nombre debe tener entre 2 y 50 caracteres'
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
  tableName: 'tipos_articulo',
  indexes: [
    {
      unique: true,
      fields: ['nombre']
    }
  ]
});

export default TipoArticulo;