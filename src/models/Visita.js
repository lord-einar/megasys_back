// src/models/Visita.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const Visita = sequelize.define('Visita', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    sede_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Sede a visitar'
    },
    tecnico_asignado_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Técnico de soporte asignado'
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Fecha programada de la visita'
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
    estado: {
        type: DataTypes.ENUM('programada', 'recordatorio_enviado', 'realizada', 'cancelada'),
        defaultValue: 'programada',
        allowNull: false
    },
    es_recurrente: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    recurrencia_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la configuración de recurrencia si aplica'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    casos_tickets: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array de IDs de casos/tickets relacionados'
    },
    token_solicitudes: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        comment: 'Token único para el formulario público de solicitudes'
    },
    token_feedback: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        comment: 'Token único para que el responsable de sede agregue comentarios post-visita'
    },
    creado_por_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    fecha_cancelacion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    motivo_cancelacion: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'visitas',
    indexes: [
        {
            fields: ['sede_id']
        },
        {
            fields: ['tecnico_asignado_id']
        },
        {
            fields: ['fecha']
        },
        {
            fields: ['estado']
        },
        {
            unique: true,
            fields: ['token_solicitudes']
        },
        {
            unique: true,
            fields: ['token_feedback']
        }
    ],
    hooks: {
        beforeCreate: (visita) => {
            if (!visita.token_solicitudes) {
                // Generar token aleatorio seguro para solicitudes pre-visita
                visita.token_solicitudes = crypto.randomBytes(24).toString('hex');
            }
            if (!visita.token_feedback) {
                // Generar token aleatorio seguro para feedback post-visita
                visita.token_feedback = crypto.randomBytes(24).toString('hex');
            }
        }
    }
});

module.exports = Visita;
