// src/models/VisitaInforme.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

const VisitaInforme = sequelize.define('VisitaInforme', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    visita_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        comment: 'Una visita tiene un solo informe'
    },
    tecnico_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Técnico que completó el informe'
    },
    fecha_realizacion: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    checklist_items: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array de { item: string, completado: boolean }'
    },
    checklist_extra: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Items adicionales agregados manualmente'
    },
    casos_resueltos: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array de IDs de casos resueltos'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    comentarios_responsable_sede: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comentarios adicionales del responsable de la sede'
    },
    comentarios_responsable_fecha: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora cuando se agregaron los comentarios del responsable'
    },
    comentarios_responsable_nombre: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Nombre o email de quien agregó los comentarios'
    }
}, {
    tableName: 'visita_informes',
    indexes: [
        {
            unique: true,
            fields: ['visita_id']
        },
        {
            fields: ['tecnico_id']
        }
    ]
});

module.exports = VisitaInforme;
