// src/models/AsignacionInventario.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const AsignacionInventario = sequelize.define('AsignacionInventario', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  inventario_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'inventario', key: 'id' }
  },
  personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'personal', key: 'id' }
  },
  fecha_asignacion: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: { msg: 'Debe ser una fecha válida' }
    }
  },
  fecha_devolucion: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: { msg: 'Debe ser una fecha válida' }
    }
  },
  motivo: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El motivo es requerido' }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'asignaciones_inventario',
  underscored: true,
  indexes: [
    { fields: ['personal_id'] },
    { fields: ['inventario_id'] },
    { fields: ['activo'] }
  ]
});

export default AsignacionInventario;
