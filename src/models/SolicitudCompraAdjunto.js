// src/models/SolicitudCompraAdjunto.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const SolicitudCompraAdjunto = sequelize.define('SolicitudCompraAdjunto', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  solicitud_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'solicitudes_compra', key: 'id' }
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
    type: DataTypes.STRING(100),
    allowNull: true
  },
  subido_por_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  }
}, {
  tableName: 'solicitudes_compra_adjuntos',
  underscored: true,
  indexes: [
    { fields: ['solicitud_id'] }
  ]
});

export default SolicitudCompraAdjunto;
