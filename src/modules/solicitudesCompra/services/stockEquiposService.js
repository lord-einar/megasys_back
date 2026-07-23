// src/modules/solicitudesCompra/services/stockEquiposService.js
import { Op } from 'sequelize';
import {
  Inventario,
  TipoArticulo,
  Sede,
  Personal,
  AsignacionInventario,
  CategoriaEquipo,
  SolicitudCompra
} from '../../../models/index.js';

const TIPOS_ARTICULO = {
  notebook: 'Notebook',
  celular: 'Celular',
  pc_escritorio: 'PC'
};

const TIPOS_PERMITIDOS = Object.values(TIPOS_ARTICULO);

const inventarioInclude = () => ([
  { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] },
  { model: CategoriaEquipo, as: 'categoria', attributes: ['id', 'nombre', 'tipo'] },
  { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede', 'localidad', 'provincia'] },
  {
    model: AsignacionInventario,
    as: 'asignaciones',
    required: false,
    where: { activo: true },
    include: [
      { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id'] }
    ]
  }
]);

const inventarioToCard = (inv) => {
  const asignacionActiva = (inv.asignaciones || [])[0] || null;
  const titularPersonal = asignacionActiva?.personal || null;
  const sede = inv.sedePrincipal || null;

  let titularTipo = 'disponible';
  if (asignacionActiva) {
    titularTipo = 'persona';
  } else if (inv.estado === 'en_uso' && sede) {
    titularTipo = 'sede';
  } else if (sede && inv.estado !== 'disponible') {
    titularTipo = 'sede';
  }

  return {
    id: inv.id,
    tipo: inv.tipoArticulo?.nombre || null,
    marca: inv.marca,
    modelo: inv.modelo,
    numero_serie: inv.numero_serie,
    imei: inv.imei,
    service_tag: inv.service_tag,
    estado: inv.estado,
    activo: inv.activo,
    categoria: inv.categoria ? {
      id: inv.categoria.id,
      nombre: inv.categoria.nombre,
      tipo: inv.categoria.tipo
    } : null,
    fecha_adquisicion: inv.fecha_adquisicion,
    observaciones: inv.observaciones,
    sede: sede ? {
      id: sede.id,
      nombre_sede: sede.nombre_sede,
      localidad: sede.localidad,
      provincia: sede.provincia
    } : null,
    titular_tipo: titularTipo,
    titular_personal: titularPersonal ? {
      id: titularPersonal.id,
      nombre: titularPersonal.nombre,
      apellido: titularPersonal.apellido,
      email: titularPersonal.email
    } : null,
    asignacion_actual: asignacionActiva ? {
      id: asignacionActiva.id,
      fecha_asignacion: asignacionActiva.fecha_asignacion,
      motivo: asignacionActiva.motivo
    } : null
  };
};

class StockEquiposService {
  /**
   * Lista notebooks y celulares con su estado actual y titular (persona o sede).
   * Filtros opcionales:
   *  - tipo: 'notebook' | 'celular' (default: ambos)
   *  - estado: filtra por estado del inventario
   *  - q: búsqueda parcial por marca/modelo/numero_serie
   */
  async listarStock({ tipo, estado, q } = {}) {
    const tipoArticulos = await TipoArticulo.findAll({
      where: {
        nombre: { [Op.in]: TIPOS_PERMITIDOS }
      }
    });

    if (!tipoArticulos.length) {
      return { items: [], resumen: { total: 0, disponibles: 0, entregados: 0, por_tipo: {} } };
    }

    const tiposFiltrados = tipo
      ? tipoArticulos.filter(t => t.nombre.toLowerCase() === (TIPOS_ARTICULO[tipo] || '').toLowerCase())
      : tipoArticulos;

    if (!tiposFiltrados.length) {
      return { items: [], resumen: { total: 0, disponibles: 0, entregados: 0, por_tipo: {} } };
    }

    const where = {
      tipo_articulo_id: { [Op.in]: tiposFiltrados.map(t => t.id) },
      activo: true
    };

    if (estado) where.estado = estado;

    if (q) {
      const term = `%${q}%`;
      where[Op.or] = [
        { marca: { [Op.iLike]: term } },
        { modelo: { [Op.iLike]: term } },
        { numero_serie: { [Op.iLike]: term } },
        { service_tag: { [Op.iLike]: term } }
      ];
    }

    const inventarios = await Inventario.findAll({
      where,
      include: inventarioInclude(),
      order: [['updated_at', 'DESC']]
    });

    const items = inventarios.map(inv => inventarioToCard(inv.toJSON()));

    // "Entregado" significa que tiene un titular (persona o sede con uso),
    // independientemente del estado interno del inventario.
    const esEntregado = (it) => it.titular_tipo === 'persona' || it.titular_tipo === 'sede';

    const resumen = items.reduce((acc, it) => {
      acc.total += 1;
      if (esEntregado(it)) acc.entregados += 1;
      else acc.disponibles += 1;
      const t = (it.tipo || 'otro').toLowerCase();
      acc.por_tipo[t] = acc.por_tipo[t] || { total: 0, disponibles: 0, entregados: 0 };
      acc.por_tipo[t].total += 1;
      if (esEntregado(it)) acc.por_tipo[t].entregados += 1;
      else acc.por_tipo[t].disponibles += 1;
      return acc;
    }, { total: 0, disponibles: 0, entregados: 0, por_tipo: {} });

    return { items, resumen };
  }

  async resolverTipoArticuloIds() {
    const tipos = await TipoArticulo.findAll({
      where: { nombre: { [Op.in]: TIPOS_PERMITIDOS } },
      attributes: ['id', 'nombre']
    });
    return tipos.map(t => t.id);
  }

  /**
   * Devuelve el historial de notebooks/celulares asignados a una persona,
   * con motivo de asignación y motivo de cambio (cuando se conoce vía
   * solicitud de compra de reposición).
   */
  async historialPorPersonal(personalId) {
    if (!personalId) throw new Error('personal_id es requerido');

    const personal = await Personal.findByPk(personalId, {
      attributes: ['id', 'nombre', 'apellido', 'email']
    });
    if (!personal) throw new Error('Personal no encontrado');

    const tipoIds = await this.resolverTipoArticuloIds();
    if (!tipoIds.length) return { personal, items: [] };

    const asignaciones = await AsignacionInventario.findAll({
      where: { personal_id: personalId },
      include: [
        {
          model: Inventario,
          as: 'inventario',
          required: true,
          where: { tipo_articulo_id: { [Op.in]: tipoIds } },
          include: [
            { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] },
            { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede'] }
          ]
        }
      ],
      order: [['fecha_asignacion', 'DESC']]
    });

    const inventarioIds = [...new Set(asignaciones.map(a => a.inventario_id))];

    // Buscamos solicitudes de compra cuyo inventario_actual_id coincida
    // (motivo del reemplazo) o inventario_creado_id coincida (motivo de alta).
    const solicitudes = inventarioIds.length ? await SolicitudCompra.findAll({
      where: {
        [Op.or]: [
          { inventario_actual_id: { [Op.in]: inventarioIds } },
          { inventario_creado_id: { [Op.in]: inventarioIds } }
        ]
      },
      attributes: [
        'id', 'numero', 'tipo_equipo', 'motivo', 'estado',
        'observacion_solicitante', 'rechazo_motivo', 'cancelacion_motivo',
        'inventario_actual_id', 'inventario_creado_id'
      ]
    }) : [];

    const items = asignaciones.map(a => {
      const inv = a.inventario;
      const solicitudReemplazo = solicitudes.find(s => s.inventario_actual_id === inv.id);
      const solicitudAlta = solicitudes.find(s => s.inventario_creado_id === inv.id);

      return {
        asignacion_id: a.id,
        activo: a.activo,
        fecha_asignacion: a.fecha_asignacion,
        fecha_devolucion: a.fecha_devolucion,
        motivo_asignacion: a.motivo,
        motivo_cambio: solicitudReemplazo ? {
          solicitud_id: solicitudReemplazo.id,
          solicitud_numero: solicitudReemplazo.numero,
          motivo: solicitudReemplazo.motivo,
          observacion: solicitudReemplazo.observacion_solicitante
        } : null,
        solicitud_alta: solicitudAlta ? {
          solicitud_id: solicitudAlta.id,
          solicitud_numero: solicitudAlta.numero,
          motivo: solicitudAlta.motivo
        } : null,
        inventario: {
          id: inv.id,
          tipo: inv.tipoArticulo?.nombre,
          marca: inv.marca,
          modelo: inv.modelo,
          numero_serie: inv.numero_serie,
          imei: inv.imei,
          estado: inv.estado,
          sede: inv.sedePrincipal ? {
            id: inv.sedePrincipal.id,
            nombre_sede: inv.sedePrincipal.nombre_sede
          } : null
        }
      };
    });

    return {
      personal,
      items
    };
  }

  /**
   * Devuelve el historial de notebooks/celulares vinculados a una sede.
   * Incluye:
   *   - Equipos actualmente asignados a la sede (Inventario.sede_id = sedeId)
   *   - Asignaciones a personas cuya sede principal coincide (titular en la sede)
   * Para cada item se intenta cruzar con SolicitudCompra para mostrar
   * el motivo de incorporación o reemplazo cuando exista.
   */
  async historialPorSede(sedeId) {
    if (!sedeId) throw new Error('sede_id es requerido');

    const sede = await Sede.findByPk(sedeId, {
      attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
    });
    if (!sede) throw new Error('Sede no encontrada');

    const tipoIds = await this.resolverTipoArticuloIds();
    if (!tipoIds.length) {
      return { sede, inventario_actual: [], historial_asignaciones: [] };
    }

    // Inventario que actualmente está en la sede
    const inventariosEnSede = await Inventario.findAll({
      where: { sede_id: sedeId, activo: true, tipo_articulo_id: { [Op.in]: tipoIds } },
      include: [
        { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] },
        {
          model: AsignacionInventario,
          as: 'asignaciones',
          required: false,
          include: [
            { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id'] }
          ]
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    // Asignaciones cuyo personal tiene esta sede como sede principal (aunque
    // el inventario esté en otra sede física)
    const asignacionesDelPersonalDeLaSede = await AsignacionInventario.findAll({
      include: [
        {
          model: Inventario,
          as: 'inventario',
          required: true,
          where: { tipo_articulo_id: { [Op.in]: tipoIds } },
          include: [
            { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }
          ]
        },
        {
          model: Personal,
          as: 'personal',
          required: true,
          where: { sede_id: sedeId },
          attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id']
        }
      ],
      order: [['fecha_asignacion', 'DESC']]
    });

    const inventarioIds = [
      ...inventariosEnSede.map(i => i.id),
      ...asignacionesDelPersonalDeLaSede.map(a => a.inventario_id)
    ];

    const solicitudes = inventarioIds.length ? await SolicitudCompra.findAll({
      where: {
        [Op.or]: [
          { inventario_actual_id: { [Op.in]: inventarioIds } },
          { inventario_creado_id: { [Op.in]: inventarioIds } }
        ]
      },
      attributes: [
        'id', 'numero', 'tipo_equipo', 'motivo', 'estado',
        'observacion_solicitante', 'inventario_actual_id', 'inventario_creado_id'
      ]
    }) : [];

    const findSolicitud = (invId, key) => solicitudes.find(s => s[key] === invId);

    const inventariosActuales = inventariosEnSede.map(inv => {
      const asignacionActiva = (inv.asignaciones || []).find(a => a.activo);
      const solReemplazo = findSolicitud(inv.id, 'inventario_actual_id');
      const solAlta = findSolicitud(inv.id, 'inventario_creado_id');
      return {
        inventario_id: inv.id,
        tipo: inv.tipoArticulo?.nombre,
        marca: inv.marca,
        modelo: inv.modelo,
        numero_serie: inv.numero_serie,
        imei: inv.imei,
        estado: inv.estado,
        titular_tipo: asignacionActiva ? 'persona' : 'sede',
        titular_personal: asignacionActiva?.personal ? {
          id: asignacionActiva.personal.id,
          nombre: asignacionActiva.personal.nombre,
          apellido: asignacionActiva.personal.apellido,
          email: asignacionActiva.personal.email
        } : null,
        motivo_asignacion: asignacionActiva?.motivo || null,
        fecha_asignacion: asignacionActiva?.fecha_asignacion || null,
        motivo_cambio: solReemplazo ? {
          solicitud_id: solReemplazo.id,
          solicitud_numero: solReemplazo.numero,
          motivo: solReemplazo.motivo,
          observacion: solReemplazo.observacion_solicitante
        } : null,
        solicitud_alta: solAlta ? {
          solicitud_id: solAlta.id,
          solicitud_numero: solAlta.numero,
          motivo: solAlta.motivo
        } : null
      };
    });

    const historialAsignaciones = asignacionesDelPersonalDeLaSede.map(a => {
      const solReemplazo = findSolicitud(a.inventario_id, 'inventario_actual_id');
      const solAlta = findSolicitud(a.inventario_id, 'inventario_creado_id');
      return {
        asignacion_id: a.id,
        inventario_id: a.inventario_id,
        activo: a.activo,
        fecha_asignacion: a.fecha_asignacion,
        fecha_devolucion: a.fecha_devolucion,
        motivo_asignacion: a.motivo,
        personal: a.personal ? {
          id: a.personal.id,
          nombre: a.personal.nombre,
          apellido: a.personal.apellido,
          email: a.personal.email
        } : null,
        inventario: a.inventario ? {
          id: a.inventario.id,
          tipo: a.inventario.tipoArticulo?.nombre,
          marca: a.inventario.marca,
          modelo: a.inventario.modelo,
          numero_serie: a.inventario.numero_serie,
          estado: a.inventario.estado
        } : null,
        motivo_cambio: solReemplazo ? {
          solicitud_id: solReemplazo.id,
          solicitud_numero: solReemplazo.numero,
          motivo: solReemplazo.motivo,
          observacion: solReemplazo.observacion_solicitante
        } : null,
        solicitud_alta: solAlta ? {
          solicitud_id: solAlta.id,
          solicitud_numero: solAlta.numero,
          motivo: solAlta.motivo
        } : null
      };
    });

    return {
      sede,
      inventario_actual: inventariosActuales,
      historial_asignaciones: historialAsignaciones
    };
  }
}

export default new StockEquiposService();
