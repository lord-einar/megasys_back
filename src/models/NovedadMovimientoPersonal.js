// src/models/NovedadMovimientoPersonal.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const ESTADOS = ['pendiente', 'confirmada', 'descartada'];

/**
 * Cambio de sede de una persona detectado por la sincronización con Entra ID.
 * Los equipos asignados no se mueven solos: un super_admin confirma la novedad
 * (y recién ahí se trasladan) o la descarta.
 */
const NovedadMovimientoPersonal = sequelize.define('NovedadMovimientoPersonal', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'personal', key: 'id' }
  },
  sede_anterior_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'sedes', key: 'id' }
  },
  sede_nueva_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'sedes', key: 'id' }
  },
  origen: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'entra_sync'
  },
  estado: {
    type: DataTypes.ENUM(...ESTADOS),
    allowNull: false,
    defaultValue: 'pendiente'
  },
  equipos_trasladados: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  resuelto_por_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  resuelto_en: {
    type: DataTypes.DATE,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'novedades_movimiento_personal',
  indexes: [
    { fields: ['estado'] },
    { fields: ['personal_id'] }
  ]
});

NovedadMovimientoPersonal.ESTADOS = ESTADOS;

export default NovedadMovimientoPersonal;
