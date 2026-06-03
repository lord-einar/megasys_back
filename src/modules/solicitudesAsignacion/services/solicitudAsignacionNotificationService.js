import { Personal } from '../../../models/index.js';
import emailService from '../../../shared/services/emailService.js';
import logger from '../../../shared/utils/logger.js';

const GROUP_TO_PRIVILEGIO = {
  infraestructura: 'super_admin',
  rrhh: 'rrhh',
  compras: 'compras'
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

class SolicitudAsignacionNotificationService {
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
    const codigo = solicitud.getCodigo ? solicitud.getCodigo() : `SA-${String(solicitud.numero).padStart(4, '0')}`;
    const beneficiario = solicitud.beneficiario
      ? `${solicitud.beneficiario.nombre} ${solicitud.beneficiario.apellido}`
      : 'No disponible';
    const equipo = solicitud.inventarioAsignado
      ? `${solicitud.inventarioAsignado.marca} ${solicitud.inventarioAsignado.modelo}`
      : 'Pendiente de asignación';
    const url = `${FRONTEND_URL}/solicitudes-asignacion/${solicitud.id}`;

    return `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2>${titulo}</h2>
        <p>${mensaje}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Solicitud</strong></td><td>${codigo}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Tipo</strong></td><td>${solicitud.tipo_equipo}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Motivo</strong></td><td>${(solicitud.motivo || '').replaceAll('_', ' ')}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Beneficiario</strong></td><td>${beneficiario}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Equipo asignado</strong></td><td>${equipo}</td></tr>
        </table>
        <p><a href="${url}" style="color: #2563eb;">Ver solicitud en Portal IT</a></p>
      </div>
    `;
  }

  async enviar(grupo, solicitud, titulo, mensaje) {
    try {
      const destinatarios = await this.obtenerDestinatarios(grupo);
      if (!destinatarios.length) {
        logger.warn('SolicitudAsignacion: sin destinatarios para notificación', { grupo, solicitudId: solicitud.id });
        return { sent: false, destinatarios: [] };
      }
      const html = this.buildHtml(solicitud, titulo, mensaje);
      await emailService.enviarEmail(destinatarios, titulo, html);
      logger.info('SolicitudAsignacion: notificación enviada', { grupo, solicitudId: solicitud.id, destinatarios });
      return { sent: true, destinatarios };
    } catch (err) {
      logger.error('SolicitudAsignacion: error enviando notificación', {
        grupo, solicitudId: solicitud?.id, error: err.message
      });
      return { sent: false, error: err.message };
    }
  }

  async enviarEmails(emails, solicitud, titulo, mensaje) {
    try {
      const destinatarios = [...new Set(emails.filter(Boolean))];
      if (!destinatarios.length) return { sent: false };
      await emailService.enviarEmail(destinatarios, titulo, this.buildHtml(solicitud, titulo, mensaje));
      return { sent: true, destinatarios };
    } catch (err) {
      logger.error('SolicitudAsignacion: error enviando email directo', { error: err.message });
      return { sent: false, error: err.message };
    }
  }

  async notificarCreada(solicitud) {
    return this.enviar(
      'infraestructura',
      solicitud,
      `Nueva solicitud de asignación ${solicitud.getCodigo()}`,
      'Se cargó una nueva solicitud de asignación pendiente de revisión técnica por Infraestructura.'
    );
  }

  async notificarAprobadaRrhh(solicitud) {
    const [compras, infra] = await Promise.all([
      this.obtenerDestinatarios('compras'),
      this.obtenerDestinatarios('infraestructura')
    ]);
    const destinatarios = [...new Set([...compras, ...infra])];
    return this.enviarEmails(
      destinatarios,
      solicitud,
      `Solicitud aprobada — preparar equipo ${solicitud.getCodigo()}`,
      'RRHH aprobó la solicitud. Infraestructura debe preparar el equipo y generar el remito de entrega.'
    );
  }

  async notificarRechazada(solicitud) {
    const destinatarios = [solicitud.solicitante?.email].filter(Boolean);
    return this.enviarEmails(
      destinatarios,
      solicitud,
      `Solicitud rechazada ${solicitud.getCodigo()}`,
      `La solicitud fue rechazada. Motivo: ${solicitud.rechazo_motivo || 'No informado'}.`
    );
  }

  async notificarCancelada(solicitud) {
    const [infra, rrhh, compras] = await Promise.all([
      this.obtenerDestinatarios('infraestructura'),
      this.obtenerDestinatarios('rrhh'),
      this.obtenerDestinatarios('compras')
    ]);
    const destinatarios = [solicitud.solicitante?.email, ...infra, ...rrhh, ...compras];
    return this.enviarEmails(
      destinatarios,
      solicitud,
      `Solicitud cancelada ${solicitud.getCodigo()}`,
      `La solicitud fue cancelada. Motivo: ${solicitud.cancelacion_motivo || 'No informado'}.`
    );
  }
}

export default new SolicitudAsignacionNotificationService();
