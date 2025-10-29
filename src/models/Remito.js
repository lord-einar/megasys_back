// src/models/Remito.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const Remito = sequelize.define('Remito', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  numero_remito: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: {
      msg: 'Este número de remito ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El número de remito es requerido'
      }
    }
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
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
      },
      // Validación personalizada para que origen y destino sean diferentes
      notEqual(value) {
        if (value === this.sede_origen_id) {
          throw new Error('La sede de destino debe ser diferente a la de origen');
        }
      }
    }
  },
  solicitante_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'personal',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'El solicitante es requerido'
      }
    }
  },
  tecnico_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'personal',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'El técnico es requerido'
      }
    }
  },
  estado: {
    type: DataTypes.ENUM('borrador', 'en_transito', 'entregado', 'devuelto', 'cancelado'),
    allowNull: false,
    defaultValue: 'borrador',
    validate: {
      isIn: {
        args: [['borrador', 'en_transito', 'entregado', 'devuelto', 'cancelado']],
        msg: 'El estado debe ser: borrador, en_transito, entregado, devuelto o cancelado'
      }
    }
  },
  es_prestamo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  fecha_devolucion_estimada: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  fecha_devolucion_real: {
    type: DataTypes.DATEONLY,
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
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'remitos',
  indexes: [
    {
      unique: true,
      fields: ['numero_remito']
    },
    {
      fields: ['estado']
    },
    {
      fields: ['solicitante_id']
    },
    {
      fields: ['tecnico_id']
    },
    {
      fields: ['sede_origen_id']
    },
    {
      fields: ['sede_destino_id']
    },
    {
      fields: ['es_prestamo']
    },
    {
      fields: ['activo']
    },
    {
      fields: ['fecha']
    }
  ],
  scopes: {
    activos: {
      where: {
        activo: true
      }
    },
    porEstado: (estado) => ({
      where: {
        estado,
        activo: true
      }
    }),
    porSolicitante: (solicitanteId) => ({
      where: {
        solicitante_id: solicitanteId,
        activo: true
      }
    }),
    porTecnico: (tecnicoId) => ({
      where: {
        tecnico_id: tecnicoId,
        activo: true
      }
    }),
    prestamos: {
      where: {
        es_prestamo: true,
        activo: true
      }
    }
  }
});

// Métodos de instancia
Remito.prototype.puedeEditarse = function() {
  return this.estado === 'borrador';
};

Remito.prototype.puedeDevolverse = function() {
  return this.es_prestamo && this.estado === 'en_transito';
};

Remito.prototype.getDescripcion = function() {
  return `Remito ${this.numero_remito} - ${this.estado}`;
};

module.exports = Remito;