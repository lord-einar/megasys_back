// src/modules/asignaciones/services/asignacionInventarioService.js
import { Op } from 'sequelize';
import {
  AsignacionInventario,
  HistorialMovimiento,
  Inventario,
  Personal,
  Remito,
  RemitoDetalle,
  Sede,
  TipoArticulo,
  sequelize
} from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import AuditService from '../../../shared/services/auditService.js';
import { tipoEquipoPersonalDeArticulo, etiquetaTipoEquipo } from '../../../shared/constants/tipoEquipo.js';
import { ESTADOS_REMITO_ACTIVOS, planificarTraslado } from './trasladoEquiposPolicy.js';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const conStatus = (mensaje, statusCode) => Object.assign(new Error(mensaje), { statusCode });

const descripcionEquipo = (inv) =>
  `${inv.marca} ${inv.modelo}${inv.numero_serie ? ` (S/N ${inv.numero_serie})` : ''}`;

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
      attributes: ['id', 'marca', 'modelo', 'numero_serie', 'imei', 'tipo_articulo_id', 'sede_id'],
      include: [
        { model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] },
        { model: Sede, as: 'sedePrincipal', attributes: ['id', 'nombre_sede'] }
      ]
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
        { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id'] }
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
   * Asignar un celular o notebook a una persona (entrega directa).
   * - El equipo pasa a "en_uso" y se ubica en la sede de la persona.
   * - Si la persona ya tenía un equipo activo del mismo tipo, esa asignación se
   *   cierra y el equipo anterior vuelve a "disponible".
   */
  async crear({ inventario_id, personal_id, fecha_asignacion, motivo }, { usuarioEmail = 'sistema@megatlon.com.ar' } = {}) {
    if (!inventario_id || !personal_id || !motivo) {
      throw conStatus('inventario_id, personal_id y motivo son requeridos', 400);
    }

    const inventario = await Inventario.findByPk(inventario_id, {
      include: [{ model: TipoArticulo, as: 'tipoArticulo' }]
    });
    if (!inventario) throw conStatus('Inventario no encontrado', 404);

    const tipoEquipo = tipoEquipoPersonalDeArticulo(inventario.tipoArticulo?.nombre);
    if (!tipoEquipo) {
      throw conStatus(`Solo se pueden asignar celulares y notebooks (el artículo es "${inventario.tipoArticulo?.nombre}")`, 400);
    }
    if (!inventario.activo) throw conStatus('El equipo no está activo', 400);
    if (inventario.estado !== 'disponible') {
      throw conStatus(`El equipo no está disponible (estado: ${inventario.estado})`, 400);
    }

    const asignacionExistente = await AsignacionInventario.findOne({ where: { inventario_id, activo: true } });
    if (asignacionExistente) throw conStatus('El equipo ya está asignado a otra persona', 400);

    const personal = await Personal.findByPk(personal_id);
    if (!personal) throw conStatus('Personal no encontrado', 404);
    if (!personal.activo) throw conStatus('La persona no está activa', 400);

    const devueltos = [];
    const nueva = await sequelize.transaction(async (transaction) => {
      // Cerrar la asignación activa previa del mismo tipo de equipo
      const previas = await this.asignacionesPersonalesActivas(personal_id, { transaction });
      for (const prev of previas.filter(p => p.tipoEquipo === tipoEquipo)) {
        prev.asignacion.activo = false;
        if (!prev.asignacion.fecha_devolucion) prev.asignacion.fecha_devolucion = hoyISO();
        await prev.asignacion.save({ transaction });

        if (prev.inventario.estado === 'en_uso') {
          await prev.inventario.update({ estado: 'disponible' }, { transaction });
        }
        devueltos.push(prev.inventario.id);
      }

      const sedeAnterior = inventario.sede_id;
      const sedeNueva = personal.sede_id || inventario.sede_id;
      await inventario.update({ estado: 'en_uso', sede_id: sedeNueva }, { transaction });

      if (sedeAnterior && sedeNueva) {
        await HistorialMovimiento.create({
          inventario_id,
          sede_origen_id: sedeAnterior,
          sede_destino_id: sedeNueva,
          tipo_movimiento: 'asignacion',
          fecha_movimiento: new Date(),
          observaciones: `Asignado a ${personal.nombre} ${personal.apellido}`
        }, { transaction });
      }

      return AsignacionInventario.create({
        inventario_id,
        personal_id,
        fecha_asignacion: fecha_asignacion || hoyISO(),
        motivo,
        activo: true
      }, { transaction });
    });

    await AuditService.registrarAccion({
      usuario_email: usuarioEmail,
      modulo: 'asignaciones',
      accion: 'asignar_equipo',
      recurso: 'Inventario',
      recurso_id: inventario_id,
      descripcion: `${etiquetaTipoEquipo(tipoEquipo)} ${descripcionEquipo(inventario)} asignado a ${personal.nombre} ${personal.apellido}`,
      valores_nuevos: { asignacion_id: nueva.id, personal_id, equipos_devueltos: devueltos }
    });

    return nueva;
  }

  /**
   * Cerrar una asignación (devolución). El equipo vuelve a "disponible".
   */
  async cerrar(id, { fecha_devolucion } = {}) {
    const asignacion = await AsignacionInventario.findByPk(id);
    if (!asignacion) throw new Error('Asignación no encontrada');
    if (!asignacion.activo) throw new Error('La asignación ya está cerrada');

    return sequelize.transaction(async (transaction) => {
      asignacion.activo = false;
      asignacion.fecha_devolucion = fecha_devolucion || hoyISO();
      await asignacion.save({ transaction });

      await Inventario.update(
        { estado: 'disponible' },
        { where: { id: asignacion.inventario_id, estado: 'en_uso' }, transaction }
      );

      return asignacion;
    });
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

  /**
   * Asignaciones activas de celulares/notebooks de una persona.
   * @returns {Promise<Array<{ asignacion, inventario, tipoEquipo }>>}
   */
  async asignacionesPersonalesActivas(personalId, { transaction } = {}) {
    const asignaciones = await AsignacionInventario.findAll({
      where: { personal_id: personalId, activo: true },
      include: [{
        model: Inventario,
        as: 'inventario',
        required: true,
        include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['id', 'nombre'] }]
      }],
      transaction
    });

    return asignaciones
      .map(asignacion => ({
        asignacion,
        inventario: asignacion.inventario,
        tipoEquipo: tipoEquipoPersonalDeArticulo(asignacion.inventario.tipoArticulo?.nombre)
      }))
      .filter(e => e.tipoEquipo);
  }

  /**
   * Indica si un artículo es un equipo personal con asignación activa.
   */
  async tieneAsignacionPersonalActiva(inventarioId) {
    const asignacion = await AsignacionInventario.findOne({
      where: { inventario_id: inventarioId, activo: true },
      include: [{
        model: Inventario,
        as: 'inventario',
        include: [{ model: TipoArticulo, as: 'tipoArticulo', attributes: ['nombre'] }]
      }]
    });
    return !!(asignacion && tipoEquipoPersonalDeArticulo(asignacion.inventario?.tipoArticulo?.nombre));
  }

  /**
   * Calcula qué pasaría con los equipos personales si la persona pasa a sedeNuevaId.
   * No modifica nada: sirve para la vista previa y como base de trasladarEquipos.
   */
  async calcularTraslado(personalId, sedeNuevaId, { transaction } = {}) {
    const asignados = await this.asignacionesPersonalesActivas(personalId, { transaction });
    const inventarioIds = asignados.map(a => a.inventario.id);

    const detallesActivos = inventarioIds.length === 0 ? [] : await RemitoDetalle.findAll({
      where: { inventario_id: { [Op.in]: inventarioIds } },
      include: [{
        model: Remito,
        as: 'remito',
        required: true,
        where: { estado: { [Op.in]: ESTADOS_REMITO_ACTIVOS } },
        include: [{ model: RemitoDetalle, as: 'detalles', attributes: ['id', 'inventario_id'] }]
      }],
      transaction
    });

    const equipos = asignados.map(({ asignacion, inventario, tipoEquipo }) => ({
      asignacion_id: asignacion.id,
      inventario_id: inventario.id,
      tipo: tipoEquipo,
      descripcion: descripcionEquipo(inventario),
      sede_id: inventario.sede_id,
      remitosActivos: detallesActivos
        .filter(d => d.inventario_id === inventario.id)
        .map(d => d.remito)
    }));

    const plan = planificarTraslado(equipos, sedeNuevaId);
    return { equipos, plan };
  }

  /**
   * Vista previa del traslado en formato para la API.
   */
  async previsualizarTraslado(personalId, sedeNuevaId) {
    const { equipos, plan } = await this.calcularTraslado(personalId, sedeNuevaId);
    const accionDe = (equipo) => {
      if (plan.bloqueos.some(b => b.inventario_id === equipo.inventario_id)) return 'bloqueado';
      if (plan.mover.includes(equipo)) return 'mover';
      if (plan.sinCambios.includes(equipo)) return 'sin_cambios';
      return 'redirigir_remito';
    };

    return {
      equipos: equipos.map(e => ({
        inventario_id: e.inventario_id,
        tipo: e.tipo,
        descripcion: e.descripcion,
        accion: accionDe(e),
        remitos: e.remitosActivos.map(r => ({ id: r.id, numero_remito: r.numero_remito, estado: r.estado }))
      })),
      bloqueos: plan.bloqueos,
      puedeTrasladar: plan.bloqueos.length === 0
    };
  }

  /**
   * Mueve los celulares/notebooks asignados a la persona a su sede nueva.
   * Debe llamarse dentro de la transacción que cambia la sede de la persona:
   * si hay un bloqueo (remito en tránsito, etc.) lanza error y todo se revierte.
   *
   * - Equipo sin remito activo: se actualiza su sede + historial.
   * - Equipo en remito borrador/preparado: el remito se redirige a la sede nueva.
   *
   * @returns {Promise<Object[]>} equipos trasladados / remitos redirigidos
   */
  async trasladarEquipos(persona, sedeNuevaId, { transaction, usuarioEmail, usuarioId = null, origen = 'cambio_sede' }) {
    if (!sedeNuevaId) return [];

    const { plan } = await this.calcularTraslado(persona.id, sedeNuevaId, { transaction });

    if (plan.bloqueos.length > 0) {
      throw conStatus(
        `No se puede cambiar la sede: ${[...new Set(plan.bloqueos.map(b => b.motivo))].join(' ')}`,
        409
      );
    }

    const nombrePersona = `${persona.nombre} ${persona.apellido}`;
    const resultado = [];

    for (const equipo of plan.mover) {
      await Inventario.update({ sede_id: sedeNuevaId }, { where: { id: equipo.inventario_id }, transaction });
      await HistorialMovimiento.create({
        inventario_id: equipo.inventario_id,
        sede_origen_id: equipo.sede_id,
        sede_destino_id: sedeNuevaId,
        tipo_movimiento: 'transferencia',
        fecha_movimiento: new Date(),
        usuario_id: usuarioId,
        observaciones: `Traslado con la persona ${nombrePersona} (cambio de sede)`
      }, { transaction });
      resultado.push({ accion: 'mover', inventario_id: equipo.inventario_id, tipo: equipo.tipo, descripcion: equipo.descripcion, sede_origen_id: equipo.sede_id, sede_destino_id: sedeNuevaId });
    }

    for (const remito of plan.redirigir) {
      const destinoAnterior = remito.sede_destino_id;
      await Remito.update(
        {
          sede_destino_id: sedeNuevaId,
          observaciones: [remito.observaciones, `Destino cambiado por traslado de ${nombrePersona}`].filter(Boolean).join(' | ')
        },
        { where: { id: remito.id }, transaction }
      );

      // Los remitos creados a mano ya ubican el equipo en el destino al crearse:
      // en ese caso el equipo también pasa a la sede nueva.
      for (const detalle of remito.detalles) {
        await Inventario.update(
          { sede_id: sedeNuevaId },
          { where: { id: detalle.inventario_id, sede_id: destinoAnterior }, transaction }
        );
      }
      resultado.push({ accion: 'redirigir_remito', remito_id: remito.id, numero_remito: remito.numero_remito, sede_destino_anterior_id: destinoAnterior, sede_destino_id: sedeNuevaId });
    }

    if (resultado.length > 0) {
      transaction.afterCommit(() => this.registrarTrasladoPostCommit(persona, resultado, { usuarioEmail, usuarioId, origen }));
    }

    logger.info('Equipos trasladados con la persona:', { personalId: persona.id, sedeNuevaId, origen, resultado });
    return resultado;
  }

  /**
   * Auditoría y regeneración de PDFs de remitos redirigidos (best effort, post-commit).
   */
  async registrarTrasladoPostCommit(persona, resultado, { usuarioEmail, usuarioId, origen }) {
    for (const item of resultado) {
      await AuditService.registrarAccion({
        usuario_email: usuarioEmail || 'sistema@megatlon.com.ar',
        usuario_id: usuarioId,
        modulo: 'asignaciones',
        accion: item.accion === 'mover' ? 'trasladar_equipo' : 'redirigir_remito',
        recurso: item.accion === 'mover' ? 'Inventario' : 'Remito',
        recurso_id: item.inventario_id || item.remito_id,
        descripcion: item.accion === 'mover'
          ? `${item.descripcion} trasladado con ${persona.nombre} ${persona.apellido} (${origen})`
          : `Remito ${item.numero_remito} redirigido por traslado de ${persona.nombre} ${persona.apellido} (${origen})`,
        valores_nuevos: item
      });
    }

    const remitosRedirigidos = resultado.filter(r => r.accion === 'redirigir_remito');
    if (remitosRedirigidos.length === 0) return;

    try {
      const { default: remitoService } = await import('../../remitos/services/remitoService.js');
      const { default: pdfService } = await import('../../../shared/services/pdfService.js');
      for (const { remito_id } of remitosRedirigidos) {
        const remito = await remitoService.obtener(remito_id);
        const remitoJSON = remito.toJSON();
        remitoJSON.es_prestamo = remito.es_prestamo;
        await pdfService.generarPDF(remitoJSON, { confirmado: false });
      }
    } catch (err) {
      logger.error('No se pudo regenerar el PDF de un remito redirigido:', { error: err.message });
    }
  }
}

export default new AsignacionInventarioService();
