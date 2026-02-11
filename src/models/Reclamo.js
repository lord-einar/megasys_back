// src/models/Reclamo.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Reclamo = sequelize.define('Reclamo', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  numero_reclamo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      msg: 'Este número de reclamo ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El número de reclamo es requerido'
      }
    }
  },
  servicio_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'servicios',
      key: 'id'
    }
  },
  sede_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sedes',
      key: 'id'
    }
  },
  equipo_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'equipos_servicio',
      key: 'id'
    }
  },
  titulo: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El título del reclamo es requerido'
      },
      len: {
        args: [3, 200],
        msg: 'El título debe tener entre 3 y 200 caracteres'
      }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La descripción del reclamo es requerida'
      }
    }
  },
  estado: {
    type: DataTypes.ENUM('abierto', 'en_proceso', 'resuelto', 'cerrado', 'cancelado'),
    allowNull: false,
    defaultValue: 'abierto',
    validate: {
      isIn: {
        args: [['abierto', 'en_proceso', 'resuelto', 'cerrado', 'cancelado']],
        msg: 'El estado debe ser: abierto, en_proceso, resuelto, cerrado o cancelado'
      }
    }
  },
  prioridad: {
    type: DataTypes.ENUM('baja', 'media', 'alta', 'critica'),
    allowNull: false,
    defaultValue: 'media',
    validate: {
      isIn: {
        args: [['baja', 'media', 'alta', 'critica']],
        msg: 'La prioridad debe ser: baja, media, alta o critica'
      }
    }
  },
  fecha_apertura: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fecha_resolucion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  creado_por_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'personal',
      key: 'id'
    }
  },
  asignado_a_id: {
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
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'reclamos',
  indexes: [
    {
      unique: true,
      fields: ['numero_reclamo']
    },
    {
      fields: ['servicio_id']
    },
    {
      fields: ['sede_id']
    },
    {
      fields: ['equipo_id']
    },
    {
      fields: ['estado']
    },
    {
      fields: ['prioridad']
    },
    {
      fields: ['creado_por_id']
    },
    {
      fields: ['asignado_a_id']
    },
    {
      fields: ['fecha_apertura']
    },
    {
      fields: ['activo']
    }
  ]
});

// Hook para establecer fecha_resolucion automáticamente cuando cambia a 'resuelto'
Reclamo.addHook('beforeUpdate', (reclamo) => {
  if (reclamo.changed('estado') && reclamo.estado === 'resuelto' && !reclamo.fecha_resolucion) {
    reclamo.fecha_resolucion = new Date();
  }
});

export default Reclamo;
