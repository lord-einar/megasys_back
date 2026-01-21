// src/models/CategoriaProblema.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';

const CategoriaProblema = sequelize.define('CategoriaProblema', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4()
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'El nombre es requerido' },
            len: {
                args: [2, 100],
                msg: 'El nombre debe tener entre 2 y 100 caracteres'
            }
        }
    },
    codigo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Código para compatibilidad con datos históricos'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    icono: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'question-mark-circle',
        comment: 'Nombre del icono heroicons'
    },
    color: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: '#6b7280',
        comment: 'Color en formato hexadecimal'
    },
    orden: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Para ordenar las categorías en el formulario'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'categorias_problemas',
    indexes: [
        { fields: ['activo'] },
        { fields: ['orden'] },
        { unique: true, fields: ['codigo'] }
    ]
});

export default CategoriaProblema;
