// src/models/VisitaSolicitudPrevia.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const VisitaSolicitudPrevia = sequelize.define('VisitaSolicitudPrevia', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    visita_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID de la visita asociada'
    },
    solicitante_nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Nombre extraído del email o ingresado'
    },
    solicitante_email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Detalle de la solicitud'
    },
    resuelta: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Si fue marcada como resuelta en el informe post-visita'
    },
    fecha_solicitud: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'visita_solicitudes_previas',
    indexes: [
        {
            fields: ['visita_id']
        },
        {
            fields: ['solicitante_email']
        }
    ]
});

export default VisitaSolicitudPrevia;
