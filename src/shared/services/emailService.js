/**
 * Email Service - Envío de correos para remitos vía Office365 SMTP
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configuración SMTP para Office365
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' ? true : false, // false para port 587 (STARTTLS), true para 465
  auth: {
    user: process.env.SMTP_USER || 'remitos@megatlon.com.ar',
    pass: process.env.SMTP_PASSWORD || 'Infra123!'
  }
};

const EMAIL_FROM = process.env.SMTP_FROM || 'remitos@megatlon.com.ar';
const EMAIL_INFRAESTRUCTURA = process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

class EmailService {
  constructor() {
    this.transporter = null;
    this.inicializarTransporter();
  }

  inicializarTransporter() {
    try {
      logger.info('🔧 Inicializando Email transporter con config:', {
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        user: SMTP_CONFIG.auth.user,
        from: EMAIL_FROM
      });
      this.transporter = nodemailer.createTransport(SMTP_CONFIG);
      logger.info('✓ Email transporter inicializado correctamente');
    } catch (error) {
      logger.error('✗ Error inicializando email transporter:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Generar HTML del email para infraestructura
   * @param {object} remito - Datos del remito
   * @returns {string} HTML del email
   */
  generarHTMLInfraestructura(remito) {
    const articulosHTML = remito.detalles && remito.detalles.length > 0
      ? remito.detalles.map((detalle, idx) => {
          const articulo = detalle.inventarioDetalle || {};
          return `
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px; text-align: center;">${idx + 1}</td>
              <td style="padding: 12px;">${articulo.tipoArticulo?.nombre || 'N/A'}</td>
              <td style="padding: 12px;">${articulo.marca || 'N/A'}</td>
              <td style="padding: 12px;">${articulo.modelo || 'N/A'}</td>
              <td style="padding: 12px;">${articulo.numero_serie || 'N/A'}</td>
              <td style="padding: 12px; text-align: center;">${detalle.es_prestamo ? 'Sí' : 'NO'}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #7f8c8d;">Sin artículos</td></tr>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .section { margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #3498db; border-radius: 3px; }
          .section-title { font-size: 14px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; background: white; }
          th { background: #34495e; color: white; padding: 12px; text-align: left; font-size: 12px; }
          td { padding: 10px; font-size: 12px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 10px; }
          .info-item { background: white; padding: 10px; border-radius: 3px; border-left: 3px solid #3498db; }
          .info-label { font-size: 11px; color: #7f8c8d; font-weight: bold; }
          .info-value { font-size: 13px; color: #2c3e50; font-weight: bold; margin-top: 5px; }
          .footer { background: #ecf0f1; color: #7f8c8d; font-size: 11px; padding: 15px; text-align: center; border-top: 1px solid #bdc3c7; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">MEGATLON - Nuevo Remito Creado</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Sistema de Gestión de Remitos</p>
          </div>

          <div class="content">
            <div class="section">
              <div class="section-title">INFORMACIÓN DEL REMITO</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Número de Remito</div>
                  <div class="info-value">${remito.numero_remito}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Fecha</div>
                  <div class="info-value">${new Date(remito.fecha).toLocaleDateString('es-AR')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Estado</div>
                  <div class="info-value">${remito.estado}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">DETALLES DEL REMITO</div>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo de Artículo</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Número de Serie</th>
                    <th>¿Préstamo?</th>
                  </tr>
                </thead>
                <tbody>
                  ${articulosHTML}
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">INFORMACIÓN DE SEDES</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Sede Origen</div>
                  <div class="info-value">${remito.sedeOrigen?.nombre_sede || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Sede Destino</div>
                  <div class="info-value">${remito.sedeDestino?.nombre_sede || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Responsable</div>
                  <div class="info-value">${remito.tecnicoAsignado?.nombre || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">INFORMACIÓN DEL SOLICITANTE</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Nombre</div>
                  <div class="info-value">${remito.solicitante?.nombre || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Correo Electrónico</div>
                  <div class="info-value">${remito.solicitante?.email || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Teléfono</div>
                  <div class="info-value">${remito.solicitante?.telefono || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>Este es un email automático generado por el Sistema de Gestión de Remitos.</p>
              <p>Por favor, no respondas a este correo. Si tienes preguntas, contacta a infraestructura@megatlon.com.ar</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar email a infraestructura
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF
   * @returns {Promise<object>} Resultado del envío
   */
  async enviarAInfraestructura(remito, rutaPDF) {
    try {
      logger.info('📧 [INFRAESTRUCTURA] Iniciando envío...', {
        remito: remito.numero_remito,
        to: EMAIL_INFRAESTRUCTURA,
        from: EMAIL_FROM,
        pdfExists: require('fs').existsSync(rutaPDF)
      });

      const html = this.generarHTMLInfraestructura(remito);

      const opciones = {
        from: EMAIL_FROM,
        to: EMAIL_INFRAESTRUCTURA,
        subject: `Nuevo remito creado - ${remito.numero_remito}`,
        html: html,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8'
        },
        attachments: [
          {
            filename: require('path').basename(rutaPDF),
            path: rutaPDF
          }
        ]
      };

      logger.info('📧 [INFRAESTRUCTURA] Enviando...');
      const info = await this.transporter.sendMail(opciones);

      logger.info('✓ [INFRAESTRUCTURA] Email enviado exitosamente:', {
        remito: remito.numero_remito,
        messageId: info.messageId,
        email: EMAIL_INFRAESTRUCTURA,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        messageId: info.messageId,
        email: EMAIL_INFRAESTRUCTURA
      };
    } catch (error) {
      logger.error('✗ [INFRAESTRUCTURA] Error enviando email:', {
        error: error.message,
        errorCode: error.code,
        errorResponse: error.response,
        remito: remito.numero_remito,
        email: EMAIL_INFRAESTRUCTURA,
        timestamp: new Date().toISOString(),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generar HTML del email para el solicitante
   * @param {object} remito - Datos del remito
   * @param {string} urlConfirmacion - URL de confirmación con token
   * @returns {string} HTML del email
   */
  generarHTMLSolicitante(remito, urlConfirmacion) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .section { margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #27ae60; border-radius: 3px; }
          .section-title { font-size: 14px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
          .info-item { margin-bottom: 10px; }
          .info-label { font-size: 11px; color: #7f8c8d; font-weight: bold; }
          .info-value { font-size: 13px; color: #2c3e50; margin-top: 3px; }
          .button { background: #27ae60; color: white; padding: 12px 24px; border-radius: 3px; text-decoration: none; display: inline-block; font-weight: bold; margin: 15px 0; }
          .footer { background: #ecf0f1; color: #7f8c8d; font-size: 11px; padding: 15px; text-align: center; border-top: 1px solid #bdc3c7; margin-top: 20px; }
          .alert { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 12px; border-radius: 3px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">MEGATLON - Nuevo Remito</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Sistema de Gestión de Remitos</p>
          </div>

          <div class="content">
            <div class="section">
              <p>Hola <strong>${remito.solicitante?.nombre || 'usuario'}</strong>,</p>
              <p>Se ha creado un nuevo remito que requiere tu confirmación de recepción.</p>
            </div>

            <div class="section">
              <div class="section-title">DETALLES DEL REMITO</div>
              <div class="info-item">
                <div class="info-label">Número de Remito</div>
                <div class="info-value">${remito.numero_remito}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha de Creación</div>
                <div class="info-value">${new Date(remito.fecha).toLocaleDateString('es-AR')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Sede de Origen</div>
                <div class="info-value">${remito.sedeOrigen?.nombre_sede || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Sede de Destino</div>
                <div class="info-value">${remito.sedeDestino?.nombre_sede || 'N/A'}</div>
              </div>
            </div>

            <div class="alert">
              <strong>Importante:</strong> Por favor haz clic en el botón de abajo para confirmar la recepción de este remito.
            </div>

            <div style="text-align: center;">
              <a href="${urlConfirmacion}" class="button">Confirmar Recepción</a>
            </div>

            <div class="section">
              <p style="font-size: 12px; color: #7f8c8d; margin: 0;">Si el botón anterior no funciona, copia y pega el siguiente enlace en tu navegador:</p>
              <p style="font-size: 11px; color: #3498db; word-break: break-all; background: #ecf0f1; padding: 10px; border-radius: 3px; margin: 10px 0;">${urlConfirmacion}</p>
            </div>

            <div class="footer">
              <p>Este es un email automático generado por el Sistema de Gestión de Remitos.</p>
              <p>Si tienes preguntas, contacta a infraestructura@megatlon.com.ar</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar email al solicitante con link de confirmación
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF
   * @param {string} urlConfirmacion - URL de confirmación con token
   * @returns {Promise<object>} Resultado del envío
   */
  async enviarAlSolicitante(remito, rutaPDF, urlConfirmacion) {
    try {
      logger.info('📧 [SOLICITANTE] Iniciando envío...', {
        remito: remito.numero_remito,
        email: remito.solicitante?.email,
        pdfExists: require('fs').existsSync(rutaPDF),
        urlConfirmacionLength: urlConfirmacion?.length || 0
      });

      const html = this.generarHTMLSolicitante(remito, urlConfirmacion);
      const emailSolicitante = remito.solicitante?.email;

      if (!emailSolicitante) {
        logger.error('✗ [SOLICITANTE] Email del solicitante no disponible', {
          remito: remito.numero_remito,
          solicitanteData: remito.solicitante
        });
        throw new Error('Email del solicitante no disponible');
      }

      logger.info('📧 [SOLICITANTE] Email del solicitante válido:', {
        email: emailSolicitante,
        remito: remito.numero_remito
      });

      const opciones = {
        from: EMAIL_FROM,
        to: emailSolicitante,
        subject: `Confirmación requerida - Remito ${remito.numero_remito}`,
        html: html,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8'
        },
        attachments: [
          {
            filename: require('path').basename(rutaPDF),
            path: rutaPDF
          }
        ]
      };

      logger.info('📧 [SOLICITANTE] Enviando email...');
      const info = await this.transporter.sendMail(opciones);

      logger.info('✓ [SOLICITANTE] Email enviado exitosamente:', {
        remito: remito.numero_remito,
        messageId: info.messageId,
        email: emailSolicitante,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        messageId: info.messageId,
        email: emailSolicitante
      };
    } catch (error) {
      logger.error('✗ [SOLICITANTE] Error enviando email:', {
        error: error.message,
        errorCode: error.code,
        errorResponse: error.response,
        remito: remito.numero_remito,
        email: remito.solicitante?.email,
        timestamp: new Date().toISOString(),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generar HTML del email para confirmación de recepción
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF
   * @param {string} emailSolicitante - Email a notificar
   * @param {Date} fechaConfirmacion - Fecha de confirmación
   * @returns {string} HTML del email
   */
  generarHTMLConfirmacion(remito, emailSolicitante, fechaConfirmacion) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .section { margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #27ae60; border-radius: 3px; }
          .section-title { font-size: 14px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
          .success-badge { background: #27ae60; color: white; padding: 10px 15px; border-radius: 3px; display: inline-block; margin: 10px 0; font-weight: bold; }
          .info-item { margin-bottom: 10px; }
          .info-label { font-size: 11px; color: #7f8c8d; font-weight: bold; }
          .info-value { font-size: 13px; color: #2c3e50; margin-top: 3px; }
          .footer { background: #ecf0f1; color: #7f8c8d; font-size: 11px; padding: 15px; text-align: center; border-top: 1px solid #bdc3c7; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">✓ REMITO CONFIRMADO</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Sistema de Gestión de Remitos</p>
          </div>

          <div class="content">
            <div class="section">
              <p>La recepción del remito ha sido confirmada exitosamente.</p>
              <div class="success-badge">✓ Confirmación Exitosa</div>
            </div>

            <div class="section">
              <div class="section-title">DETALLES DE LA CONFIRMACIÓN</div>
              <div class="info-item">
                <div class="info-label">Número de Remito</div>
                <div class="info-value">${remito.numero_remito}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha de Confirmación</div>
                <div class="info-value">${fechaConfirmacion.toLocaleDateString('es-AR')} ${fechaConfirmacion.toLocaleTimeString('es-AR')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Persona que Confirmó</div>
                <div class="info-value">${emailSolicitante}</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">INFORMACIÓN DEL REMITO</div>
              <div class="info-item">
                <div class="info-label">Sede de Origen</div>
                <div class="info-value">${remito.sedeOrigen?.nombre_sede || remito.sedeOrigen?.nombre || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Sede de Destino</div>
                <div class="info-value">${remito.sedeDestino?.nombre_sede || remito.sedeDestino?.nombre || 'N/A'}</div>
              </div>
            </div>

            <div class="footer">
              <p>Este es un email automático generado por el Sistema de Gestión de Remitos.</p>
              <p>Si tienes preguntas, contacta a infraestructura@megatlon.com.ar</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar email de confirmación de recepción
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF confirmado
   * @param {string} emailSolicitante - Email del solicitante
   * @param {Date} fechaConfirmacion - Fecha de confirmación
   * @returns {Promise<object>} Resultado del envío
   */
  async enviarConfirmacionRecepcion(remito, rutaPDF, emailSolicitante, fechaConfirmacion) {
    try {
      logger.info('📧 INICIANDO ENVÍO DE EMAIL DE CONFIRMACIÓN', {
        remito: remito.numero_remito,
        email: emailSolicitante,
        from: EMAIL_FROM,
        rutaPDF: rutaPDF
      });

      const html = this.generarHTMLConfirmacion(remito, emailSolicitante, fechaConfirmacion);

      const opciones = {
        from: EMAIL_FROM,
        to: emailSolicitante,
        subject: `Remito Confirmado - ${remito.numero_remito}`,
        html: html,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8'
        },
        attachments: [
          {
            filename: require('path').basename(rutaPDF),
            path: rutaPDF
          }
        ]
      };

      logger.info('📧 Opciones de email preparadas:', {
        to: opciones.to,
        from: opciones.from,
        subject: opciones.subject,
        attachmentCount: opciones.attachments.length
      });

      const info = await this.transporter.sendMail(opciones);

      logger.info('✓ Email de confirmación enviado exitosamente:', {
        remito: remito.numero_remito,
        messageId: info.messageId,
        email: emailSolicitante,
        response: info.response
      });

      return {
        success: true,
        messageId: info.messageId,
        email: emailSolicitante
      };
    } catch (error) {
      logger.error('✗ Error enviando email de confirmación:', {
        error: error.message,
        code: error.code,
        remito: remito.numero_remito,
        email: emailSolicitante,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Reenviar los emails del remito (para remitos ya creados)
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF
   * @param {string} urlConfirmacion - URL de confirmación con token
   * @returns {Promise<object>} Resultado del envío
   */
  async reenviarEmails(remito, rutaPDF, urlConfirmacion) {
    try {
      logger.info('📧 INICIANDO REENVÍO DE EMAILS', {
        remito: remito.numero_remito,
        rutaPDF: rutaPDF,
        urlConfirmacion: !!urlConfirmacion
      });

      const resultados = [];

      // Enviar a infraestructura
      logger.info('📧 Reenviando email a INFRAESTRUCTURA...');
      const resultInfra = await this.enviarAInfraestructura(remito, rutaPDF);
      resultados.push(resultInfra);
      logger.info('✓ Email a infraestructura reenviado');

      // Enviar al solicitante
      logger.info('📧 Reenviando email al SOLICITANTE...');
      const resultSolicitante = await this.enviarAlSolicitante(remito, rutaPDF, urlConfirmacion);
      resultados.push(resultSolicitante);
      logger.info('✓ Email al solicitante reenviado');

      logger.info('✓ Todos los emails reenviados exitosamente:', {
        remito: remito.numero_remito,
        emails: resultados.map(r => r.email),
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        resultados: resultados
      };
    } catch (error) {
      logger.error('✗ Error reenviando emails:', {
        error: error.message,
        code: error.code,
        remito: remito.numero_remito,
        timestamp: new Date().toISOString(),
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = new EmailService();
