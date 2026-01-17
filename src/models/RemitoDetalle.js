// src/models/RemitoDetalle.js
import { DataTypes, Op, Sequelize } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

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

// Métodos de instancia
RemitoDetalle.prototype.estaVencido = function() {
  return this.es_prestamo &&
         !this.devuelto &&
         this.fecha_devolucion &&
         new Date(this.fecha_devolucion) <= new Date();
};

RemitoDetalle.prototype.estaProximoAVencer = function(dias = 7) {
  if (!this.es_prestamo || !this.fecha_devolucion || this.devuelto) {
    return false;
  }

  const hoy = new Date();
  const fechaDevolucion = new Date(this.fecha_devolucion);
  const diferenciaDias = Math.floor((fechaDevolucion - hoy) / (1000 * 60 * 60 * 24));

  return diferenciaDias >= 0 && diferenciaDias <= dias;
};

RemitoDetalle.prototype.marcarDevuelto = async function() {
  if (!this.es_prestamo) {
    throw new Error('Solo los préstamos pueden ser marcados como devueltos');
  }

  this.devuelto = true;
  await this.save();

  return this;
};

export default RemitoDetalle;