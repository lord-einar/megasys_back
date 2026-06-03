// src/models/Inventario.js
import { DataTypes, Op } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import { randomUUID as uuidv4 } from 'node:crypto';
import { VALID_STATES } from '../shared/constants/inventoryStates.js';

const Inventario = sequelize.define('Inventario', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  tipo_articulo_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tipos_articulo',
      key: 'id'
    },
    validate: {
      notNull: {
        msg: 'El tipo de artículo es requerido'
      }
    }
  },
  marca: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La marca es requerida'
      },
      len: {
        args: [1, 50],
        msg: 'La marca debe tener entre 1 y 50 caracteres'
      }
    }
  },
  modelo: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El modelo es requerido'
      },
      len: {
        args: [1, 100],
        msg: 'El modelo debe tener entre 1 y 100 caracteres'
      }
    }
  },
  numero_serie: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: {
      msg: 'Este número de serie ya existe'
    },
    validate: {
      len: {
        args: [0, 100],
        msg: 'El número de serie no puede exceder 100 caracteres'
      }
    }
  },
  service_tag: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: {
        args: [0, 100],
        msg: 'El service tag no puede exceder 100 caracteres'
      }
    }
  },
  sede_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'sedes',
      key: 'id'
    }
  },
  estado: {
    type: DataTypes.ENUM(...VALID_STATES),
    allowNull: false,
    defaultValue: 'disponible',
    validate: {
      isIn: {
        args: [VALID_STATES],
        msg: `El estado debe ser uno de: ${VALID_STATES.join(', ')}`
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  fecha_adquisicion: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Debe ser una fecha válida'
      }
    }
  },
  valor_adquisicion: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    validate: {
      min: {
        args: 0,
        msg: 'El valor de adquisición debe ser mayor o igual a 0'
      }
    }
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  garantia_estado: {
    type: DataTypes.ENUM('sin_consultar', 'consultando', 'con_garantia', 'sin_garantia', 'error'),
    defaultValue: 'sin_consultar',
    allowNull: false
  },
  garantia_consultada_en: {
    type: DataTypes.DATE,
    allowNull: true
  },
  garantia_fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  procesador: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  memoria: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  disco: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sistema_operativo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Monitor fields
  pulgadas: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  tipo_conector: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Switch fields
  puertos_ethernet: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  puertos_sfp: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  poe: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  categoria_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'categoria_equipos', key: 'id' }
  }
}, {
  tableName: 'inventario',
  indexes: [
    {
      unique: true,
      fields: ['numero_serie'],
      where: {
        numero_serie: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: ['tipo_articulo_id']
    },
    {
      fields: ['sede_id']
    },
    {
      fields: ['estado']
    },
    {
      fields: ['activo']
    },
    {
      fields: ['marca', 'modelo']
    }
  ],
  scopes: {
    disponibles: {
      where: {
        estado: 'disponible',
        activo: true
      }
    },
    enUso: {
      where: {
        estado: 'en_uso',
        activo: true
      }
    },
    porSede: (sedeId) => ({
      where: {
        sede_id: sedeId,
        activo: true
      }
    })
  }
});

// Métodos de instancia
Inventario.prototype.getIdentificacion = function () {
  const identificadores = [];
  if (this.numero_serie) identificadores.push(`S/N: ${this.numero_serie}`);
  if (this.service_tag) identificadores.push(`TAG: ${this.service_tag}`);

  return identificadores.length > 0
    ? identificadores.join(' | ')
    : `${this.marca} ${this.modelo}`;
};

Inventario.prototype.getDescripcionCompleta = function () {
  return `${this.marca} ${this.modelo} - ${this.getIdentificacion()}`;
};

Inventario.prototype.estaDisponible = function () {
  return this.activo && this.estado === 'disponible';
};

// Métodos estáticos
Inventario.findDisponibles = function (sedeId = null) {
  const where = {
    estado: 'disponible',
    activo: true
  };

  if (sedeId) {
    where.sede_id = sedeId;
  }

  return this.findAll({ where });
};

Inventario.findPorTipo = function (tipoArticuloId) {
  return this.findAll({
    where: {
      tipo_articulo_id: tipoArticuloId,
      activo: true
    }
  });
};

export default Inventario;
