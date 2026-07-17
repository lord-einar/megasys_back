import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const ACCIONES = [
  'creada',
  'editada',
  'solicitud_compra',
  'equipo_asignado',
  'aprobada_infra',
  'aprobada_rrhh',
  'rechazada',
  'cancelada',
  'remito_generado',
  'finalizada',
  'reenviada_infra',
  'adjunto_agregado'
];

const SolicitudAsignacionHistorial = sequelize.define('SolicitudAsignacionHistorial', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  solicitud_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'solicitudes_asignacion', key: 'id' }
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
  tableName: 'solicitudes_asignacion_historial',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['solicitud_id'] },
    { fields: ['solicitud_id', 'created_at'] }
  ]
});

SolicitudAsignacionHistorial.ACCIONES = ACCIONES;

export default SolicitudAsignacionHistorial;
