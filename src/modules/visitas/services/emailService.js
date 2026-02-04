import emailService from '../../../shared/services/emailService.js';
import logger from '../../../shared/utils/logger.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

class VisitaEmailService {

  /**
   * Generar HTML para recordatorio de visita
   */
  _generarHTMLRecordatorio(visita) {
    const linkSolicitudes = `${FRONTEND_URL}/visitas/solicitar?token=${visita.token_solicitudes}`;
    const fecha = new Date(visita.fecha).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #0066cc; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
          .label { font-weight: bold; color: #555; }
          .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 24px;">📅 Visita de Soporte Programada</h1>
          </div>
          <div class="content">
            <p>Hola,</p>
            <p>Te recordamos que mañana <strong>${fecha}</strong> tendremos una visita de soporte en <strong>${visita.sedePrincipal.nombre_sede}</strong>.</p>
            
            <div class="info-row">
              <span class="label">Técnico asignado:</span> ${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}
            </div>
            <div class="info-row">
              <span class="label">Tipo de visita:</span> ${visita.tipo.toUpperCase()}
            </div>
            <div class="info-row">
              <span class="label">Motivo:</span> ${visita.motivo || (visita.es_recurrente ? 'Visita periódica preventiva' : 'No especificado')}
            </div>

            <p style="margin-top: 30px;">
              <strong>¿Tienes algún pedido para la visita?</strong><br>
              Si hay algo que necesites que el técnico revise o resuelva durante la visita, por favor ingresa tu solicitud haciendo click en el siguiente botón:
            </p>

            <div style="text-align: center;">
              <a href="${linkSolicitudes}" class="button">
                Agregar Solicitud
              </a>
            </div>

            <p style="font-size: 12px; color: #666; margin-top: 20px; background: #eef; padding: 10px; border-radius: 4px;">
              <strong>Importante:</strong> Recuerda crear un caso en el sistema de tickets para todas las solicitudes.
            </p>

            <p style="margin-top: 30px;">
              Saludos,<br>
              <strong>Equipo de Infraestructura</strong>
            </p>
          </div>
          <div class="footer">
            Este es un mensaje automático del Sistema de Gestión Megatlon.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generar HTML para minuta post-visita
   */
  _generarHTMLMinuta(visita, informe) {
    const fecha = new Date(visita.fecha).toLocaleDateString('es-AR');

    // Checklist items
    const checklistHTML = informe.checklist_items.map(item => `
      <div style="padding: 8px; margin: 5px 0; background-color: white; border-radius: 4px; border-left: 3px solid ${item.completado ? '#28a745' : '#dc3545'};">
        ${item.completado ? '✅' : '❌'} ${item.nombre}
      </div>
    `).join('');

    // Checklist extra
    const extraHTML = (informe.checklist_extra || []).map(item => `
      <div style="padding: 8px; margin: 5px 0; background-color: white; border-radius: 4px; border-left: 3px solid ${item.completado ? '#28a745' : '#dc3545'};">
        ${item.completado ? '✅' : '❌'} ${item.nombre} (Adicional)
      </div>
    `).join('');

    // Problemas resueltos
    const problemasHTML = (informe.problemasResueltos || []).map(p => `
      <div style="padding: 15px; margin: 10px 0; background-color: white; border-radius: 4px; border: 1px solid #eee;">
        <strong>${p.descripcion}</strong>
        <br>
        <span style="display: inline-block; padding: 2px 8px; background-color: #007bff; color: white; border-radius: 3px; font-size: 11px; margin-top: 5px;">${p.categoria}</span>
        ${p.causado_por_usuario ? '<span style="color: #dc3545; font-weight: bold; font-size: 11px; margin-left: 10px;">👤 Causado por usuario</span>' : ''}
      </div>
    `).join('');

    // Solicitudes atendidas
    const solicitudesHTML = (visita.solicitudesPrevias || []).filter(s => s.resuelta).map(s => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px;">${s.solicitante_nombre}</td>
        <td style="padding: 8px;">${s.descripcion}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .section { margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-left: 4px solid #28a745; }
          .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #eee; text-align: left; padding: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">✅ Minuta de Visita de Soporte</h1>
            <p style="margin:5px 0 0 0;">${fecha} - ${visita.sedePrincipal.nombre_sede}</p>
          </div>

          <div class="section">
            <div class="section-title">📋 Información General</div>
            <table>
              <tr><th width="30%">Fecha:</th><td>${fecha}</td></tr>
              <tr><th>Sede:</th><td>${visita.sedePrincipal.nombre_sede}</td></tr>
              <tr><th>Técnico:</th><td>${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}</td></tr>
              <tr><th>Tipo:</th><td>${visita.tipo}</td></tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">✓ Checklist de Control</div>
            ${checklistHTML}
            ${extraHTML}
          </div>

          ${(informe.casos_resueltos && informe.casos_resueltos.length > 0) ? `
          <div class="section">
            <div class="section-title">🎫 Casos/Tickets Resueltos</div>
            <ul style="list-style-type: disc; padding-left: 25px; margin: 10px 0;">
              ${informe.casos_resueltos.map(c => `<li style="padding: 5px 0;"><strong style="color: #7c3aed; font-size: 15px;">${c}</strong></li>`).join('')}
            </ul>
          </div>` : ''}

          ${(informe.problemasResueltos && informe.problemasResueltos.length > 0) ? `
          <div class="section">
            <div class="section-title">🔧 Problemas Resueltos</div>
            ${problemasHTML}
          </div>` : ''}

          ${(visita.solicitudesPrevias && visita.solicitudesPrevias.some(s => s.resuelta)) ? `
          <div class="section">
            <div class="section-title">📝 Solicitudes Atendidas</div>
            <table>
              <thead><tr><th>Solicitante</th><th>Descripción</th></tr></thead>
              <tbody>${solicitudesHTML}</tbody>
            </table>
          </div>` : ''}

          ${informe.observaciones ? `
          <div class="section">
            <div class="section-title">💬 Observaciones del Técnico</div>
            <p>${informe.observaciones}</p>
          </div>` : ''}

          ${informe.comentarios_responsable_sede ? `
          <div class="section">
            <div class="section-title">💭 Comentarios del Responsable de Sede</div>
            <p style="font-style: italic; background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">${informe.comentarios_responsable_sede}</p>
          </div>` : ''}

          <!-- Botón de Feedback -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <h3 style="color: white; margin: 0 0 15px 0; font-size: 20px;">💬 ¿Cómo fue la visita?</h3>
            <p style="color: white; margin: 0 0 20px 0; font-size: 14px;">Tu opinión es importante para nosotros. Tienes 2 días para agregar comentarios sobre esta visita.</p>
            <a href="${FRONTEND_URL}/visitas/feedback/${visita.token_feedback}"
               style="display: inline-block; padding: 14px 32px; background-color: white; color: #667eea; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              Agregar Comentarios
            </a>
          </div>

          <div style="text-align: center; margin-top: 40px; color: #666; font-size: 12px;">
            <p>Este es un resumen automático generado por el Sistema de Gestión Megatlon</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar recordatorio de visita a personal de la sede
   */
  async enviarRecordatorio(visita, emailsDestino) {
    try {
      const html = this._generarHTMLRecordatorio(visita);
      const asunto = `Recordatorio: Visita de Soporte mañana ${new Date(visita.fecha).toLocaleDateString('es-AR')}`;

      // Enviar individualmente o en copia oculta
      // Para simplificar, usamos el servicio genérico que envía uno a uno si es un array?
      // El servicio genérico toma un string. Haremos un loop o enviaremos a todos en CCO.

      // Mejor enviar uno por uno para evitar exponer emails si no es deseado, 
      // o usar un grupo de distribución si existe.
      // Aquí asumimos que emailsDestino es un array de strings.

      const promesas = emailsDestino.map(email =>
        emailService.enviarEmailHTML(email, asunto, html)
      );

      await Promise.all(promesas);

      logger.info(`Recordatorios enviados para visita ${visita.id} a ${emailsDestino.length} destinatarios`);
      return true;
    } catch (error) {
      logger.error('Error enviando recordatorios:', error);
      throw error;
    }
  }

  /**
   * Enviar minuta post-visita
   */
  async enviarMinuta(visita, informe, emailsSede) {
    try {
      const html = this._generarHTMLMinuta(visita, informe);
      const asunto = `Minuta de Visita - ${visita.sedePrincipal.nombre_sede} - ${new Date(visita.fecha).toLocaleDateString('es-AR')}`;

      const destinatarios = [
        process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar',
        ...emailsSede
      ];

      // Eliminar duplicados y filtrar emails vacíos
      const uniqueDestinatarios = [...new Set(destinatarios)].filter(e => e && e.trim());

      // Enviar UN SOLO email con múltiples destinatarios (evita error 429 de Microsoft)
      await emailService.enviarEmailHTML(uniqueDestinatarios, asunto, html);

      logger.info(`✅ Minuta enviada para visita ${visita.id} a ${uniqueDestinatarios.length} destinatarios`);
      return true;
    } catch (error) {
      logger.error('Error enviando minuta:', error);
      throw error;
    }
  }
  /**
   * Alias para enviar aviso (mismo que recordatorio)
   */
  async enviarAviso(visita, emailsDestino) {
    return this.enviarRecordatorio(visita, emailsDestino);
  }

  /**
   * Enviar notificación cuando el responsable de sede agrega comentarios
   */
  async enviarNotificacionComentarios(visita, datos, destinatarios) {
    try {
      const fecha = new Date(visita.fecha).toLocaleDateString('es-AR');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .info-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .comentario-box { background: #fef3c7; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #f59e0b; }
            .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
            .label { font-weight: bold; color: #555; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0; font-size: 24px;">💭 Nuevo Comentario del Responsable de Sede</h1>
            </div>
            <div class="content">
              <p>Se agregaron comentarios sobre la visita de soporte:</p>

              <div class="info-box">
                <p><span class="label">Sede:</span> ${visita.sedePrincipal.nombre_sede}</p>
                <p><span class="label">Fecha de visita:</span> ${fecha}</p>
                <p><span class="label">Técnico:</span> ${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}</p>
              </div>

              <div class="comentario-box">
                <p style="margin: 0 0 10px 0;"><strong>Comentarios de ${datos.nombre}:</strong></p>
                <p style="margin: 0; font-style: italic; line-height: 1.6;">${datos.comentarios}</p>
              </div>

              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                Estos comentarios se agregaron a la minuta de la visita y están disponibles en el historial.
              </p>
            </div>
            <div class="footer">
              Este es un mensaje automático del Sistema de Gestión Megatlon.
            </div>
          </div>
        </body>
        </html>
      `;

      const asunto = `💭 Comentarios recibidos - Visita ${visita.sedePrincipal.nombre_sede}`;

      const uniqueDestinatarios = [...new Set(destinatarios)];

      const promesas = uniqueDestinatarios.map(email =>
        emailService.enviarEmailHTML(email, asunto, html)
      );

      await Promise.all(promesas);

      logger.info(`Notificación de comentarios enviada para visita ${visita.id} a ${uniqueDestinatarios.length} destinatarios`);
      return true;
    } catch (error) {
      logger.error('Error enviando notificación de comentarios:', error);
      throw error;
    }
  }

  /**
   * Enviar notificación de cancelación de visita
   */
  async enviarNotificacionCancelacion(visita, motivo, emailsDestino) {
    try {
      const fecha = new Date(visita.fecha).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
            .label { font-weight: bold; color: #555; }
            .motivo-box { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #ffc107; }
            .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0; font-size: 24px;">❌ Visita Cancelada</h1>
            </div>
            <div class="content">
              <p>Te informamos que la visita de soporte programada ha sido <strong>cancelada</strong>.</p>

              <div class="info-row">
                <span class="label">Sede:</span> ${visita.sedePrincipal?.nombre_sede || 'N/A'}
              </div>
              <div class="info-row">
                <span class="label">Fecha programada:</span> ${fecha}
              </div>
              <div class="info-row">
                <span class="label">Tipo de visita:</span> ${visita.tipo?.toUpperCase() || 'N/A'}
              </div>
              ${visita.tecnicoAsignado ? `
              <div class="info-row">
                <span class="label">Técnico asignado:</span> ${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}
              </div>` : ''}

              ${motivo ? `
              <div class="motivo-box">
                <strong>Motivo de cancelación:</strong><br>
                ${motivo}
              </div>` : ''}

              <p style="margin-top: 20px;">
                Si tienes alguna consulta, por favor contacta al equipo de infraestructura.
              </p>

              <p style="margin-top: 30px;">
                Saludos,<br>
                <strong>Equipo de Infraestructura</strong>
              </p>
            </div>
            <div class="footer">
              Este es un mensaje automático del Sistema de Gestión Megatlon.
            </div>
          </div>
        </body>
        </html>
      `;

      const asunto = `Visita Cancelada - ${visita.sedePrincipal?.nombre_sede || 'Sede'} - ${new Date(visita.fecha).toLocaleDateString('es-AR')}`;

      const promesas = emailsDestino.map(email =>
        emailService.enviarEmailHTML(email, asunto, html)
      );

      await Promise.all(promesas);

      logger.info(`Notificación de cancelación enviada para visita ${visita.id} a ${emailsDestino.length} destinatarios`);
      return true;
    } catch (error) {
      logger.error('Error enviando notificación de cancelación:', error);
      throw error;
    }
  }

  /**
   * Enviar notificación de reprogramación de visita
   */
  async enviarNotificacionReprogramacion(visita, fechaAnterior, nuevaFecha, emailsDestino) {
    try {
      const fechaAnteriorStr = new Date(fechaAnterior).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const nuevaFechaStr = new Date(nuevaFecha).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
            .label { font-weight: bold; color: #555; }
            .fecha-box { display: flex; align-items: center; justify-content: center; margin: 20px 0; }
            .fecha-old { background: #fee2e2; padding: 15px 20px; border-radius: 6px; text-decoration: line-through; color: #991b1b; }
            .fecha-arrow { font-size: 24px; margin: 0 15px; color: #666; }
            .fecha-new { background: #d1fae5; padding: 15px 20px; border-radius: 6px; color: #065f46; font-weight: bold; }
            .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0; font-size: 24px;">📅 Visita Reprogramada</h1>
            </div>
            <div class="content">
              <p>Te informamos que la visita de soporte ha sido <strong>reprogramada</strong>.</p>

              <div class="info-row">
                <span class="label">Sede:</span> ${visita.sedePrincipal?.nombre_sede || 'N/A'}
              </div>
              ${visita.tecnicoAsignado ? `
              <div class="info-row">
                <span class="label">Técnico asignado:</span> ${visita.tecnicoAsignado.nombre} ${visita.tecnicoAsignado.apellido}
              </div>` : ''}

              <div class="fecha-box">
                <div class="fecha-old">${fechaAnteriorStr}</div>
                <div class="fecha-arrow">➜</div>
                <div class="fecha-new">${nuevaFechaStr}</div>
              </div>

              <p style="margin-top: 20px;">
                Por favor, ten en cuenta la nueva fecha para tu planificación.
              </p>

              <p style="margin-top: 30px;">
                Saludos,<br>
                <strong>Equipo de Infraestructura</strong>
              </p>
            </div>
            <div class="footer">
              Este es un mensaje automático del Sistema de Gestión Megatlon.
            </div>
          </div>
        </body>
        </html>
      `;

      const asunto = `Visita Reprogramada - ${visita.sedePrincipal?.nombre_sede || 'Sede'} - Nueva fecha: ${new Date(nuevaFecha).toLocaleDateString('es-AR')}`;

      const promesas = emailsDestino.map(email =>
        emailService.enviarEmailHTML(email, asunto, html)
      );

      await Promise.all(promesas);

      logger.info(`Notificación de reprogramación enviada para visita ${visita.id} a ${emailsDestino.length} destinatarios`);
      return true;
    } catch (error) {
      logger.error('Error enviando notificación de reprogramación:', error);
      throw error;
    }
  }
}

export default new VisitaEmailService();
