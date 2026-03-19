// src/models/Sede.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Sede = sequelize.define('Sede', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  empresa_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'empresas',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'La empresa es requerida'
      }
    }
  },
  nombre_sede: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre de la sede es requerido'
      },
      len: {
        args: [2, 100],
        msg: 'El nombre de la sede debe tener entre 2 y 100 caracteres'
      }
    }
  },
  direccion: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La dirección es requerida'
      }
    }
  },
  localidad: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La localidad es requerida'
      }
    }
  },
  provincia: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La provincia es requerida'
      }
    }
  },
  pais: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Argentina',
    validate: {
      notEmpty: {
        msg: 'El país es requerido'
      }
    }
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: {
        args: /^[\+]?[0-9\s\-\(\)]+$/,
        msg: 'El formato del teléfono no es válido'
      }
    }
  },
  ip_sede: {
    type: DataTypes.STRING(15),
    allowNull: true,
    validate: {
      isIP: {
        msg: 'Debe ser una dirección IP válida'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  es_prueba: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Indica si la sede es de prueba (excluida de estadísticas y reportes)'
  },
  crm_account_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    comment: 'ID de la cuenta en Dynamics 365 CRM vinculada a esta sede'
  }
}, {
  tableName: 'sedes',
  indexes: [
    {
      unique: true,
      fields: ['empresa_id', 'nombre_sede']
    },
    {
      fields: ['activo']
    },
    {
      fields: ['empresa_id']
    },
    {
      fields: ['es_prueba']
    }
  ],
  scopes: {
    activas: {
      where: {
        activo: true
      }
    },
    produccion: {
      where: {
        es_prueba: false
      }
    },
    activasProduccion: {
      where: {
        activo: true,
        es_prueba: false
      }
    }
  }
});

// Métodos de instancia
Sede.prototype.getFullName = function() {
  return `${this.nombre_empresa} - ${this.nombre_sede}`;
};

// Métodos estáticos
Sede.findActivas = function() {
  return this.scope('activas').findAll();
};

export default Sede;
