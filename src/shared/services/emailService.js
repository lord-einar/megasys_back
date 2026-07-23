/**
 * Email Service - Envío de correos para remitos vía Office365 SMTP y Graph API
 */

import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import { msalInstance } from '../../modules/auth/config/msalConfig.js';

// Configuración SMTP para Office365
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '465'), // Puerto 465 para SSL directo
  secure: process.env.SMTP_SECURE !== 'false', // true para port 465 (SSL directo), false para 587
  auth: {
    user: process.env.SMTP_USER || 'remitos@megatlon.com.ar',
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
    // SSLv3 es obsoleto y no soportado, removido para compatibilidad con Office365
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 90000,
  pool: true,
  maxConnections: 3,
  maxMessages: 100
};

const EMAIL_FROM = process.env.SMTP_FROM || 'remitos@megatlon.com.ar';
const EMAIL_INFRAESTRUCTURA = process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar';
const EMAIL_COMPRAS = process.env.EMAIL_COMPRAS || 'compras@megatlon.com.ar';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// Activar Graph API en producción o si se fuerza explícitamente
const USE_GRAPH_API = process.env.USE_GRAPH_API === 'true' || process.env.NODE_ENV === 'production';

class EmailService {
  constructor() {
    this.transporter = null;
    // Solo inicializamos SMTP si NO vamos a usar Graph API exclusivamente, o como fallback
    if (!USE_GRAPH_API) {
      this.inicializarTransporter();
    } else {
      logger.info('📧 EmailService configurado para usar Microsoft Graph API');
    }
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
    }
  }

  /**
   * Obtener Token de acceso para Graph API (Client Credentials)
   */
  async getGraphToken() {
    try {
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
      };
      const response = await msalInstance.acquireTokenByClientCredential(tokenRequest);
      return response.accessToken;
    } catch (error) {
      logger.error('❌ Error obteniendo token Graph API:', error);
      throw error;
    }
  }

  /**
 * Enviar email usando Graph API
 */
  async enviarPorGraphApi(mailOptions) {
    const token = await this.getGraphToken();
    if (!token) throw new Error('No se pudo obtener token para Graph API');

    // Convertir adjuntos a formato Graph
    const attachments = [];
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      for (const att of mailOptions.attachments) {
        let contentBytes;
        if (att.content) {
          contentBytes = att.content.toString('base64');
        } else if (att.path) {
          try {
            const fileBuffer = fs.readFileSync(att.path);
            contentBytes = fileBuffer.toString('base64');
          } catch (err) {
            logger.error(`Error leyendo adjunto ${att.path}:`, err);
            continue; // Omitir adjunto fallido
          }
        } else {
          continue;
        }

        attachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.filename,
          contentBytes: contentBytes,
          contentType: att.contentType || 'application/pdf'
        });
      }
    }

    // Convertir destinatarios a array si es necesario
    const destinatarios = Array.isArray(mailOptions.to)
      ? mailOptions.to
      : [mailOptions.to];

    const message = {
      message: {
        subject: mailOptions.subject,
        body: {
          contentType: 'HTML',
          content: mailOptions.html
        },
        toRecipients: destinatarios.map(email => ({
          emailAddress: {
            address: email.trim()
          }
        })),
        attachments: attachments.length > 0 ? attachments : undefined
      },
      saveToSentItems: false
    };

    // Si hay CC
    if (mailOptions.cc) {
      const ccList = Array.isArray(mailOptions.cc) ? mailOptions.cc : mailOptions.cc.split(',');
      message.message.ccRecipients = ccList.map(email => ({
        emailAddress: { address: email.trim() }
      }));
    }

    try {
      const userId = SMTP_CONFIG.auth.user; // El remitente
      await axios.post(
        `https://graph.microsoft.com/v1.0/users/${userId}/sendMail`,
        message,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      logger.info(`✅ Email enviado vía Graph API a: ${mailOptions.to}`);
      return { messageId: 'GraphAPI-' + Date.now() };
    } catch (error) {
      logger.error('❌ Error enviando email vía Graph API:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Enviar correo electrónico genérico (Wrapper principal)
   */
  async enviarEmail(to, subject, html, attachments = [], cc = null) {
    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      html,
      attachments,
      cc
    };

    try {
      if (USE_GRAPH_API) {
        return await this.enviarPorGraphApi(mailOptions);
      }

      // Fallback a SMTP
      if (!this.transporter) {
        this.inicializarTransporter();
      }

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Email enviado vía SMTP: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('❌ Error enviando email:', error);
      throw error;
    }
  }

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

  async enviarAInfraestructura(remito, rutaPDF, pdfBuffer = null) {
    try {
      logger.info('📧 [INFRAESTRUCTURA] Iniciando envío...', {
        remito: remito.numero_remito,
        to: EMAIL_INFRAESTRUCTURA,
        from: EMAIL_FROM,
        pdfUrl: rutaPDF,
        hasBuffer: !!pdfBuffer
      });

      const html = this.generarHTMLInfraestructura(remito);

      const attachment = {
        filename: `Remito_${remito.numero_remito}.pdf`,
      };

      if (pdfBuffer) {
        attachment.content = pdfBuffer;
      } else {
        attachment.path = rutaPDF;
      }

      logger.info('📧 [INFRAESTRUCTURA] Enviando...');
      const info = await this.enviarEmail(
        EMAIL_INFRAESTRUCTURA,
        `Nuevo remito creado - ${remito.numero_remito}`,
        html,
        [attachment]
      );

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
        remito: remito.numero_remito,
        email: EMAIL_INFRAESTRUCTURA
      });
      throw error;
    }
  }

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

  async enviarAlSolicitante(remito, rutaPDF, urlConfirmacion, pdfBuffer = null) {
    try {
      logger.info('📧 [SOLICITANTE] Iniciando envío...', {
        remito: remito.numero_remito,
        email: remito.solicitante?.email
      });

      const html = this.generarHTMLSolicitante(remito, urlConfirmacion);
      const emailSolicitante = remito.solicitante?.email;

      if (!emailSolicitante) {
        throw new Error('Email del solicitante no disponible');
      }

      const attachment = {
        filename: `Remito_${remito.numero_remito}.pdf`,
      };

      if (pdfBuffer) {
        attachment.content = pdfBuffer;
      } else {
        attachment.path = rutaPDF;
      }

      logger.info('📧 [SOLICITANTE] Enviando email...');
      const info = await this.enviarEmail(
        emailSolicitante,
        `Confirmación requerida - Remito ${remito.numero_remito}`,
        html,
        [attachment]
      );

      logger.info('✓ [SOLICITANTE] Email enviado exitosamente:', {
        remito: remito.numero_remito,
        messageId: info.messageId,
        email: emailSolicitante
      });

      return {
        success: true,
        messageId: info.messageId,
        email: emailSolicitante
      };
    } catch (error) {
      logger.error('✗ [SOLICITANTE] Error enviando email:', {
        error: error.message,
        remito: remito.numero_remito,
        email: remito.solicitante?.email
      });
      throw error;
    }
  }

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

  async enviarConfirmacionRecepcion(remito, rutaPDF, emailSolicitante, fechaConfirmacion, pdfBuffer = null) {
    try {
      logger.info('📧 INICIANDO ENVÍO DE EMAIL DE CONFIRMACIÓN', {
        remito: remito.numero_remito,
        email: emailSolicitante
      });

      const html = this.generarHTMLConfirmacion(remito, emailSolicitante, fechaConfirmacion);

      const attachment = {
        filename: `Remito_${remito.numero_remito}_Confirmado.pdf`,
      };

      if (pdfBuffer) {
        attachment.content = pdfBuffer;
      } else {
        attachment.path = rutaPDF;
      }

      const info = await this.enviarEmail(
        emailSolicitante,
        `Remito Confirmado - ${remito.numero_remito}`,
        html,
        [attachment]
      );

      return {
        success: true,
        messageId: info.messageId,
        email: emailSolicitante
      };
    } catch (error) {
      logger.error('✗ Error enviando email de confirmación:', {
        error: error.message,
        remito: remito.numero_remito,
        email: emailSolicitante
      });
      throw error;
    }
  }

  async enviarConfirmacionRecepcionACompras(remito, rutaPDF, fechaConfirmacion, pdfBuffer = null) {
    try {
      logger.info('📧 INICIANDO ENVÍO DE CONFIRMACIÓN A COMPRAS', {
        remito: remito.numero_remito,
        email: EMAIL_COMPRAS
      });

      const html = this.generarHTMLConfirmacion(remito, EMAIL_COMPRAS, fechaConfirmacion);

      const attachment = {
        filename: `Remito_${remito.numero_remito}_Confirmado.pdf`,
      };

      if (pdfBuffer) {
        attachment.content = pdfBuffer;
      } else {
        attachment.path = rutaPDF;
      }

      const info = await this.enviarEmail(
        EMAIL_COMPRAS,
        `Remito confirmado por destinatario - ${remito.numero_remito}`,
        html,
        [attachment]
      );

      return {
        success: true,
        messageId: info.messageId,
        email: EMAIL_COMPRAS
      };
    } catch (error) {
      logger.error('✗ Error enviando confirmación a Compras:', {
        error: error.message,
        remito: remito.numero_remito,
        email: EMAIL_COMPRAS
      });
      throw error;
    }
  }

  async reenviarEmails(remito, rutaPDF, urlConfirmacion, pdfBuffer = null) {
    try {
      logger.info('📧 INICIANDO REENVÍO DE EMAILS', {
        remito: remito.numero_remito
      });

      const resultados = [];

      logger.info('📧 Reenviando email a INFRAESTRUCTURA...');
      const resultInfra = await this.enviarAInfraestructura(remito, rutaPDF, pdfBuffer);
      resultados.push(resultInfra);

      logger.info('📧 Reenviando email al SOLICITANTE...');
      const resultSolicitante = await this.enviarAlSolicitante(remito, rutaPDF, urlConfirmacion, pdfBuffer);
      resultados.push(resultSolicitante);

      return {
        success: true,
        resultados: resultados
      };
    } catch (error) {
      logger.error('✗ Error reenviando emails:', {
        error: error.message,
        remito: remito.numero_remito
      });
      throw error;
    }
  }

  async enviarEmailHTML(destinatario, asunto, contenidoHTML) {
    try {
      logger.info('📧 Enviando email HTML:', {
        to: destinatario,
        subject: asunto
      });

      const info = await this.enviarEmail(destinatario, asunto, contenidoHTML);

      return {
        success: true,
        messageId: info.messageId,
        email: destinatario
      };
    } catch (error) {
      logger.error('✗ Error enviando email HTML:', error);
      throw error;
    }
  }

  async enviarAlReceptor(remito, rutaPDF, urlConfirmacion, receptorNombre, receptorEmail, pdfBuffer = null) {
    try {
      logger.info('📧 Enviando email al receptor:', {
        remito: remito.numero_remito,
        receptorNombre,
        receptorEmail
      });

      const asunto = `Remito ${remito.numero_remito} - Confirmación de Recepción`;
      const contenidoHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #003366; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
    .info-box { background-color: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 30px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    strong { color: #003366; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Remito para Recepción</h2>
    </div>
    <div class="content">
      <p>Hola <strong>${receptorNombre}</strong>,</p>

      <p>Se te ha asignado como receptor del siguiente remito:</p>

      <div class="info-box">
        <p><strong>Número de Remito:</strong> ${remito.numero_remito}</p>
        <p><strong>Solicitante Original:</strong> ${remito.solicitante?.nombre} ${remito.solicitante?.apellido}</p>
        <p><strong>Sede Origen:</strong> ${remito.sedeOrigen?.nombre_sede}</p>
        <p><strong>Sede Destino:</strong> ${remito.sedeDestino?.nombre_sede}</p>
        <p><strong>Cantidad de Artículos:</strong> ${remito.detalles?.length || 0}</p>
      </div>

      <p><strong>Por favor, confirma la recepción de este remito haciendo clic en el siguiente botón:</strong></p>

      <p style="text-align: center; margin: 25px 0;">
        <a href="${urlConfirmacion}" class="button">✓ CONFIRMAR RECEPCIÓN</a>
      </p>

      <p style="font-size: 12px; color: #666;">O copia este enlace en tu navegador: <a href="${urlConfirmacion}">${urlConfirmacion}</a></p>

      <p><strong>Detalles del remito:</strong></p>
      <ul>
        <li>Técnico asignado: ${remito.tecnicoAsignado?.nombre} ${remito.tecnicoAsignado?.apellido}</li>
        <li>Fecha de emisión: ${new Date(remito.fecha).toLocaleDateString('es-AR')}</li>
        <li>Estado: ${remito.estado}</li>
      </ul>

      <p>Encontrarás el detalle completo en el PDF adjunto.</p>

      <p>Gracias,<br>
      <strong>Equipo de Infraestructura</strong></p>
    </div>
    <div class="footer">
      <p>Este es un email automático del Sistema de Gestión Empresarial. No responder a este email.</p>
    </div>
  </div>
</body>
</html>
      `;

      const attachment = {
        filename: `Remito_${remito.numero_remito}.pdf`,
      };

      if (pdfBuffer) {
        attachment.content = pdfBuffer;
      } else {
        attachment.path = rutaPDF;
      }

      const info = await this.enviarEmail(
        receptorEmail,
        asunto,
        contenidoHTML,
        [attachment]
      );

      return {
        success: true,
        messageId: info.messageId,
        email: receptorEmail
      };
    } catch (error) {
      logger.error('✗ Error enviando email al receptor:', {
        error: error.message,
        remito: remito.numero_remito,
        receptorEmail
      });
      throw error;
    }
  }

  async enviarNotificacionCambioReceptor(remito, rutaPDF, solicitanteEmail, receptorNombre, receptorEmail) {
    try {
      logger.info('📧 Enviando notificación de cambio de receptor al solicitante:', {
        remito: remito.numero_remito,
        solicitanteEmail,
        receptorNombre
      });

      const asunto = `Remito ${remito.numero_remito} - Receptor Asignado`;
      const contenidoHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #003366; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
    .info-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .receptor-box { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    strong { color: #003366; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Receptor Asignado para tu Remito</h2>
    </div>
    <div class="content">
      <p>Hola <strong>${remito.solicitante?.nombre} ${remito.solicitante?.apellido}</strong>,</p>

      <p>Te informamos que se ha asignado un receptor alternativo para el remito que solicitaste:</p>

      <div class="info-box">
        <p><strong>Número de Remito:</strong> ${remito.numero_remito}</p>
        <p><strong>Sede Origen:</strong> ${remito.sedeOrigen?.nombre_sede}</p>
        <p><strong>Sede Destino:</strong> ${remito.sedeDestino?.nombre_sede}</p>
        <p><strong>Cantidad de Artículos:</strong> ${remito.detalles?.length || 0}</p>
      </div>

      <div class="receptor-box">
        <p><strong>RECIBIDO POR:</strong></p>
        <p><strong>Nombre:</strong> ${receptorNombre}</p>
        <p><strong>Email:</strong> ${receptorEmail}</p>
      </div>

      <p>Esta persona recibirá los artículos y confirmará la recepción en tu nombre.</p>

      <p><strong>Detalles adicionales:</strong></p>
      <ul>
        <li>Técnico asignado: ${remito.tecnicoAsignado?.nombre} ${remito.tecnicoAsignado?.apellido}</li>
        <li>Fecha de emisión: ${new Date(remito.fecha).toLocaleDateString('es-AR')}</li>
        <li>Estado: ${remito.estado}</li>
      </ul>

      <p>Encontrarás el detalle completo en el PDF adjunto.</p>

      <p>Gracias,<br>
      <strong>Equipo de Infraestructura</strong></p>
    </div>
    <div class="footer">
      <p>Este es un email automático del Sistema de Gestión Empresarial. No responder a este email.</p>
    </div>
  </div>
</body>
</html>
      `;

      const attachment = {
        filename: `Remito_${remito.numero_remito}.pdf`,
        path: rutaPDF
      };

      const info = await this.enviarEmail(
        solicitanteEmail,
        asunto,
        contenidoHTML,
        [attachment]
      );

      return {
        success: true,
        messageId: info.messageId,
        email: solicitanteEmail
      };
    } catch (error) {
      logger.error('✗ Error enviando notificación al solicitante:', {
        error: error.message,
        remito: remito.numero_remito,
        solicitanteEmail
      });
      throw error;
    }
  }
}

export default new EmailService();
