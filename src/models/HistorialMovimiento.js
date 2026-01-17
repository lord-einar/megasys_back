// src/models/HistorialMovimiento.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const HistorialMovimiento = sequelize.define('HistorialMovimiento', {
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
  remito_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'remitos',
      key: 'id'
    }
  },
  sede_origen_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    }
  },
  sede_destino_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    }
  },
  tipo_movimiento: {
    type: DataTypes.ENUM('transferencia', 'prestamo', 'devolucion', 'asignacion', 'mantenimiento'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['transferencia', 'prestamo', 'devolucion', 'asignacion', 'mantenimiento']],
        msg: 'Tipo de movimiento no válido'
      }
    }
  },
  fecha_movimiento: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  usuario_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'personal',
      key: 'id'
    }
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'historial_movimientos',
  indexes: [
    {
      fields: ['inventario_id']
    },
    {
      fields: ['fecha_movimiento']
    },
    {
      fields: ['tipo_movimiento']
    },
    {
      fields: ['sede_origen_id']
    },
    {
      fields: ['sede_destino_id']
    }
  ]
});

export default HistorialMovimiento;