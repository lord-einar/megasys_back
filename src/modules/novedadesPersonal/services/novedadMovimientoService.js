// src/modules/novedadesPersonal/services/novedadMovimientoService.js
import {
  NovedadMovimientoPersonal,
  Personal,
  Sede,
  sequelize
} from '../../../models/index.js';
import asignacionInventarioService from '../../asignaciones/services/asignacionInventarioService.js';
import logger from '../../../shared/utils/logger.js';

const conStatus = (mensaje, statusCode) => Object.assign(new Error(mensaje), { statusCode });

const INCLUDES = [
  { model: Personal, as: 'personal', attributes: ['id', 'nombre', 'apellido', 'email', 'sede_id', 'activo'] },
  { model: Sede, as: 'sedeAnterior', attributes: ['id', 'nombre_sede'] },
  { model: Sede, as: 'sedeNueva', attributes: ['id', 'nombre_sede'] },
  { model: Personal, as: 'resueltoPor', attributes: ['id', 'nombre', 'apellido'] }
];

class NovedadMovimientoService {
  /**
   * Registra un cambio de sede detectado por la sincronización con Entra ID.
   * Si la persona ya tenía una novedad pendiente se actualiza (se conserva la
   * sede de partida); si volvió a su sede original, la novedad se descarta sola.
   */
  async registrar({ personalId, sedeAnteriorId, sedeNuevaId, origen = 'entra_sync' }) {
    const pendiente = await NovedadMovimientoPersonal.findOne({
      where: { personal_id: personalId, estado: 'pendiente' }
    });

    if (pendiente) {
      if (pendiente.sede_anterior_id === sedeNuevaId) {
        await pendiente.update({
          estado: 'descartada',
          resuelto_en: new Date(),
          observaciones: 'Descartada automáticamente: la persona volvió a su sede anterior'
        });
      } else {
        await pendiente.update({ sede_nueva_id: sedeNuevaId });
      }
      return pendiente;
    }

    return NovedadMovimientoPersonal.create({
      personal_id: personalId,
      sede_anterior_id: sedeAnteriorId,
      sede_nueva_id: sedeNuevaId,
      origen
    });
  }

  async contarPendientes() {
    return NovedadMovimientoPersonal.count({ where: { estado: 'pendiente' } });
  }

  /**
   * Lista novedades. Las pendientes incluyen la vista previa de qué pasará con
   * los equipos asignados al confirmar.
   */
  async listar({ estado = 'pendiente', limit = 100 } = {}) {
    const where = estado === 'todas' ? {} : { estado };
    const novedades = await NovedadMovimientoPersonal.findAll({
      where,
      include: INCLUDES,
      order: [['created_at', 'DESC']],
      limit
    });

    return Promise.all(novedades.map(async (novedad) => {
      const json = novedad.toJSON();
      if (novedad.estado !== 'pendiente') return json;

      json.desactualizada = novedad.personal?.sede_id !== novedad.sede_nueva_id;
      json.sinSedeNueva = !novedad.sede_nueva_id;
      json.traslado = novedad.sede_nueva_id
        ? await asignacionInventarioService.previsualizarTraslado(novedad.personal_id, novedad.sede_nueva_id)
        : { equipos: [], bloqueos: [], puedeTrasladar: false };
      return json;
    }));
  }

  /**
   * Confirma la novedad: traslada los equipos asignados a la sede nueva.
   */
  async confirmar(id, actor) {
    const resultado = await sequelize.transaction(async (transaction) => {
      const novedad = await NovedadMovimientoPersonal.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!novedad) throw conStatus('Novedad no encontrada', 404);
      if (novedad.estado !== 'pendiente') throw conStatus(`La novedad ya fue ${novedad.estado}`, 400);
      if (!novedad.sede_nueva_id) {
        throw conStatus('La sincronización dejó a la persona sin sede: no hay a dónde mover los equipos. Descartá la novedad o corregí la sede de la persona.', 400);
      }

      const persona = await Personal.findByPk(novedad.personal_id, { transaction });
      if (persona.sede_id !== novedad.sede_nueva_id) {
        throw conStatus('La sede de la persona cambió después de esta novedad. Descartala y revisá la ficha de la persona.', 409);
      }

      const equipos = await asignacionInventarioService.trasladarEquipos(persona, novedad.sede_nueva_id, {
        transaction,
        usuarioEmail: actor?.email,
        usuarioId: actor?.id,
        origen: 'novedad_entra_id'
      });

      await novedad.update({
        estado: 'confirmada',
        equipos_trasladados: equipos,
        resuelto_por_id: actor?.id || null,
        resuelto_en: new Date()
      }, { transaction });

      return novedad;
    });

    logger.info('Novedad de movimiento confirmada:', { id, actor: actor?.email });
    return NovedadMovimientoPersonal.findByPk(resultado.id, { include: INCLUDES });
  }

  async descartar(id, actor, observaciones = null) {
    const novedad = await NovedadMovimientoPersonal.findByPk(id);
    if (!novedad) throw conStatus('Novedad no encontrada', 404);
    if (novedad.estado !== 'pendiente') throw conStatus(`La novedad ya fue ${novedad.estado}`, 400);

    await novedad.update({
      estado: 'descartada',
      resuelto_por_id: actor?.id || null,
      resuelto_en: new Date(),
      observaciones: observaciones || 'Descartada sin mover equipos'
    });

    logger.info('Novedad de movimiento descartada:', { id, actor: actor?.email });
    return NovedadMovimientoPersonal.findByPk(id, { include: INCLUDES });
  }

  /**
   * Cierra las novedades pendientes de una persona cuya sede se cambió a mano
   * (ese cambio ya trasladó los equipos).
   */
  async cerrarPorCambioManual(personalId, { transaction, usuarioEmail } = {}) {
    await NovedadMovimientoPersonal.update(
      {
        estado: 'descartada',
        resuelto_en: new Date(),
        observaciones: `Resuelta por cambio manual de sede${usuarioEmail ? ` (${usuarioEmail})` : ''}`
      },
      { where: { personal_id: personalId, estado: 'pendiente' }, transaction }
    );
  }
}

export default new NovedadMovimientoService();
