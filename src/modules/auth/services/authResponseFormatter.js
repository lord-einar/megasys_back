// src/modules/auth/services/authResponseFormatter.js
const logger = require('../../../shared/utils/logger');

class AuthResponseFormatter {
  /**
   * Constructor
   * @param {string} frontendLoginUrl - URL base del frontend para login
   */
  constructor(frontendLoginUrl = process.env.FRONTEND_LOGIN_URL || 'http://localhost:5173/login') {
    this.frontendLoginUrl = frontendLoginUrl;
    logger.info('AuthResponseFormatter inicializado', {
      frontendLoginUrl: this.frontendLoginUrl
    });
  }

  /**
   * Formatear redirección de error de autenticación
   * @param {string} error - Código de error
   * @param {string} description - Descripción del error
   * @returns {string} HTML con meta refresh
   */
  formatAuthErrorRedirect(error, description) {
    const errorMsg = encodeURIComponent(description || error);
    const redirectUrl = `${this.frontendLoginUrl}?error=${error}&error_description=${errorMsg}`;

    return this.generateRedirectHtml(
      'Error de autenticación',
      redirectUrl,
      `Error de autenticación: ${error}`
    );
  }

  /**
   * Formatear redirección de código faltante
   * @returns {string} HTML con meta refresh
   */
  formatMissingCodeRedirect() {
    const redirectUrl = `${this.frontendLoginUrl}?error=missing_code`;

    return this.generateRedirectHtml(
      'Error de autenticación',
      redirectUrl,
      'Código de autenticación faltante'
    );
  }

  /**
   * Formatear redirección exitosa de autenticación
   * @param {Object} authData - Datos de autenticación del usuario
   * @returns {string} HTML con meta refresh
   */
  formatSuccessRedirect(authData) {
    try {
      // Codificar los datos en Base64
      const encodedData = Buffer.from(JSON.stringify(authData)).toString('base64');
      const redirectUrl = `${this.frontendLoginUrl}?auth_data=${encodedData}`;

      return this.generateRedirectHtml(
        'Autenticación en progreso...',
        redirectUrl,
        'Redirigiendo...'
      );
    } catch (error) {
      logger.error('Error formateando redirección de éxito:', error);
      throw error;
    }
  }

  /**
   * Generar HTML con meta refresh
   * @private
   * @param {string} title - Título de la página
   * @param {string} redirectUrl - URL de redirección
   * @param {string} message - Mensaje a mostrar
   * @returns {string} HTML
   */
  generateRedirectHtml(title, redirectUrl, message) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="refresh" content="0; url=${redirectUrl}">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
              max-width: 400px;
            }
            h1 {
              color: #333;
              margin: 0 0 1rem 0;
              font-size: 1.5rem;
            }
            p {
              color: #666;
              margin: 0.5rem 0;
              line-height: 1.6;
            }
            a {
              color: #667eea;
              text-decoration: none;
              font-weight: 500;
              margin-top: 1rem;
              display: inline-block;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${title}</h1>
            <p>${message}</p>
            <p>Si no se redirige automáticamente, <a href="${redirectUrl}">haz clic aquí</a>.</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Formatear datos de autenticación exitosa para pasar al frontend
   * @param {Object} result - Resultado de processAuthCallback
   * @param {Object} roleInfo - Información de rol y permisos
   * @returns {Object} Datos estructurados
   */
  formatAuthData(result, roleInfo) {
    const nameParts = (result.user.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: firstName,
        lastName: lastName,
        fullName: result.user.name,
        role: roleInfo.role,
        permissions: roleInfo.permissions,
        groups: result.user.groups,
        groupAnalysis: roleInfo.groupAnalysis
      },
      token: result.token,
      profilePhotoUrl: `/api/auth/photo/${result.user.id}`,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }

  /**
   * Actualizar URL del frontend (útil para testing o cambios dinámicos)
   * @param {string} newUrl - Nueva URL
   */
  setFrontendLoginUrl(newUrl) {
    this.frontendLoginUrl = newUrl;
    logger.info('Frontend login URL actualizada:', { url: newUrl });
  }
}

module.exports = new AuthResponseFormatter();
