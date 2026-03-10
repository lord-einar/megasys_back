// src/models/VisitaImagen.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const VisitaImagen = sequelize.define('VisitaImagen', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  informe_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'visita_informes', key: 'id' }
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
  tableName: 'visita_imagenes',
  underscored: true
});

export default VisitaImagen;
