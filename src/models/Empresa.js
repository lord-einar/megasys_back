// src/models/Empresa.js
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const Empresa = sequelize.define('Empresa', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre: {
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
  razon_social: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: {
      len: {
        args: [0, 150],
        msg: 'La razón social no puede exceder 150 caracteres'
      }
    }
  },
  rfc: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: {
      msg: 'Este RFC ya existe'
    },
    validate: {
      len: {
        args: [0, 50],
        msg: 'El RFC no puede exceder 50 caracteres'
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
  sitio_web: {
    type: DataTypes.STRING(200),
    allowNull: true,
    validate: {
      isUrl: {
        msg: 'Debe ser una URL válida'
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
      fields: ['nombre']
    },
    {
      unique: true,
      fields: ['rfc'],
      where: {
        rfc: {
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
    nombre: this.nombre,
    razonSocial: this.razon_social,
    rfc: this.rfc,
    activo: this.activo
  };
};

// Métodos estáticos
Empresa.findActivas = function() {
  return this.scope('activas').findAll();
};

module.exports = Empresa;
