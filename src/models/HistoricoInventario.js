// src/models/HistoricoInventario.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const HistoricoInventario = sequelize.define('HistoricoInventario', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4(),
    allowNull: false
  },
  remito_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'remitos',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'El remito es requerido'
      }
    }
  },
  inventario_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'inventario',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'El artículo es requerido'
      }
    }
  },
  sede_origen_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'La sede de origen es requerida'
      }
    }
  },
  sede_destino_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'La sede de destino es requerida'
      }
    }
  },
  tipo_movimiento: {
    type: DataTypes.ENUM('transferencia', 'prestamo', 'devolucion'),
    allowNull: false,
    defaultValue: 'transferencia',
    validate: {
      isIn: {
        args: [['transferencia', 'prestamo', 'devolucion']],
        msg: 'El tipo de movimiento debe ser: transferencia, prestamo o devolucion'
      }
    }
  },
  es_prestamo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
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
  fecha_movimiento: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
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
  tableName: 'historico_inventario',
  indexes: [
    {
      fields: ['remito_id']
    },
    {
      fields: ['inventario_id']
    },
    {
      fields: ['sede_origen_id']
    },
    {
      fields: ['sede_destino_id']
    },
    {
      fields: ['tipo_movimiento']
    },
    {
      fields: ['es_prestamo']
    },
    {
      fields: ['fecha_movimiento']
    },
    {
      fields: ['remito_id', 'inventario_id']
    }
  ],
  scopes: {
    transferencias: {
      where: {
        tipo_movimiento: 'transferencia'
      }
    },
    prestamos: {
      where: {
        tipo_movimiento: 'prestamo'
      }
    },
    devoluciones: {
      where: {
        tipo_movimiento: 'devolucion'
      }
    },
    porRemito: (remitoId) => ({
      where: {
        remito_id: remitoId
      }
    }),
    porSede: (sedeId) => ({
      where: {
        sede_destino_id: sedeId
      }
    }),
    porFecha: (fechaInicio, fechaFin) => ({
      where: {
        fecha_movimiento: {
          [sequelize.Sequelize.Op.between]: [fechaInicio, fechaFin]
        }
      }
    })
  }
});

// Métodos de instancia
HistoricoInventario.prototype.getDescripcion = function() {
  const tipoMsg = {
    'transferencia': 'Transferencia',
    'prestamo': 'Préstamo',
    'devolucion': 'Devolución'
  };
  return `${tipoMsg[this.tipo_movimiento]} - ${this.sede_origen_id} → ${this.sede_destino_id}`;
};

HistoricoInventario.prototype.esTransferencia = function() {
  return this.tipo_movimiento === 'transferencia';
};

HistoricoInventario.prototype.esPrestamo = function() {
  return this.tipo_movimiento === 'prestamo' && this.es_prestamo;
};

HistoricoInventario.prototype.esDevolucion = function() {
  return this.tipo_movimiento === 'devolucion';
};

// Tipos de movimiento
HistoricoInventario.TIPOS = {
  TRANSFERENCIA: 'transferencia',
  PRESTAMO: 'prestamo',
  DEVOLUCION: 'devolucion'
};

module.exports = HistoricoInventario;
