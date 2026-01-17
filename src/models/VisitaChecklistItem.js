// src/models/VisitaChecklistItem.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const VisitaChecklistItem = sequelize.define('VisitaChecklistItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    orden: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Para ordenar los items en el formulario'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'visita_checklist_items',
    indexes: [
        {
            fields: ['activo']
        },
        {
            fields: ['orden']
        }
    ]
});

export default VisitaChecklistItem;
