import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';
import { CATEGORIA_TIPOS } from '../shared/constants/tipoEquipo.js';

// 'ambos' = aplica a los tres tipos (nombre heredado de cuando eran sólo dos).
const TIPOS = CATEGORIA_TIPOS;

const CategoriaEquipo = sequelize.define('CategoriaEquipo', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre: {
    type: DataTypes.STRING(80),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El nombre es requerido' },
      len: { args: [1, 80], msg: 'El nombre debe tener entre 1 y 80 caracteres' }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tipo: {
    type: DataTypes.ENUM(...TIPOS),
    allowNull: false,
    defaultValue: 'ambos',
    validate: {
      isIn: { args: [TIPOS], msg: 'El tipo debe ser notebook, celular, pc o ambos' }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'categoria_equipos',
  underscored: true,
  indexes: [
    { fields: ['tipo'] },
    { fields: ['activo'] }
  ]
});

CategoriaEquipo.TIPOS = TIPOS;

export default CategoriaEquipo;
