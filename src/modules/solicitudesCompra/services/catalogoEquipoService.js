// src/modules/solicitudesCompra/services/catalogoEquipoService.js
import { CatalogoEquipo, SolicitudCompra } from '../../../models/index.js';

class CatalogoEquipoService {
  async listar({ tipo, activo } = {}) {
    const where = {};
    if (tipo) where.tipo = tipo;
    if (activo !== undefined && activo !== null) where.activo = activo;
    return CatalogoEquipo.findAll({
      where,
      order: [['tipo', 'ASC'], ['marca', 'ASC'], ['modelo', 'ASC']]
    });
  }

  async obtener(id) {
    return CatalogoEquipo.findByPk(id);
  }

  async crear({ tipo, marca, modelo, descripcion }) {
    if (!tipo || !marca || !modelo) {
      throw new Error('tipo, marca y modelo son requeridos');
    }
    return CatalogoEquipo.create({ tipo, marca, modelo, descripcion: descripcion || null });
  }

  async actualizar(id, cambios = {}) {
    const equipo = await CatalogoEquipo.findByPk(id);
    if (!equipo) throw new Error('Equipo del catálogo no encontrado');

    const editables = ['tipo', 'marca', 'modelo', 'descripcion', 'activo'];
    for (const campo of editables) {
      if (cambios[campo] !== undefined) equipo[campo] = cambios[campo];
    }
    await equipo.save();
    return equipo;
  }

  /**
   * Soft delete: si el equipo está referenciado por alguna solicitud,
   * solo se marca inactivo. Si no, se borra definitivamente.
   */
  async eliminar(id) {
    const equipo = await CatalogoEquipo.findByPk(id);
    if (!equipo) throw new Error('Equipo del catálogo no encontrado');

    const enUso = await SolicitudCompra.count({ where: { infra_catalogo_equipo_id: id } });
    if (enUso > 0) {
      equipo.activo = false;
      await equipo.save();
      return { eliminado: false, desactivado: true, equipo };
    }

    await equipo.destroy();
    return { eliminado: true, desactivado: false };
  }
}

export default new CatalogoEquipoService();
