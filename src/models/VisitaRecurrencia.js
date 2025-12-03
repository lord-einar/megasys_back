// src/models/VisitaRecurrencia.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const VisitaRecurrencia = sequelize.define('VisitaRecurrencia', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    sede_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    tecnico_asignado_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    tipo: {
        type: DataTypes.ENUM('urgencia', 'solicitud', 'programada'),
        defaultValue: 'programada',
        allowNull: false
    },
    motivo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    frecuencia: {
        type: DataTypes.ENUM('quincenal'),
        defaultValue: 'quincenal',
        allowNull: false
    },
    dia_semana: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '0=Domingo, 1=Lunes, etc. (Opcional, para referencia)'
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Fecha de la primera visita de la serie'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    creado_por_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'visita_recurrencias',
    indexes: [
        {
            fields: ['sede_id']
        },
        {
            fields: ['tecnico_asignado_id']
        },
        {
            fields: ['activo']
        }
    ]
});

module.exports = VisitaRecurrencia;
