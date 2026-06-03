import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const TIPOS_EQUIPO = ['celular', 'notebook'];

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
  'pendiente_rrhh',
  'aprobada',
  'remito_generado',
  'finalizada',
  'rechazada',
  'cancelada'
];

const ESTADOS_TERMINALES = ['finalizada', 'rechazada', 'cancelada'];

const SOLICITANTE_GRUPOS = ['infraestructura', 'rrhh'];

const MOTIVOS_REPOSICION = ['reposicion_robo', 'reposicion_perdida', 'reposicion_rotura'];

const SolicitudAsignacion = sequelize.define('SolicitudAsignacion', {
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
    validate: { notEmpty: { msg: 'La observación / razón técnica es requerida' } }
  },
  beneficiario_personal_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'personal', key: 'id' }
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
  // Equipo anterior (reposiciones)
  inventario_anterior_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'inventario', key: 'id' }
  },
  denuncia_presentada: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  equipo_anterior_accion: {
    type: DataTypes.ENUM('mantenimiento', 'dado_de_baja'),
    allowNull: true
  },
  // Asignación por Infra
  inventario_asignado_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'inventario', key: 'id' }
  },
  categoria_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'categoria_equipos', key: 'id' }
  },
  infra_asignador_id: {
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
  // Remito
  remito_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'remitos', key: 'id' }
  },
  // Cierre manual
  cierre_personal_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'personal', key: 'id' }
  },
  cierre_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cierre_observacion: {
    type: DataTypes.TEXT,
    allowNull: true
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
  },
  // Campo virtual: código legible SA-XXXX
  codigo: {
    type: DataTypes.VIRTUAL,
    get() {
      const n = this.getDataValue('numero');
      return n != null ? `SA-${String(n).padStart(4, '0')}` : null;
    }
  }
}, {
  tableName: 'solicitudes_asignacion',
  underscored: true,
  indexes: [
    { fields: ['estado'] },
    { fields: ['tipo_equipo'] },
    { fields: ['beneficiario_personal_id'] },
    { fields: ['solicitante_personal_id'] },
    { fields: ['created_at'] }
  ]
});

SolicitudAsignacion.TIPOS_EQUIPO = TIPOS_EQUIPO;
SolicitudAsignacion.MOTIVOS = MOTIVOS;
SolicitudAsignacion.ESTADOS = ESTADOS;
SolicitudAsignacion.ESTADOS_TERMINALES = ESTADOS_TERMINALES;
SolicitudAsignacion.SOLICITANTE_GRUPOS = SOLICITANTE_GRUPOS;
SolicitudAsignacion.MOTIVOS_REPOSICION = MOTIVOS_REPOSICION;

SolicitudAsignacion.prototype.esReposicion = function () {
  return MOTIVOS_REPOSICION.includes(this.motivo);
};

// getCodigo() se mantiene para uso interno en servicios
SolicitudAsignacion.prototype.getCodigo = function () {
  return this.codigo ?? `SA-${String(this.numero).padStart(4, '0')}`;
};

export default SolicitudAsignacion;
