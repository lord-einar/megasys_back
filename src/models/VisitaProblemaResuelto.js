// src/models/VisitaProblemaResuelto.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const VisitaProblemaResuelto = sequelize.define('VisitaProblemaResuelto', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    informe_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID del informe asociado'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Descripción del problema resuelto'
    },
    categoria_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID de la categoría del problema'
    },
    causado_por_usuario: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indica si el problema fue causado por mal uso del usuario'
    }
}, {
    tableName: 'visita_problemas_resueltos',
    indexes: [
        {
            fields: ['informe_id']
        },
        {
            fields: ['categoria_id']
        }
    ]
});

export default VisitaProblemaResuelto;
