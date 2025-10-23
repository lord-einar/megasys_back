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
  tecnico_asignado_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'personal',
      key: 'id'
    }
  },
  estado: {
    type: DataTypes.ENUM('preparado', 'en_transito', 'entregado', 'confirmado'),
    allowNull: false,
    defaultValue: 'preparado',
    validate: {
      isIn: {
        args: [['preparado', 'en_transito', 'entregado', 'confirmado']],
        msg: 'El estado debe ser: preparado, en_transito, entregado o confirmado'
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
  }
}, {
  tableName: 'remitos',
  indexes: [
    {
      unique: true,
      fields: ['numero_remito']
    },
    {
      fields: ['fecha']
    },
    {
      fields: ['sede_origen_id']
    },
    {
      fields: ['sede_destino_id']
    },
    {
      fields: ['estado']
    },
    {
      fields: ['solicitante_id']
    },
    {
      fields: ['tecnico_asignado_id']
    }
  ],
  scopes: {
    pendientes: {
      where: {
        estado: ['preparado', 'en_transito', 'entregado']
      }
    },
    confirmados: {
      where: {
        estado: 'confirmado'
      }
    },
    porTecnico: (tecnicoId) => ({
      where: {
        tecnico_asignado_id: tecnicoId
      }
    })
  }
});

// Métodos de instancia
Remito.prototype.puedeTransitar = function() {
  return this.estado === 'preparado';
};

Remito.prototype.puedeEntregar = function() {
  return this.estado === 'en_transito';
};

Remito.prototype.puedeConfirmar = function() {
  return this.estado === 'entregado';
};

Remito.prototype.cambiarEstado = async function(nuevoEstado, usuarioId = null) {
  const estadosValidos = {
    'preparado': ['en_transito'],
    'en_transito': ['entregado'],
    'entregado': ['confirmado']
  };

  if (!estadosValidos[this.estado] || !estadosValidos[this.estado].includes(nuevoEstado)) {
    throw new Error(`No se puede cambiar de ${this.estado} a ${nuevoEstado}`);
  }

  this.estado = nuevoEstado;

  // Registrar fechas según el estado
  if (nuevoEstado === 'entregado') {
    this.fecha_entrega = new Date();
  } else if (nuevoEstado === 'confirmado') {
    this.fecha_confirmacion = new Date();
  }

  await this.save();
  
  // Aquí se podría agregar lógica para enviar emails
  return this;
};

module.exports = Remito