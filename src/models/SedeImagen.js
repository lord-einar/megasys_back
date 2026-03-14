// src/models/SedeImagen.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const SedeImagen = sequelize.define('SedeImagen', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  sede_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sedes', key: 'id' }
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  nombre_original: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  tamanio: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  mime_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  subido_por_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  }
}, {
  tableName: 'sede_imagenes',
  underscored: true
});

export default SedeImagen;
