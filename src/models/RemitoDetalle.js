// src/models/RemitoDetalle.js
import { DataTypes, Op, Sequelize } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const RemitoDetalle = sequelize.define('RemitoDetalle', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  remito_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'remitos',
      key: 'id'
    }
  },
  inventario_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'inventario',
      key: 'id'
    }
  },
  es_prestamo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  fecha_devolucion_esperada: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  fecha_devolucion_real: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  devuelto: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'remito_detalles',
  indexes: [
    {
      fields: ['remito_id']
    },
    {
      fields: ['inventario_id']
    },
    {
      fields: ['es_prestamo']
    },
    {
      fields: ['devuelto']
    },
    {
      fields: ['fecha_devolucion_esperada']
    }
  ],
  scopes: {
    prestamos: {
      where: {
        es_prestamo: true
      }
    },
    pendientesDevolucion: {
      where: {
        es_prestamo: true,
        devuelto: false
      }
    },
    vencidos: {
      where: {
        es_prestamo: true,
        devuelto: false,
        fecha_devolucion_esperada: {
          [Op.lte]: Sequelize.literal('CURRENT_DATE')
        }
      }
    },
    proximosAVencer: (dias = 7) => ({
      where: {
        es_prestamo: true,
        devuelto: false,
        fecha_devolucion_esperada: {
          [Op.between]: [
            Sequelize.literal('CURRENT_DATE'),
            Sequelize.literal(`CURRENT_DATE + INTERVAL '${dias} days'`)
          ]
        }
      }
    })
  }
});

export default RemitoDetalle;