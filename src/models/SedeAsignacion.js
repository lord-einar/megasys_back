// src/models/SedeAsignacion.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const SedeAsignacion = sequelize.define('SedeAsignacion', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  sede_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'La sede es requerida'
      }
    }
  },
  personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'personal',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'El personal de soporte es requerido'
      }
    }
  },
  fecha_asignacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  fecha_fin_asignacion: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'sede_asignaciones',
  indexes: [
    {
      unique: true,
      fields: ['sede_id', 'personal_id'],
      where: { activo: true },
      name: 'idx_sede_personal_active_unique'
    },
    {
      fields: ['sede_id']
    },
    {
      fields: ['personal_id']
    },
    {
      fields: ['activo']
    }
  ]
});

module.exports = SedeAsignacion;
