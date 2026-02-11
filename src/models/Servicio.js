// src/models/Servicio.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Servicio = sequelize.define('Servicio', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  id_servicio: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: {
      msg: 'Este ID de servicio ya existe'
    },
    validate: {
      len: {
        args: [2, 50],
        msg: 'El ID de servicio debe tener entre 2 y 50 caracteres'
      }
    }
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre del servicio es requerido'
      }
    }
  },
  tipo_servicio_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tipos_servicio',
      key: 'id'
    }
  },
  proveedor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'proveedores',
      key: 'id'
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'servicios'
});

export default Servicio;