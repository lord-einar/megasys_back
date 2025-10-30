/**
 * Email Service - Env�o de correos para remitos v�a Office365 SMTP
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configuraci�n SMTP para Office365
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
      this.transporter = nodemailer.createTransport(SMTP_CONFIG);
      logger.info('Email transporter inicializado correctamente');
    } catch (error) {
      logger.error('Error inicializando email transporter:', { error: error.message });
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
              <td style="padding: 12px; text-align: center;">${detalle.es_prestamo ? 'S�' : 'NO'}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #7f8c8d;">Sin art�culos</td></tr>';

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
            <p style="margin: 5px 0 0 0; font-size: 12px;">Sistema de Gesti�n de Remitos</p>
          </div>

          <div class="content">
            <div class="section">
              <div class="section-title">INFORMACI�N DEL REMITO</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">N�mero de Remito</div>
                  <div class="info-value">${remito.numero_remito}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Fecha</div>
                  <div class="info-value">${new Date(remito.fecha).toLocaleDateString('es-AR')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Tipo</div>
                  <div class="info-value">${remito.es_prestamo ? 'Pr�stamo' : 'Transferencia'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">SOLICITANTE</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Nombre</div>
                  <div class="info-value">${remito.solicitante ? remito.solicitante.nombre + ' ' + remito.solicitante.apellido : 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Email</div>
                  <div class="info-value" style="word-break: break-all;">${remito.solicitante?.email || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Tel�fono</div>
                  <div class="info-value">${remito.solicitante?.telefono || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">SEDES</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Origen</div>
                  <div class="info-value">${remito.sedeOrigen?.nombre_sede || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Destino</div>
                  <div class="info-value">${remito.sedeDestino?.nombre_sede || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">ART�CULOS</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 25%;">Tipo</th>
                    <th style="width: 20%;">Marca</th>
                    <th style="width: 20%;">Modelo</th>
                    <th style="width: 20%;">N� Serie</th>
                    <th style="width: 10%;">�Pr�stamo?</th>
                  </tr>
                </thead>
                <tbody>
                  ${articulosHTML}
                </tbody>
              </table>
            </div>

            <div class="section" style="border-left-color: #e74c3c; background: #fef5f5;">
              <div class="section-title" style="color: #e74c3c;">OBSERVACIONES</div>
              <p style="margin: 0; color: #555; font-size: 13px;">${remito.observaciones || 'Sin observaciones'}</p>
            </div>
          </div>

          <div class="footer">
            <p>Este es un correo autom�tico generado por el Sistema de Gesti�n de Megatlon</p>
            <p>Fecha y hora: ${new Date().toLocaleString('es-AR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generar HTML del email para solicitante con bot�n de confirmaci�n
   * @param {object} remito - Datos del remito
   * @param {string} urlConfirmacion - URL de confirmaci�n con token
   * @returns {string} HTML del email
   */
  generarHTMLSolicitante(remito, urlConfirmacion) {
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
              <td style="padding: 12px; text-align: center;">${detalle.es_prestamo ? 'S�' : 'NO'}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #7f8c8d;">Sin art�culos</td></tr>';

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
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
          .info-item { background: white; padding: 10px; border-radius: 3px; border-left: 3px solid #3498db; }
          .info-label { font-size: 11px; color: #7f8c8d; font-weight: bold; }
          .info-value { font-size: 13px; color: #2c3e50; font-weight: bold; margin-top: 5px; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: #27ae60; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
          .button:hover { background: #229954; }
          .warning { background: #fef9e7; border-left: 4px solid #f39c12; padding: 15px; margin: 20px 0; border-radius: 3px; }
          .warning-title { color: #f39c12; font-weight: bold; margin-bottom: 5px; }
          .warning-text { color: #7d6608; font-size: 12px; }
          .footer { background: #ecf0f1; color: #7f8c8d; font-size: 11px; padding: 15px; text-align: center; border-top: 1px solid #bdc3c7; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">MEGATLON - Su Remito ha sido Registrado</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Sistema de Gesti�n de Remitos</p>
          </div>

          <div class="content">
            <p style="margin-top: 0; color: #555;">Estimado/a ${remito.solicitante?.nombre || 'Usuario'},</p>
            <p style="color: #555;">Su remito ha sido registrado exitosamente en nuestro sistema. A continuaci�n le proporcionamos los detalles:</p>

            <div class="section">
              <div class="section-title">INFORMACI�N DEL REMITO</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">N�mero de Remito</div>
                  <div class="info-value">${remito.numero_remito}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Fecha</div>
                  <div class="info-value">${new Date(remito.fecha).toLocaleDateString('es-AR')}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">SEDES</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Origen</div>
                  <div class="info-value">${remito.sedeOrigen?.nombre_sede || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Destino</div>
                  <div class="info-value">${remito.sedeDestino?.nombre_sede || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">ART�CULOS</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 25%;">Tipo</th>
                    <th style="width: 20%;">Marca</th>
                    <th style="width: 20%;">Modelo</th>
                    <th style="width: 20%;">N� Serie</th>
                    <th style="width: 10%;">�Pr�stamo?</th>
                  </tr>
                </thead>
                <tbody>
                  ${articulosHTML}
                </tbody>
              </table>
            </div>

            <div class="button-container">
              <p style="color: #555; margin-bottom: 15px; font-weight: bold;">Por favor, confirme la recepci�n de los art�culos:</p>
              <a href="${urlConfirmacion}" class="button">CONFIRMAR RECEPCI�N</a>
            </div>

            <div class="warning">
              <div class="warning-title">� Tiempo de Validez</div>
              <div class="warning-text">El enlace de confirmaci�n es v�lido por 30 d�as. Despu�s de este per�odo, deber� contactar a infraestructura@megatlon.com.ar para confirmar manualmente.</div>
            </div>

            <div class="section" style="border-left-color: #e74c3c; background: #fef5f5;">
              <div class="section-title" style="color: #e74c3c;">OBSERVACIONES</div>
              <p style="margin: 0; color: #555; font-size: 13px;">${remito.observaciones || 'Sin observaciones'}</p>
            </div>
          </div>

          <div class="footer">
            <p>Este es un correo autom�tico generado por el Sistema de Gesti�n de Megatlon</p>
            <p>No responda a este correo. Para consultas, contacte a infraestructura@megatlon.com.ar</p>
            <p>Fecha y hora: ${new Date().toLocaleString('es-AR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generar HTML del email de confirmaci�n
   * @param {object} remito - Datos del remito
   * @param {string} fechaConfirmacion - Fecha de confirmaci�n
   * @returns {string} HTML del email
   */
  generarHTMLConfirmacion(remito, fechaConfirmacion) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .section { margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #27ae60; border-radius: 3px; }
          .section-title { font-size: 14px; font-weight: bold; color: #27ae60; margin-bottom: 10px; }
          .success-message { background: #e8f8f5; border: 2px solid #27ae60; padding: 20px; border-radius: 5px; text-align: center; margin-bottom: 20px; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .success-text { font-size: 18px; color: #27ae60; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
          .info-item { background: white; padding: 10px; border-radius: 3px; border-left: 3px solid #27ae60; }
          .info-label { font-size: 11px; color: #7f8c8d; font-weight: bold; }
          .info-value { font-size: 13px; color: #27ae60; font-weight: bold; margin-top: 5px; }
          .footer { background: #ecf0f1; color: #7f8c8d; font-size: 11px; padding: 15px; text-align: center; border-top: 1px solid #bdc3c7; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">MEGATLON - Recepci�n Confirmada</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Sistema de Gesti�n de Remitos</p>
          </div>

          <div class="content">
            <div class="success-message">
              <div class="success-icon"></div>
              <div class="success-text">�Recepci�n Confirmada!</div>
            </div>

            <p style="color: #555; text-align: center; margin-bottom: 20px;">
              La recepci�n del remito <strong>${remito.numero_remito}</strong> ha sido confirmada correctamente.
            </p>

            <div class="section">
              <div class="section-title">DETALLES DE LA CONFIRMACI�N</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Remito N�mero</div>
                  <div class="info-value">${remito.numero_remito}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Confirmado el</div>
                  <div class="info-value">${new Date(fechaConfirmacion).toLocaleString('es-AR')}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">ESTADO</div>
              <p style="margin: 0; color: #27ae60; font-size: 14px; font-weight: bold;"> COMPLETADO</p>
            </div>

            <div class="section">
              <div class="section-title">PDF ADJUNTO</div>
              <p style="margin: 0; color: #555; font-size: 13px;">
                Se adjunta el PDF de confirmaci�n de recepci�n con la fecha y hora de confirmaci�n registrada.
              </p>
            </div>
          </div>

          <div class="footer">
            <p>Este es un correo autom�tico generado por el Sistema de Gesti�n de Megatlon</p>
            <p>Fecha y hora: ${new Date().toLocaleString('es-AR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar email a infraestructura con el remito y PDF adjunto
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF
   * @returns {Promise<object>} Resultado del env�o
   */
  async enviarAInfraestructura(remito, rutaPDF) {
    try {
      const html = this.generarHTMLInfraestructura(remito);

      const opciones = {
        from: EMAIL_FROM,
        to: EMAIL_INFRAESTRUCTURA,
        subject: `Nuevo remito creado - ${remito.numero_remito}`,
        html: html,
        attachments: [
          {
            filename: require('path').basename(rutaPDF),
            path: rutaPDF
          }
        ]
      };

      const info = await this.transporter.sendMail(opciones);

      logger.info('Email enviado a infraestructura:', {
        remito: remito.numero_remito,
        messageId: info.messageId,
        email: EMAIL_INFRAESTRUCTURA
      });

      return {
        success: true,
        messageId: info.messageId,
        email: EMAIL_INFRAESTRUCTURA
      };
    } catch (error) {
      logger.error('Error enviando email a infraestructura:', {
        error: error.message,
        remito: remito.numero_remito,
        email: EMAIL_INFRAESTRUCTURA
      });
      throw error;
    }
  }

  /**
   * Enviar email al solicitante con link de confirmaci�n
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDF - Ruta del archivo PDF
   * @param {string} urlConfirmacion - URL de confirmaci�n con token
   * @returns {Promise<object>} Resultado del env�o
   */
  async enviarAlSolicitante(remito, rutaPDF, urlConfirmacion) {
    try {
      const html = this.generarHTMLSolicitante(remito, urlConfirmacion);
      const emailSolicitante = remito.solicitante?.email;

      if (!emailSolicitante) {
        throw new Error('Email del solicitante no disponible');
      }

      const opciones = {
        from: EMAIL_FROM,
        to: emailSolicitante,
        subject: `Su remito ha sido registrado - ${remito.numero_remito}`,
        html: html,
        attachments: [
          {
            filename: require('path').basename(rutaPDF),
            path: rutaPDF
          }
        ]
      };

      const info = await this.transporter.sendMail(opciones);

      logger.info('Email enviado al solicitante:', {
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
      logger.error('Error enviando email al solicitante:', {
        error: error.message,
        remito: remito.numero_remito,
        email: remito.solicitante?.email
      });
      throw error;
    }
  }

  /**
   * Enviar email de confirmaci�n de recepci�n
   * @param {object} remito - Datos del remito
   * @param {string} rutaPDFConfirmado - Ruta del PDF confirmado con watermark
   * @param {string} email - Email del solicitante
   * @param {string} fechaConfirmacion - Fecha de confirmaci�n
   * @returns {Promise<object>} Resultado del env�o
   */
  async enviarConfirmacionRecepcion(remito, rutaPDFConfirmado, email, fechaConfirmacion) {
    try {
      const html = this.generarHTMLConfirmacion(remito, fechaConfirmacion);

      const opciones = {
        from: EMAIL_FROM,
        to: email,
        subject: `Confirmaci�n de recepci�n - ${remito.numero_remito}`,
        html: html,
        attachments: [
          {
            filename: require('path').basename(rutaPDFConfirmado),
            path: rutaPDFConfirmado
          }
        ]
      };

      const info = await this.transporter.sendMail(opciones);

      logger.info('Email de confirmaci�n enviado:', {
        remito: remito.numero_remito,
        messageId: info.messageId,
        email: email,
        fechaConfirmacion: fechaConfirmacion
      });

      return {
        success: true,
        messageId: info.messageId,
        email: email
      };
    } catch (error) {
      logger.error('Error enviando email de confirmaci�n:', {
        error: error.message,
        remito: remito.numero_remito,
        email: email
      });
      throw error;
    }
  }
}

module.exports = new EmailService();
