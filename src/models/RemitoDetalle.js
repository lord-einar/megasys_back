// src/models/RemitoDetalle.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

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
      },
      // Validación personalizada para préstamos
      requiredForLoan(value) {
        if (this.es_prestamo && !value) {
          throw new Error('La fecha de devolución es requerida para préstamos');
        }
      },
      futureDate(value) {
        if (value && new Date(value) <= new Date()) {
          throw new Error('La fecha de devolución debe ser futura');
        }
      }
    }
  },
  devuelto: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
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
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'remito_detalles',
  indexes: [
    {
      unique: true,
      fields: ['remito_id', 'inventario_id']
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
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    }
  }
});

// Métodos de instancia
RemitoDetalle.prototype.estaVencido = function() {
  return this.es_prestamo && 
         !this.devuelto && 
         this.fecha_devolucion_esperada && 
         new Date(this.fecha_devolucion_esperada) < new Date();
};

RemitoDetalle.prototype.marcarDevuelto = async function() {
  if (!this.es_prestamo) {
    throw new Error('Solo los préstamos pueden ser marcados como devueltos');
  }
  
  this.devuelto = true;
  this.fecha_devolucion_real = new Date();
  await this.save();
  
  return this;
};

module.exports = RemitoDetalle