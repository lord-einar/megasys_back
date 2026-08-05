import { Op } from 'sequelize';
import { CategoriaEquipo, Inventario, SolicitudAsignacion } from '../../../models/index.js';
import { CATEGORIA_TIPO_TODOS, normalizarTipoCategoria } from '../../../shared/constants/tipoEquipo.js';

class CategoriaEquipoService {
  async listar({ tipo, activo } = {}) {
    const where = {};
    if (tipo) {
      // Acepta 'pc_escritorio' además de 'pc' (ver normalizarTipoCategoria).
      const tipoCategoria = normalizarTipoCategoria(tipo) || tipo;
      // Al filtrar por un tipo concreto también se devuelven las categorías
      // marcadas como "todos los tipos"; si no, quedarían inalcanzables.
      where.tipo = tipoCategoria === CATEGORIA_TIPO_TODOS
        ? CATEGORIA_TIPO_TODOS
        : { [Op.in]: [tipoCategoria, CATEGORIA_TIPO_TODOS] };
    }
    if (activo !== undefined && activo !== null) where.activo = activo;
    return CategoriaEquipo.findAll({
      where,
      order: [['nombre', 'ASC']]
    });
  }

  async obtener(id) {
    return CategoriaEquipo.findByPk(id);
  }

  async crear({ nombre, descripcion, tipo }) {
    if (!nombre) throw new Error('El nombre es requerido');
    return CategoriaEquipo.create({ nombre, descripcion: descripcion || null, tipo: tipo || 'ambos' });
  }

  async actualizar(id, cambios = {}) {
    const cat = await CategoriaEquipo.findByPk(id);
    if (!cat) throw new Error('Categoría no encontrada');
    const editables = ['nombre', 'descripcion', 'tipo', 'activo'];
    for (const campo of editables) {
      if (cambios[campo] !== undefined) cat[campo] = cambios[campo];
    }
    await cat.save();
    return cat;
  }

  async eliminar(id) {
    const cat = await CategoriaEquipo.findByPk(id);
    if (!cat) throw new Error('Categoría no encontrada');

    const [enInventario, enSolicitudes] = await Promise.all([
      Inventario.count({ where: { categoria_id: id } }),
      SolicitudAsignacion.count({ where: { categoria_id: id } })
    ]);

    if (enInventario > 0 || enSolicitudes > 0) {
      cat.activo = false;
      await cat.save();
      return { eliminado: false, desactivado: true, categoria: cat };
    }

    await cat.destroy();
    return { eliminado: true, desactivado: false };
  }
}

export default new CategoriaEquipoService();
