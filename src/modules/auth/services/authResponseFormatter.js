// src/modules/auth/services/authResponseFormatter.js
import logger from '../../../shared/utils/logger.js';

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
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #020617;
              background-image: linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px);
              background-size: 56px 56px;
              color: #94a3b8;
            }
            .spinner {
              width: 32px;
              height: 32px;
              border: 2px solid rgba(255,255,255,0.15);
              border-top-color: rgba(255,255,255,0.8);
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            p {
              font-size: 13px;
              font-weight: 500;
              margin: 0;
              color: #475569;
            }
            a {
              color: #6366f1;
              text-decoration: none;
              font-size: 12px;
              margin-top: 12px;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <p>${message}</p>
          <a href="${redirectUrl}">Continuar manualmente</a>
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
        privilegios: result.user.privilegioApp || roleInfo.role,
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

export default new AuthResponseFormatter();
