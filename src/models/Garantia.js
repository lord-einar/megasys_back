// src/models/Garantia.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Garantia = sequelize.define('Garantia', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  inventario_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'inventario',
      key: 'id'
    }
  },
  fabricante: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  estado_original: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  duracion_meses: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tipo_entrega: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  codigo_tipo: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  pais: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  origen: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  datos_originales: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  consultado_en: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'garantias',
  indexes: [
    { fields: ['inventario_id'] },
    { fields: ['estado'] },
    { fields: ['fecha_fin'] }
  ]
});

export default Garantia;
