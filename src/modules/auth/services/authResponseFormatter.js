// src/modules/auth/services/authResponseFormatter.js
import logger from '../../../shared/utils/logger.js';

// Todo lo que llega de la URL (error, descripción) se escapa antes de entrar al HTML
const escapeHtml = (valor) => String(valor ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

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
    const redirectUrl = `${this.frontendLoginUrl}?error=${encodeURIComponent(error)}&error_description=${errorMsg}`;

    // El detalle del error lo muestra el login; acá solo se redirige
    return this.generateRedirectHtml(
      'Volviendo al Portal IT',
      redirectUrl,
      'Volviendo al portal…'
    );
  }

  /**
   * Formatear redirección de código faltante
   * @returns {string} HTML con meta refresh
   */
  formatMissingCodeRedirect() {
    const redirectUrl = `${this.frontendLoginUrl}?error=missing_code`;

    return this.generateRedirectHtml(
      'Volviendo al Portal IT',
      redirectUrl,
      'Volviendo al portal…'
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
        'Ingresando al Portal IT',
        redirectUrl,
        'Verificando tu acceso…'
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
    // Misma estética que la pantalla de espera del frontend (fondo petróleo), para
    // que el paso por el backend no se vea como una pantalla distinta. Redirige al
    // instante por script; el meta refresh y el enlace quedan como respaldo.
    const urlHtml = escapeHtml(redirectUrl);
    const urlJs = JSON.stringify(redirectUrl).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>${escapeHtml(title)}</title>
    <meta http-equiv="refresh" content="0; url=${urlHtml}">
    <script>window.location.replace(${urlJs});</script>
    <style>
      html, body { height: 100%; margin: 0; }
      body {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px;
        background: #0e2a2e; color: #a9c3c5;
        font-family: 'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
      }
      .spinner {
        width: 32px; height: 32px; border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.2); border-top-color: #6fd0c9;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
      p { margin: 0; font-size: 16px; }
      a { color: #6fd0c9; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="spinner" aria-hidden="true"></div>
    <p role="status">${escapeHtml(message)}</p>
    <noscript><a href="${urlHtml}">Continuar al portal</a></noscript>
  </body>
</html>`;
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
