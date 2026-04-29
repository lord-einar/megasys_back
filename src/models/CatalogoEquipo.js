// src/models/CatalogoEquipo.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const CatalogoEquipo = sequelize.define('CatalogoEquipo', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  tipo: {
    type: DataTypes.ENUM('celular', 'notebook'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['celular', 'notebook']],
        msg: 'El tipo debe ser celular o notebook'
      }
    }
  },
  marca: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'La marca es requerida' },
      len: { args: [1, 50], msg: 'La marca debe tener entre 1 y 50 caracteres' }
    }
  },
  modelo: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El modelo es requerido' },
      len: { args: [1, 100], msg: 'El modelo debe tener entre 1 y 100 caracteres' }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'catalogo_equipos',
  underscored: true,
  indexes: [
    { fields: ['tipo'] },
    { fields: ['activo'] },
    { unique: true, fields: ['tipo', 'marca', 'modelo'], name: 'catalogo_equipos_tipo_marca_modelo_unique' }
  ]
});

export default CatalogoEquipo;
