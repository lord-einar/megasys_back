// src/models/SolicitudCompraHistorial.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const ACCIONES = [
  'creada',
  'editada',
  'aprobada_infra',
  'aprobada_rrhh',
  'rechazada',
  'comprada',
  'reenviada_infra',
  'cancelada',
  'adjunto_agregado',
  'adjunto_eliminado'
];

const SolicitudCompraHistorial = sequelize.define('SolicitudCompraHistorial', {
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
  accion: {
    type: DataTypes.ENUM(...ACCIONES),
    allowNull: false
  },
  actor_personal_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  actor_grupo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  comentario: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  diff: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'solicitudes_compra_historial',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['solicitud_id'] },
    { fields: ['solicitud_id', 'created_at'] }
  ]
});

SolicitudCompraHistorial.ACCIONES = ACCIONES;

export default SolicitudCompraHistorial;
