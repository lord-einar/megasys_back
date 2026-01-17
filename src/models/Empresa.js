// src/models/Empresa.js
import { DataTypes, Op } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Empresa = sequelize.define('Empresa', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre_empresa: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      msg: 'Este nombre de empresa ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El nombre de la empresa es requerido'
      },
      len: {
        args: [2, 100],
        msg: 'El nombre debe tener entre 2 y 100 caracteres'
      }
    }
  },
  rason_social: {
    type: DataTypes.STRING(200),
    allowNull: true,
    validate: {
      len: {
        args: [0, 200],
        msg: 'La razón social no puede exceder 200 caracteres'
      }
    }
  },
  cuit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: {
      msg: 'Este CUIT ya existe'
    },
    validate: {
      len: {
        args: [0, 20],
        msg: 'El CUIT no puede exceder 20 caracteres'
      }
    }
  },
  direccion: {
    type: DataTypes.STRING(200),
    allowNull: true,
    validate: {
      len: {
        args: [0, 200],
        msg: 'La dirección no puede exceder 200 caracteres'
      }
    }
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: {
        args: /^[\+]?[0-9\s\-\(\)]*$/,
        msg: 'El formato del teléfono no es válido'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'empresas',
  indexes: [
    {
      unique: true,
      fields: ['nombre_empresa']
    },
    {
      unique: true,
      fields: ['cuit'],
      where: {
        cuit: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: ['activo']
    }
  ],
  scopes: {
    activas: {
      where: {
        activo: true
      }
    }
  }
});

// Métodos de instancia
Empresa.prototype.getInfo = function() {
  return {
    id: this.id,
    nombre_empresa: this.nombre_empresa,
    rason_social: this.rason_social,
    cuit: this.cuit,
    activo: this.activo
  };
};

// Métodos estáticos
Empresa.findActivas = function() {
  return this.scope('activas').findAll();
};

export default Empresa;
