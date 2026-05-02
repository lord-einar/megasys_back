// src/modules/solicitudesCompra/services/solicitudCompraNotificationService.js
import { Personal } from '../../../models/index.js';
import emailService from '../../../shared/services/emailService.js';
import logger from '../../../shared/utils/logger.js';

const GROUP_TO_PRIVILEGIO = {
  infraestructura: 'super_admin',
  rrhh: 'rrhh',
  compras: 'compras'
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

class SolicitudCompraNotificationService {
  async obtenerDestinatarios(grupo) {
    const privilegio = GROUP_TO_PRIVILEGIO[grupo];
    if (!privilegio) return [];

    const usuarios = await Personal.findAll({
      where: { activo: true, privilegio_app: privilegio },
      attributes: ['email']
    });

    return [...new Set(usuarios.map(u => u.email).filter(Boolean))];
  }

  buildHtml(solicitud, titulo, mensaje) {
    const codigo = solicitud.getCodigo ? solicitud.getCodigo() : `SC-${String(solicitud.numero).padStart(4, '0')}`;
    const beneficiario = solicitud.beneficiario
      ? `${solicitud.beneficiario.nombre} ${solicitud.beneficiario.apellido}`
      : 'No disponible';
    const equipo = solicitud.catalogoEquipo
      ? `${solicitud.catalogoEquipo.marca} ${solicitud.catalogoEquipo.modelo}`
      : 'Pendiente de definición';
    const url = `${FRONTEND_URL}/solicitudes-compra/${solicitud.id}`;

    return `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2>${titulo}</h2>
        <p>${mensaje}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Solicitud</strong></td><td>${codigo}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Tipo</strong></td><td>${solicitud.tipo_equipo}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Motivo</strong></td><td>${solicitud.motivo}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Beneficiario</strong></td><td>${beneficiario}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Equipo sugerido</strong></td><td>${equipo}</td></tr>
        </table>
        <p><a href="${url}" style="color: #2563eb;">Ver solicitud en Portal IT</a></p>
      </div>
    `;
  }

  async enviar(grupo, solicitud, titulo, mensaje) {
    try {
      const destinatarios = await this.obtenerDestinatarios(grupo);
      if (destinatarios.length === 0) {
        logger.warn('SolicitudCompra: sin destinatarios para notificación', { grupo, solicitudId: solicitud.id });
        return { sent: false, destinatarios: [] };
      }

      const html = this.buildHtml(solicitud, titulo, mensaje);
      await emailService.enviarEmail(destinatarios, titulo, html);
      logger.info('SolicitudCompra: notificación enviada', { grupo, solicitudId: solicitud.id, destinatarios });
      return { sent: true, destinatarios };
    } catch (err) {
      logger.error('SolicitudCompra: error enviando notificación', {
        grupo,
        solicitudId: solicitud?.id,
        error: err.message
      });
      return { sent: false, error: err.message };
    }
  }

  async enviarEmails(destinatarios, solicitud, titulo, mensaje) {
    try {
      const emails = [...new Set(destinatarios.filter(Boolean))];
      if (emails.length === 0) return { sent: false, destinatarios: [] };
      await emailService.enviarEmail(emails, titulo, this.buildHtml(solicitud, titulo, mensaje));
      return { sent: true, destinatarios: emails };
    } catch (err) {
      logger.error('SolicitudCompra: error enviando notificación directa', {
        solicitudId: solicitud?.id,
        error: err.message
      });
      return { sent: false, error: err.message };
    }
  }

  async notificarCreada(solicitud) {
    return this.enviar(
      'infraestructura',
      solicitud,
      `Nueva solicitud de compra ${solicitud.getCodigo()}`,
      'Se cargó una nueva solicitud de compra pendiente de análisis técnico de Infraestructura.'
    );
  }

  async notificarAprobadaInfra(solicitud) {
    return this.enviar(
      'rrhh',
      solicitud,
      `Solicitud aprobada por Infraestructura ${solicitud.getCodigo()}`,
      'Infraestructura aprobó técnicamente la solicitud. Queda pendiente la aprobación de Recursos Humanos.'
    );
  }

  async notificarAprobadaRrhh(solicitud) {
    return this.enviar(
      'compras',
      solicitud,
      `Solicitud aprobada para compra ${solicitud.getCodigo()}`,
      'Infraestructura y Recursos Humanos aprobaron la solicitud. Compras puede proceder con el pedido.'
    );
  }

  async notificarEntregadoSistemas(solicitud) {
    return this.enviar(
      'infraestructura',
      solicitud,
      `Equipo entregado a Sistemas ${solicitud.getCodigo()}`,
      'Compras entregó el equipo a Sistemas. Por favor cargá el IMEI o número de serie y finalizá la solicitud.'
    );
  }

  async notificarRechazada(solicitud) {
    const actorGrupo = solicitud.historial?.[solicitud.historial.length - 1]?.actor_grupo;
    const destinatarios = [solicitud.solicitante?.email];

    if (actorGrupo === 'rrhh') {
      const infra = await this.obtenerDestinatarios('infraestructura');
      destinatarios.push(...infra);
    }

    return this.enviarEmails(
      destinatarios,
      solicitud,
      `Solicitud rechazada ${solicitud.getCodigo()}`,
      `La solicitud fue rechazada. Motivo: ${solicitud.rechazo_motivo || 'No informado'}.`
    );
  }
}

export default new SolicitudCompraNotificationService();
