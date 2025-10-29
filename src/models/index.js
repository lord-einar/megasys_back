// src/models/index.js - COMPLETO CON RELACIONES
const { Sequelize } = require('sequelize');
const { sequelize } = require('../shared/utils/database');

// Importar todos los modelos
const Empresa = require('./Empresa');
const Sede = require('./Sede');
const Personal = require('./Personal');
const PersonalSede = require('./PersonalSede');
const TipoArticulo = require('./TipoArticulo');
const Rol = require('./Rol');
const Inventario = require('./Inventario');
const Proveedor = require('./Proveedor');
const EjecutivoCuentas = require('./EjecutivoCuentas');
const TipoServicio = require('./TipoServicio');
const Servicio = require('./Servicio');
const SoporteNivel = require('./SoporteNivel');
const Remito = require('./Remito');
const RemitoDetalle = require('./RemitoDetalle');
const HistorialMovimiento = require('./HistorialMovimiento');
const Auditoria = require('./Auditoria');

// =====================================================
// DEFINICIÓN DE RELACIONES
// =====================================================

// Relaciones Empresa -> Sede
Empresa.hasMany(Sede, {
  foreignKey: 'empresa_id',
  as: 'sedes'
});
Sede.belongsTo(Empresa, {
  foreignKey: 'empresa_id',
  as: 'empresa'
});

// Relaciones Sede -> Personal
Sede.hasMany(Personal, {
  foreignKey: 'sede_id',
  as: 'personalSede'
});
Personal.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sede'
});

// Relaciones Rol -> Personal
Rol.hasMany(Personal, {
  foreignKey: 'rol_id',
  as: 'personalRol'
});
Personal.belongsTo(Rol, {
  foreignKey: 'rol_id',
  as: 'rol'
});

// Relaciones Personal -> PersonalSede (uno a muchos)
Personal.hasMany(PersonalSede, {
  foreignKey: 'personal_id',
  as: 'sedesAsignadas'
});
PersonalSede.belongsTo(Personal, {
  foreignKey: 'personal_id',
  as: 'personal'
});

// Relaciones Sede -> PersonalSede (uno a muchos)
Sede.hasMany(PersonalSede, {
  foreignKey: 'sede_id',
  as: 'personalAsignado'
});
PersonalSede.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sede'
});

// Relaciones Rol -> PersonalSede (uno a muchos)
Rol.hasMany(PersonalSede, {
  foreignKey: 'rol_id',
  as: 'asignacionesRol'
});
PersonalSede.belongsTo(Rol, {
  foreignKey: 'rol_id',
  as: 'rol'
});

// Relaciones TipoArticulo -> Inventario
TipoArticulo.hasMany(Inventario, {
  foreignKey: 'tipo_articulo_id',
  as: 'articulosTipo'
});
Inventario.belongsTo(TipoArticulo, {
  foreignKey: 'tipo_articulo_id',
  as: 'tipoArticulo'
});

// Relaciones Sede -> Inventario
Sede.hasMany(Inventario, {
  foreignKey: 'sede_id',
  as: 'inventarioSede'
});
Inventario.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sedePrincipal'
});

// Relaciones Proveedor -> EjecutivoCuentas
Proveedor.hasMany(EjecutivoCuentas, {
  foreignKey: 'proveedor_id',
  as: 'ejecutivos'
});
EjecutivoCuentas.belongsTo(Proveedor, {
  foreignKey: 'proveedor_id',
  as: 'proveedor'
});

// Relaciones TipoServicio -> Servicio
TipoServicio.hasMany(Servicio, {
  foreignKey: 'tipo_servicio_id',
  as: 'servicios'
});
Servicio.belongsTo(TipoServicio, {
  foreignKey: 'tipo_servicio_id',
  as: 'tipoServicio'
});

// Relaciones Proveedor -> Servicio
Proveedor.hasMany(Servicio, {
  foreignKey: 'proveedor_id',
  as: 'servicios'
});
Servicio.belongsTo(Proveedor, {
  foreignKey: 'proveedor_id',
  as: 'proveedor'
});

// Relaciones Servicio -> SoporteNivel
Servicio.hasMany(SoporteNivel, {
  foreignKey: 'servicio_id',
  as: 'nivelessoporte'
});
SoporteNivel.belongsTo(Servicio, {
  foreignKey: 'servicio_id',
  as: 'servicio'
});

// Relaciones Sede -> Servicio (muchos a muchos)
const SedeServicio = sequelize.define('SedeServicio', {
  sede_id: {
    type: Sequelize.UUID,
    references: {
      model: Sede,
      key: 'id'
    }
  },
  servicio_id: {
    type: Sequelize.UUID,
    references: {
      model: Servicio,
      key: 'id'
    }
  },
  fecha_contratacion: {
    type: Sequelize.DATEONLY,
    allowNull: true
  },
  fecha_vencimiento: {
    type: Sequelize.DATEONLY,
    allowNull: true
  },
  activo: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'sede_servicios',
  indexes: [
    {
      unique: true,
      fields: ['sede_id', 'servicio_id']
    }
  ]
});

Sede.belongsToMany(Servicio, {
  through: SedeServicio,
  foreignKey: 'sede_id',
  otherKey: 'servicio_id',
  as: 'servicios'
});

Servicio.belongsToMany(Sede, {
  through: SedeServicio,
  foreignKey: 'servicio_id',
  otherKey: 'sede_id',
  as: 'sedes'
});

// Relaciones de Remito
// Sede origen
Sede.hasMany(Remito, {
  foreignKey: 'sede_origen_id',
  as: 'remitosOrigen'
});
Remito.belongsTo(Sede, {
  foreignKey: 'sede_origen_id',
  as: 'sedeOrigen'
});

// Sede destino
Sede.hasMany(Remito, {
  foreignKey: 'sede_destino_id',
  as: 'remitosDestino'
});
Remito.belongsTo(Sede, {
  foreignKey: 'sede_destino_id',
  as: 'sedeDestino'
});

// Personal solicitante
Personal.hasMany(Remito, {
  foreignKey: 'solicitante_id',
  as: 'remitosSolicitados'
});
Remito.belongsTo(Personal, {
  foreignKey: 'solicitante_id',
  as: 'solicitante'
});

// Personal técnico asignado
Personal.hasMany(Remito, {
  foreignKey: 'tecnico_asignado_id',
  as: 'remitosAsignados'
});
Remito.belongsTo(Personal, {
  foreignKey: 'tecnico_asignado_id',
  as: 'tecnicoAsignado'
});

// Relaciones Remito -> RemitoDetalle
Remito.hasMany(RemitoDetalle, {
  foreignKey: 'remito_id',
  as: 'detalles'
});
RemitoDetalle.belongsTo(Remito, {
  foreignKey: 'remito_id',
  as: 'remito'
});

// Relaciones Inventario -> RemitoDetalle
Inventario.hasMany(RemitoDetalle, {
  foreignKey: 'inventario_id',
  as: 'detallesRemito'
});
RemitoDetalle.belongsTo(Inventario, {
  foreignKey: 'inventario_id',
  as: 'inventarioDetalle'
});

// Relaciones HistorialMovimiento
Inventario.hasMany(HistorialMovimiento, {
  foreignKey: 'inventario_id',
  as: 'historialMovimientosInventario'
});
HistorialMovimiento.belongsTo(Inventario, {
  foreignKey: 'inventario_id',
  as: 'inventarioMovimiento'
});

Remito.hasMany(HistorialMovimiento, {
  foreignKey: 'remito_id',
  as: 'historialMovimientosRemito'
});
HistorialMovimiento.belongsTo(Remito, {
  foreignKey: 'remito_id',
  as: 'remitoMovimiento'
});

// Sede origen en historial
Sede.hasMany(HistorialMovimiento, {
  foreignKey: 'sede_origen_id',
  as: 'historialMovimientosOrigen'
});
HistorialMovimiento.belongsTo(Sede, {
  foreignKey: 'sede_origen_id',
  as: 'sedeOrigenMovimiento'
});

// Sede destino en historial
Sede.hasMany(HistorialMovimiento, {
  foreignKey: 'sede_destino_id',
  as: 'historialMovimientosDestino'
});
HistorialMovimiento.belongsTo(Sede, {
  foreignKey: 'sede_destino_id',
  as: 'sedeDestinoMovimiento'
});

// Usuario en historial
Personal.hasMany(HistorialMovimiento, {
  foreignKey: 'usuario_id',
  as: 'historialMovimientosPersonal'
});
HistorialMovimiento.belongsTo(Personal, {
  foreignKey: 'usuario_id',
  as: 'usuarioMovimiento'
});

// =====================================================
// HOOKS Y FUNCIONES AUTOMÁTICAS
// =====================================================

// Hook para crear historial de movimientos automáticamente
RemitoDetalle.addHook('afterCreate', async (remitoDetalle, options) => {
  try {
    // Obtener el remito completo
    const remito = await Remito.findByPk(remitoDetalle.remito_id);
    
    if (remito) {
      // Crear registro en historial
      await HistorialMovimiento.create({
        inventario_id: remitoDetalle.inventario_id,
        remito_id: remito.id,
        sede_origen_id: remito.sede_origen_id,
        sede_destino_id: remito.sede_destino_id,
        tipo_movimiento: remitoDetalle.es_prestamo ? 'prestamo' : 'transferencia',
        fecha_movimiento: new Date(),
        observaciones: `${remitoDetalle.es_prestamo ? 'Préstamo' : 'Transferencia'} vía remito ${remito.numero_remito}`
      }, { transaction: options.transaction });
    }
  } catch (error) {
    console.error('Error creando historial de movimiento:', error);
  }
});

// Hook para actualizar ubicación del inventario cuando se entrega remito
Remito.addHook('afterUpdate', async (remito, options) => {
  if (remito.changed('estado') && remito.estado === 'entregado') {
    try {
      // Obtener todos los detalles del remito
      const detalles = await RemitoDetalle.findAll({
        where: { remito_id: remito.id },
        include: ['inventarioDetalle']
      });

      // Actualizar la sede de cada item de inventario (solo si no es préstamo)
      for (const detalle of detalles) {
        if (!detalle.es_prestamo) {
          await detalle.inventarioDetalle.update({
            sede_id: remito.sede_destino_id
          }, { transaction: options.transaction });
        }
      }
    } catch (error) {
      console.error('Error actualizando ubicación de inventario:', error);
    }
  }
});

// =====================================================
// EXPORTAR TODOS LOS MODELOS
// =====================================================

const models = {
  // Infraestructura
  sequelize,
  Sequelize,

  // Modelos principales
  Empresa,
  Sede,
  Personal,
  PersonalSede,
  TipoArticulo,
  Rol,
  Inventario,

  // Proveedores y servicios
  Proveedor,
  EjecutivoCuentas,
  TipoServicio,
  Servicio,
  SoporteNivel,

  // Remitos y movimientos
  Remito,
  RemitoDetalle,
  HistorialMovimiento,

  // Auditoría
  Auditoria,

  // Tablas intermedias
  SedeServicio
};

// Agregar métodos de asociación globales
models.syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    console.log('✅ Base de datos sincronizada correctamente');
  } catch (error) {
    console.error('❌ Error sincronizando base de datos:', error);
    throw error;
  }
};

module.exports = models;