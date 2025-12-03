// src/models/VisitaChecklistItem.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../shared/utils/database');
const { v4: uuidv4 } = require('uuid');

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

module.exports = VisitaChecklistItem;
