// src/models/Remito.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const Remito = sequelize.define('Remito', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4(),
    allowNull: false
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
  tecnico_asignado_id: {
    type: DataTypes.UUID,
    allowNull: true,
    columnName: 'tecnico_asignado_id',
    references: {
      model: 'personal',
      key: 'id'
    }
  },
  estado: {
    type: DataTypes.ENUM('preparado', 'en_transito', 'entregado', 'completado', 'devuelto', 'cancelado'),
    allowNull: false,
    defaultValue: 'preparado',
    validate: {
      isIn: {
        args: [['preparado', 'en_transito', 'entregado', 'completado', 'devuelto', 'cancelado']],
        msg: 'El estado debe ser: preparado, en_transito, entregado, completado, devuelto o cancelado'
      }
    }
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fecha_entrega: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  fecha_confirmacion: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  receptor_nombre: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nombre completo de la persona que recibe el remito (si es diferente al solicitante)'
  },
  receptor_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      }
    },
    comment: 'Email de la persona que recibe el remito (si es diferente al solicitante)'
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
      fields: ['tecnico_asignado_id']
    },
    {
      fields: ['sede_origen_id']
    },
    {
      fields: ['sede_destino_id']
    },
    {
      fields: ['fecha']
    }
  ],
  scopes: {
    porEstado: (estado) => ({
      where: {
        estado
      }
    }),
    porSolicitante: (solicitanteId) => ({
      where: {
        solicitante_id: solicitanteId
      }
    }),
    porTecnico: (tecnicoId) => ({
      where: {
        tecnico_asignado_id: tecnicoId
      }
    })
  }
});

// Métodos de instancia
Remito.prototype.puedeEditarse = function() {
  return this.estado === 'preparado';
};

Remito.prototype.puedeEnviarse = function() {
  return this.estado === 'preparado';
};

Remito.prototype.puedeCompletarse = function() {
  return this.estado === 'entregado';
};

Remito.prototype.puedeDevolverse = function() {
  return this.estado === 'entregado';
};

Remito.prototype.puedeCancelarse = function() {
  return ['preparado', 'en_transito', 'entregado'].includes(this.estado);
};

Remito.prototype.estaCancelado = function() {
  return this.estado === 'cancelado';
};

Remito.prototype.estaCompleto = function() {
  return ['completado', 'devuelto', 'cancelado'].includes(this.estado);
};

Remito.prototype.getDescripcion = function() {
  return `Remito ${this.numero_remito} - ${this.estado}`;
};

// Métodos estáticos para obtener estados válidos
Remito.ESTADOS = {
  PREPARADO: 'preparado',
  EN_TRANSITO: 'en_transito',
  ENTREGADO: 'entregado',
  COMPLETADO: 'completado',
  DEVUELTO: 'devuelto',
  CANCELADO: 'cancelado'
};

Remito.TRANSICIONES_VALIDAS = {
  'preparado': ['en_transito', 'cancelado'],
  'en_transito': ['entregado', 'cancelado'],
  'entregado': ['completado', 'devuelto', 'cancelado'],
  'completado': [],
  'devuelto': [],
  'cancelado': []
};

module.exports = Remito;