// src/models/index.js - COMPLETO CON RELACIONES
import { Sequelize } from 'sequelize';
import { sequelize } from '../shared/utils/database.js';
import logger from '../shared/utils/logger.js';

// Importar todos los modelos
import Empresa from './Empresa.js';
import Sede from './Sede.js';
import Personal from './Personal.js';
import PersonalSede from './PersonalSede.js';
import SedeAsignacion from './SedeAsignacion.js';
import TipoArticulo from './TipoArticulo.js';
import Rol from './Rol.js';
import Inventario from './Inventario.js';
import Proveedor from './Proveedor.js';
import EjecutivoCuentas from './EjecutivoCuentas.js';
import TipoServicio from './TipoServicio.js';
import Servicio from './Servicio.js';
import SoporteNivel from './SoporteNivel.js';
import Remito from './Remito.js';
import RemitoDetalle from './RemitoDetalle.js';
import HistorialMovimiento from './HistorialMovimiento.js';
import HistoricoInventario from './HistoricoInventario.js';
import Auditoria from './Auditoria.js';
import Visita from './Visita.js';
import VisitaRecurrencia from './VisitaRecurrencia.js';
import VisitaSolicitudPrevia from './VisitaSolicitudPrevia.js';
import VisitaInforme from './VisitaInforme.js';
import VisitaProblemaResuelto from './VisitaProblemaResuelto.js';
import VisitaChecklistItem from './VisitaChecklistItem.js';
import CategoriaProblema from './CategoriaProblema.js';
import EquipoServicio from './EquipoServicio.js';
import Reclamo from './Reclamo.js';

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

// Relaciones jerárquicas de Rol (parent-child)
Rol.hasMany(Rol, {
  foreignKey: 'parent_id',
  as: 'subRoles'
});
Rol.belongsTo(Rol, {
  foreignKey: 'parent_id',
  as: 'rolPadre'
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

// =====================================================
// RELACIONES SEDE-ASIGNACION (Asignación de técnicos de soporte a sedes)
// =====================================================

// Sede -> SedeAsignacion (uno a muchos)
Sede.hasMany(SedeAsignacion, {
  foreignKey: 'sede_id',
  as: 'asignacionesSoporte'
});
SedeAsignacion.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sede'
});

// Personal -> SedeAsignacion (uno a muchos)
Personal.hasMany(SedeAsignacion, {
  foreignKey: 'personal_id',
  as: 'asignacionesSede'
});
SedeAsignacion.belongsTo(Personal, {
  foreignKey: 'personal_id',
  as: 'personal'
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

// Relaciones TipoServicio -> EjecutivoCuentas
TipoServicio.hasMany(EjecutivoCuentas, {
  foreignKey: 'tipo_servicio_id',
  as: 'ejecutivos'
});
EjecutivoCuentas.belongsTo(TipoServicio, {
  foreignKey: 'tipo_servicio_id',
  as: 'tipoServicio'
});

// Relaciones Servicio -> EquipoServicio
Servicio.hasMany(EquipoServicio, {
  foreignKey: 'servicio_id',
  as: 'equipos'
});
EquipoServicio.belongsTo(Servicio, {
  foreignKey: 'servicio_id',
  as: 'servicio'
});

// Relaciones Sede -> EquipoServicio
Sede.hasMany(EquipoServicio, {
  foreignKey: 'sede_id',
  as: 'equiposServicio'
});
EquipoServicio.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sede'
});

// Relaciones Servicio -> Reclamo
Servicio.hasMany(Reclamo, {
  foreignKey: 'servicio_id',
  as: 'reclamos'
});
Reclamo.belongsTo(Servicio, {
  foreignKey: 'servicio_id',
  as: 'servicio'
});

// Relaciones Sede -> Reclamo
Sede.hasMany(Reclamo, {
  foreignKey: 'sede_id',
  as: 'reclamos'
});
Reclamo.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sede'
});

// Relaciones EquipoServicio -> Reclamo
EquipoServicio.hasMany(Reclamo, {
  foreignKey: 'equipo_id',
  as: 'reclamos'
});
Reclamo.belongsTo(EquipoServicio, {
  foreignKey: 'equipo_id',
  as: 'equipo'
});

// Relaciones Personal (Creado Por) -> Reclamo
Personal.hasMany(Reclamo, {
  foreignKey: 'creado_por_id',
  as: 'reclamosCreados'
});
Reclamo.belongsTo(Personal, {
  foreignKey: 'creado_por_id',
  as: 'creador'
});

// Relaciones Personal (Asignado A) -> Reclamo
Personal.hasMany(Reclamo, {
  foreignKey: 'asignado_a_id',
  as: 'reclamosAsignados'
});
Reclamo.belongsTo(Personal, {
  foreignKey: 'asignado_a_id',
  as: 'tecnicoAsignado'
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
  as: 'sedesServicio'
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

// Relaciones HistoricoInventario
// Remito -> HistoricoInventario
Remito.hasMany(HistoricoInventario, {
  foreignKey: 'remito_id',
  as: 'historicoInventario'
});
HistoricoInventario.belongsTo(Remito, {
  foreignKey: 'remito_id',
  as: 'remito'
});

// Inventario -> HistoricoInventario
Inventario.hasMany(HistoricoInventario, {
  foreignKey: 'inventario_id',
  as: 'historicoInventario'
});
HistoricoInventario.belongsTo(Inventario, {
  foreignKey: 'inventario_id',
  as: 'inventario'
});

// Sede origen -> HistoricoInventario
Sede.hasMany(HistoricoInventario, {
  foreignKey: 'sede_origen_id',
  as: 'historicoInventarioOrigen'
});
HistoricoInventario.belongsTo(Sede, {
  foreignKey: 'sede_origen_id',
  as: 'sedeOrigen'
});

// Sede destino -> HistoricoInventario
Sede.hasMany(HistoricoInventario, {
  foreignKey: 'sede_destino_id',
  as: 'historicoInventarioDestino'
});
HistoricoInventario.belongsTo(Sede, {
  foreignKey: 'sede_destino_id',
  as: 'sedeDestino'
});

// =====================================================
// RELACIONES MÓDULO VISITAS
// =====================================================

// Visita -> Sede
Sede.hasMany(Visita, {
  foreignKey: 'sede_id',
  as: 'visitas'
});
Visita.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sedePrincipal'
});

// Visita -> Personal (Técnico Asignado)
Personal.hasMany(Visita, {
  foreignKey: 'tecnico_asignado_id',
  as: 'visitasAsignadas'
});
Visita.belongsTo(Personal, {
  foreignKey: 'tecnico_asignado_id',
  as: 'tecnicoAsignado'
});

// Visita -> Personal (Creado Por)
Personal.hasMany(Visita, {
  foreignKey: 'creado_por_id',
  as: 'visitasCreadas'
});
Visita.belongsTo(Personal, {
  foreignKey: 'creado_por_id',
  as: 'creador'
});

// VisitaRecurrencia -> Visita
VisitaRecurrencia.hasMany(Visita, {
  foreignKey: 'recurrencia_id',
  as: 'instancias'
});
Visita.belongsTo(VisitaRecurrencia, {
  foreignKey: 'recurrencia_id',
  as: 'recurrencia'
});

// VisitaRecurrencia -> Sede
Sede.hasMany(VisitaRecurrencia, {
  foreignKey: 'sede_id',
  as: 'recurrenciasVisita'
});
VisitaRecurrencia.belongsTo(Sede, {
  foreignKey: 'sede_id',
  as: 'sede'
});

// VisitaRecurrencia -> Personal (Técnico)
Personal.hasMany(VisitaRecurrencia, {
  foreignKey: 'tecnico_asignado_id',
  as: 'recurrenciasAsignadas'
});
VisitaRecurrencia.belongsTo(Personal, {
  foreignKey: 'tecnico_asignado_id',
  as: 'tecnicoAsignado'
});

// Visita -> VisitaSolicitudPrevia
Visita.hasMany(VisitaSolicitudPrevia, {
  foreignKey: 'visita_id',
  as: 'solicitudesPrevias'
});
VisitaSolicitudPrevia.belongsTo(Visita, {
  foreignKey: 'visita_id',
  as: 'visita'
});

// Visita -> VisitaInforme
Visita.hasOne(VisitaInforme, {
  foreignKey: 'visita_id',
  as: 'informe'
});
VisitaInforme.belongsTo(Visita, {
  foreignKey: 'visita_id',
  as: 'visita'
});

// VisitaInforme -> Personal (Técnico)
Personal.hasMany(VisitaInforme, {
  foreignKey: 'tecnico_id',
  as: 'informesVisita'
});
VisitaInforme.belongsTo(Personal, {
  foreignKey: 'tecnico_id',
  as: 'tecnico'
});

// VisitaInforme -> Personal (Editor - quien editó el informe)
Personal.hasMany(VisitaInforme, {
  foreignKey: 'editado_por_id',
  as: 'informesEditados'
});
VisitaInforme.belongsTo(Personal, {
  foreignKey: 'editado_por_id',
  as: 'editor'
});

// VisitaInforme -> VisitaProblemaResuelto
VisitaInforme.hasMany(VisitaProblemaResuelto, {
  foreignKey: 'informe_id',
  as: 'problemasResueltos'
});
VisitaProblemaResuelto.belongsTo(VisitaInforme, {
  foreignKey: 'informe_id',
  as: 'informe'
});

// CategoriaProblema -> VisitaProblemaResuelto
CategoriaProblema.hasMany(VisitaProblemaResuelto, {
  foreignKey: 'categoria_id',
  as: 'problemasResueltos'
});
VisitaProblemaResuelto.belongsTo(CategoriaProblema, {
  foreignKey: 'categoria_id',
  as: 'categoriaProblema' // Cambiado de 'categoria' para evitar conflicto con el campo ENUM 'categoria'
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
    logger.error('Error creando historial de movimiento en hook afterCreate de RemitoDetalle:', {
      remitoDetalleId: remitoDetalle.id,
      remitoId: remitoDetalle.remito_id,
      error: error.message,
      stack: error.stack
    });
    throw error; // Propagate error to rollback transaction
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

      // Actualizar la sede de cada item de inventario (siempre, independientemente de si es préstamo)
      for (const detalle of detalles) {
        await detalle.inventarioDetalle.update({
          sede_id: remito.sede_destino_id
        }, { transaction: options.transaction });
      }
    } catch (error) {
      logger.error('Error actualizando ubicación de inventario en hook afterUpdate de Remito:', {
        remitoId: remito.id,
        remitoNumero: remito.numero_remito,
        error: error.message,
        stack: error.stack
      });
      throw error; // Propagate error to rollback transaction
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
  SedeAsignacion,
  TipoArticulo,
  Rol,
  Inventario,

  // Proveedores y servicios
  Proveedor,
  EjecutivoCuentas,
  TipoServicio,
  Servicio,
  SoporteNivel,
  EquipoServicio,
  Reclamo,

  // Remitos y movimientos
  Remito,
  RemitoDetalle,
  HistorialMovimiento,
  HistoricoInventario,

  // Auditoría
  Auditoria,

  // Tablas intermedias
  SedeServicio,

  // Módulo Visitas
  Visita,
  VisitaRecurrencia,
  VisitaSolicitudPrevia,
  VisitaInforme,
  VisitaProblemaResuelto,
  VisitaChecklistItem,
  CategoriaProblema
};

// Agregar métodos de asociación globales
models.syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    // console.log('✅ Base de datos sincronizada correctamente');
  } catch (error) {
    logger.error('Error sincronizando base de datos:', error);
    throw error;
  }
};

export default models;

// Named exports para imports destructurados
export {
  sequelize,
  Sequelize,
  Empresa,
  Sede,
  Personal,
  PersonalSede,
  SedeAsignacion,
  TipoArticulo,
  Rol,
  Inventario,
  Proveedor,
  EjecutivoCuentas,
  TipoServicio,
  Servicio,
  SoporteNivel,
  EquipoServicio,
  Reclamo,
  Remito,
  RemitoDetalle,
  HistorialMovimiento,
  HistoricoInventario,
  Auditoria,
  SedeServicio,
  Visita,
  VisitaRecurrencia,
  VisitaSolicitudPrevia,
  VisitaInforme,
  VisitaProblemaResuelto,
  VisitaChecklistItem,
  CategoriaProblema
};