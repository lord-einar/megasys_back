// src/models/Auditoria.js - SISTEMA DE AUDITORÍA COMPLETO
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const Auditoria = sequelize.define('Auditoria', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  usuario_email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true,
    comment: 'Email del usuario que realizó la acción'
  },
  usuario_id: {
    type: DataTypes.UUID,
    allowNull: true,
    index: true,
    comment: 'ID del usuario (si está loggeado)'
  },
  modulo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    index: true,
    validate: {
      notEmpty: {
        msg: 'El módulo es requerido'
      }
    },
    comment: 'Módulo afectado (inventario, sedes, personal, etc.)'
  },
  accion: {
    type: DataTypes.ENUM('crear', 'leer', 'actualizar', 'eliminar', 'cambiar_estado', 'exportar', 'importar', 'otro'),
    allowNull: false,
    index: true,
    validate: {
      isIn: {
        args: [['crear', 'leer', 'actualizar', 'eliminar', 'cambiar_estado', 'exportar', 'importar', 'otro']],
        msg: 'Acción no válida'
      }
    },
    comment: 'Tipo de acción realizada'
  },
  recurso: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Recurso afectado (ej: Inventario, Sede, Personal)'
  },
  recurso_id: {
    type: DataTypes.UUID,
    allowNull: true,
    index: true,
    comment: 'ID del recurso afectado'
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción detallada de la acción'
  },
  valores_anteriores: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON con valores antes del cambio (solo para actualizar/eliminar)'
  },
  valores_nuevos: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON con valores después del cambio (solo para crear/actualizar)'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: 'Dirección IP del cliente'
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent del navegador'
  },
  resultado: {
    type: DataTypes.ENUM('exitoso', 'fallido', 'parcial'),
    defaultValue: 'exitoso',
    allowNull: false,
    comment: 'Resultado de la acción'
  },
  mensaje_error: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensaje de error si la acción falló'
  },
  fecha_accion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    index: true,
    comment: 'Fecha y hora de la acción'
  }
}, {
  tableName: 'auditoria',
  indexes: [
    {
      fields: ['usuario_email', 'fecha_accion']
    },
    {
      fields: ['modulo', 'accion']
    },
    {
      fields: ['recurso_id', 'fecha_accion']
    },
    {
      fields: ['fecha_accion']
    }
  ],
  comment: 'Tabla de auditoría para registrar todas las acciones de los usuarios'
});

export default Auditoria;
