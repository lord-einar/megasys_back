// src/models/Rol.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const Rol = sequelize.define('Rol', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      msg: 'Este rol ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El nombre del rol es requerido'
      },
      len: {
        args: [2, 50],
        msg: 'El nombre debe tener entre 2 y 50 caracteres'
      }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  nivel_jerarquia: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: {
        args: 1,
        msg: 'El nivel jerárquico debe ser mayor a 0'
      },
      max: {
        args: 10,
        msg: 'El nivel jerárquico no puede ser mayor a 10'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'roles',
  indexes: [
    {
      unique: true,
      fields: ['nombre']
    },
    {
      fields: ['nivel_jerarquia']
    }
  ]
});

// Roles por defecto que se pueden crear via seeder
Rol.ROLES_DEFAULT = [
  { nombre: 'Gerente General', descripcion: 'Máxima autoridad', nivel_jerarquia: 10 },
  { nombre: 'Gerente Comercial', descripcion: 'Gerente del área comercial', nivel_jerarquia: 8 },
  { nombre: 'Gerente de Servicio', descripcion: 'Gerente del área de servicio', nivel_jerarquia: 8 },
  { nombre: 'Supervisor', descripcion: 'Supervisor de área', nivel_jerarquia: 6 },
  { nombre: 'Sistemas', descripcion: 'Técnico de sistemas - responsable de remitos', nivel_jerarquia: 5 },
  { nombre: 'Técnico Senior', descripcion: 'Técnico con experiencia', nivel_jerarquia: 4 },
  { nombre: 'Técnico', descripcion: 'Técnico estándar', nivel_jerarquia: 2 },
  { nombre: 'Empleado', descripcion: 'Empleado general', nivel_jerarquia: 1 }
];

export default Rol;
