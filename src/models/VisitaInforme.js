// src/models/VisitaInforme.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

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
    casos_crm_estado: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Estado de casos CRM vinculados: [{ numeroCaso, titulo, estado: "realizado"|"postergado", observacion }]'
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
    },
    editado_por_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que editó el informe (null si nunca fue editado)'
    },
    fecha_ultima_edicion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora de la última edición del informe'
    },
    veces_editado: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Contador de veces que se editó el informe'
    },
    historial_cambios: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array de objetos con historial de cambios: [{ fecha, usuario, cambios: { campo: { antes, despues } } }]'
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

export default VisitaInforme;
