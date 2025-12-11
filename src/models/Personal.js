// src/models/Personal.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const Personal = sequelize.define('Personal', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre es requerido'
      },
      len: {
        args: [2, 50],
        msg: 'El nombre debe tener entre 2 y 50 caracteres'
      },
      is: {
        args: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        msg: 'El nombre solo puede contener letras y espacios'
      }
    }
  },
  apellido: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El apellido es requerido'
      },
      len: {
        args: [2, 50],
        msg: 'El apellido debe tener entre 2 y 50 caracteres'
      },
      is: {
        args: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        msg: 'El apellido solo puede contener letras y espacios'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      msg: 'Este email ya está registrado'
    },
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      },
      notEmpty: {
        msg: 'El email es requerido'
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
  sede_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'sedes',
      key: 'id'
    }
  },
  rol_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id'
    }
  },
  privilegio_app: {
    type: DataTypes.ENUM('super_admin', 'helpdesk', 'support', 'user'),
    allowNull: true,
    defaultValue: 'user',
    comment: 'Privilegios de aplicación basados en grupos Azure AD'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  fecha_ingreso: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      },
      notNull: {
        msg: 'La fecha de ingreso es requerida'
      }
    }
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: true,
    defaultValue: '#007bff',
    validate: {
      is: {
        args: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        msg: 'El color debe estar en formato hexadecimal (ej. #007bff)'
      }
    }
  }
}, {
  tableName: 'personal',
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['sede_id']
    },
    {
      fields: ['rol_id']
    },
    {
      fields: ['activo']
    },
    {
      fields: ['privilegio_app']
    }
  ],
  scopes: {
    activos: {
      where: {
        activo: true
      }
    },
    conSede: {
      include: ['sede']
    },
    conRol: {
      include: ['rol']
    }
  }
});

// Métodos de instancia
Personal.prototype.getNombreCompleto = function () {
  return `${this.nombre} ${this.apellido}`;
};

Personal.prototype.getInfoBasica = function () {
  return {
    id: this.id,
    nombreCompleto: this.getNombreCompleto(),
    email: this.email,
    telefono: this.telefono,
    email: this.email,
    telefono: this.telefono,
    activo: this.activo,
    color: this.color
  };
};

// Métodos estáticos
Personal.findActivos = function () {
  return this.scope('activos').findAll();
};

Personal.findBySede = function (sedeId) {
  return this.findAll({
    where: {
      sede_id: sedeId,
      activo: true
    }
  });
};

module.exports = Personal;