// src/modules/asignaciones/services/asignacionInventarioService.js
import { AsignacionInventario, Inventario, Personal, TipoArticulo, sequelize } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';

class AsignacionInventarioService {
  /**
   * Listar asignaciones con filtros opcionales.
   * @param {Object} filters - { personal_id, inventario_id, activo, tipo_articulo_nombre }
   */
  async listar(filters = {}) {
    const where = {};
    if (filters.personal_id) where.personal_id = filters.personal_id;
    if (filters.inventario_id) where.inventario_id = filters.inventario_id;
    if (filters.activo !== undefined && filters.activo !== null) where.activo = filters.activo;

    const inventarioInclude = {
      model: Inventario,
      as: 'inventario',
      attributes: ['id', 'marca', 'modelo', 'numero_serie', 'tipo_articulo_id'],
      include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
    };

    if (filters.tipo_articulo_nombre) {
      inventarioInclude.required = true;
      inventarioInclude.include[0].where = { nombre: filters.tipo_articulo_nombre };
      inventarioInclude.include[0].required = true;
    }

    return AsignacionInventario.findAll({
      where,
      include: [
        inventarioInclude,
        { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email'] }
      ],
      order: [['fecha_asignacion', 'DESC'], ['created_at', 'DESC']]
    });
  }

  async obtener(id) {
    return AsignacionInventario.findByPk(id, {
      include: [
        {
          model: Inventario,
          as: 'inventario',
          include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
        },
        { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email'] }
      ]
    });
  }

  /**
   * Crear una asignación. Si la persona ya tiene una asignación activa para el mismo
   * tipo de inventario, se cierra automáticamente (fecha_devolucion=hoy, activo=false).
   */
  async crear({ inventario_id, personal_id, fecha_asignacion, motivo }) {
    if (!inventario_id || !personal_id || !motivo) {
      throw new Error('inventario_id, personal_id y motivo son requeridos');
    }

    const inventario = await Inventario.findByPk(inventario_id, {
      include: [{ model: TipoArticulo, as: 'tipoArticulo' }]
    });
    if (!inventario) throw new Error('Inventario no encontrado');

    const personal = await Personal.findByPk(personal_id);
    if (!personal) throw new Error('Personal no encontrado');

    return sequelize.transaction(async (transaction) => {
      // Cerrar asignaciones activas previas de la misma persona para el mismo tipo de artículo
      const previas = await AsignacionInventario.findAll({
        where: { personal_id, activo: true },
        include: [{
          model: Inventario,
          as: 'inventario',
          required: true,
          where: { tipo_articulo_id: inventario.tipo_articulo_id }
        }],
        transaction
      });

      const hoy = new Date().toISOString().slice(0, 10);
      for (const prev of previas) {
        prev.activo = false;
        if (!prev.fecha_devolucion) prev.fecha_devolucion = hoy;
        await prev.save({ transaction });
      }

      const nueva = await AsignacionInventario.create({
        inventario_id,
        personal_id,
        fecha_asignacion: fecha_asignacion || hoy,
        motivo,
        activo: true
      }, { transaction });

      return nueva;
    });
  }

  /**
   * Cerrar una asignación (devolución).
   */
  async cerrar(id, { fecha_devolucion } = {}) {
    const asignacion = await AsignacionInventario.findByPk(id);
    if (!asignacion) throw new Error('Asignación no encontrada');
    if (!asignacion.activo) throw new Error('La asignación ya está cerrada');

    asignacion.activo = false;
    asignacion.fecha_devolucion = fecha_devolucion || new Date().toISOString().slice(0, 10);
    await asignacion.save();
    return asignacion;
  }

  /**
   * Editar campos. Si cambia fecha_asignacion, el caller debe validar permiso super_admin.
   */
  async actualizar(id, cambios = {}) {
    const asignacion = await AsignacionInventario.findByPk(id);
    if (!asignacion) throw new Error('Asignación no encontrada');

    const camposEditables = ['fecha_asignacion', 'fecha_devolucion', 'motivo'];
    for (const campo of camposEditables) {
      if (cambios[campo] !== undefined) asignacion[campo] = cambios[campo];
    }
    await asignacion.save();
    return asignacion;
  }
}

export default new AsignacionInventarioService();
