// src/models/SolicitudCompra.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const TIPOS_EQUIPO = ['celular', 'notebook', 'pc_escritorio'];

const MOTIVOS = [
  'nuevo_ingreso',
  'nuevo_puesto',
  'reposicion_robo',
  'reposicion_perdida',
  'reposicion_rotura',
  'cambio_equipo',
  'otro'
];

const ESTADOS = [
  'pendiente_infra',
  'aprobada_infra',
  'pendiente_pedido',
  'pedido',
  'recibido',
  'entregado_sistemas',
  'entregado_destinatario',
  'finalizada',
  'comprada',
  'rechazada',
  'cancelada'
];

const SOLICITANTE_GRUPOS = ['infraestructura', 'rrhh', 'compras'];

const SolicitudCompra = sequelize.define('SolicitudCompra', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  numero: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    unique: true
  },
  tipo_equipo: {
    type: DataTypes.ENUM(...TIPOS_EQUIPO),
    allowNull: false
  },
  motivo: {
    type: DataTypes.ENUM(...MOTIVOS),
    allowNull: false
  },
  observacion_solicitante: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'La observación / razón técnica es requerida' }
    }
  },
  beneficiario_personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'personal', key: 'id' }
  },
  inventario_actual_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'inventario', key: 'id' }
  },
  denuncia_presentada: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  solicitante_personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'personal', key: 'id' }
  },
  solicitante_grupo: {
    type: DataTypes.ENUM(...SOLICITANTE_GRUPOS),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM(...ESTADOS),
    allowNull: false,
    defaultValue: 'pendiente_infra'
  },
  // Aprobación Infraestructura
  infra_aprobador_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  infra_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  infra_observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  infra_catalogo_equipo_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'catalogo_equipos', key: 'id' }
  },
  // Aprobación RRHH
  rrhh_aprobador_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  rrhh_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rrhh_observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Compra
  compras_responsable_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  compras_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  compras_numero_oc: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  compras_observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  compras_estado_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  compras_entrega_observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imei: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  numero_serie_final: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sistemas_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sistemas_observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  inventario_creado_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'inventario', key: 'id' }
  },
  // Rechazo
  rechazo_motivo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rechazo_por_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  rechazo_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Cancelación
  cancelacion_motivo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cancelado_por_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  cancelado_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'solicitudes_compra',
  underscored: true,
  indexes: [
    { fields: ['estado'] },
    { fields: ['tipo_equipo'] },
    { fields: ['beneficiario_personal_id'] },
    { fields: ['solicitante_personal_id'] },
    { fields: ['created_at'] }
  ]
});

SolicitudCompra.TIPOS_EQUIPO = TIPOS_EQUIPO;
SolicitudCompra.MOTIVOS = MOTIVOS;
SolicitudCompra.ESTADOS = ESTADOS;
SolicitudCompra.SOLICITANTE_GRUPOS = SOLICITANTE_GRUPOS;

SolicitudCompra.MOTIVOS_REPOSICION = [
  'reposicion_robo',
  'reposicion_perdida',
  'reposicion_rotura'
];

SolicitudCompra.prototype.esReposicion = function () {
  return SolicitudCompra.MOTIVOS_REPOSICION.includes(this.motivo);
};

SolicitudCompra.prototype.getCodigo = function () {
  return `SC-${String(this.numero).padStart(4, '0')}`;
};

export default SolicitudCompra;
