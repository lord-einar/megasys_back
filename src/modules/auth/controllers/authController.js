// src/modules/auth/controllers/authController.js - CORREGIDO
const authService = require('../services/authService');
const { success, error } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');

// Almacenamiento temporal de access tokens (en memoria, se limpian con el tiempo)
const accessTokenCache = new Map();

// Limpiar tokens expirados cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of accessTokenCache.entries()) {
    if (now > data.expiresAt) {
      accessTokenCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

class AuthController {
  /**
   * Iniciar proceso de autenticación
   */
  login = asyncHandler(async (req, res) => {
    try {
      const authUrl = await authService.generateAuthUrl();
      
      logger.info('URL de autenticación generada para:', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      success(res, { 
        authUrl,
        message: 'Redirige al usuario a esta URL para autenticarse'
      }, 'URL de autenticación generada');
    } catch (err) {
      logger.error('Error en login:', err);
      error(res, 'Error al generar URL de autenticación', 500);
    }
  });

  /**
   * Procesar callback de autenticación
   */
  callback = asyncHandler(async (req, res) => {
    try {
      const { code, error: authError, error_description } = req.query;

      if (authError) {
        logger.error('Error en callback de Microsoft:', {
          error: authError,
          description: error_description
        });

        // Enviar error con HTML meta refresh (respeta CSP)
        const errorMsg = encodeURIComponent(error_description || authError);
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Error de autenticación</title>
              <meta http-equiv="refresh" content="0; url=http://localhost:5173/login?error=${authError}&error_description=${errorMsg}">
            </head>
            <body>
              <p>Error de autenticación. Si no se redirige automáticamente, <a href="http://localhost:5173/login?error=${authError}&error_description=${errorMsg}">haz clic aquí</a>.</p>
            </body>
          </html>
        `;
        return res.send(html);
      }

      if (!code) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Error de autenticación</title>
              <meta http-equiv="refresh" content="0; url=http://localhost:5173/login?error=missing_code">
            </head>
            <body>
              <p>Código faltante. Si no se redirige automáticamente, <a href="http://localhost:5173/login?error=missing_code">haz clic aquí</a>.</p>
            </body>
          </html>
        `;
        return res.send(html);
      }

      const result = await authService.processAuthCallback(code);

      // Guardar el access token en cache para obtener la foto después
      // El token se almacena por 30 minutos
      accessTokenCache.set(result.user.id, {
        accessToken: result.accessToken,
        expiresAt: Date.now() + (30 * 60 * 1000)
      });

      // Obtener rol y permisos basados en grupos
      const roleService = require('../services/roleService');
      const { role, permissions, groupAnalysis } = roleService.getRoleAndPermissions(result.user.groups);

      // Extraer nombre y apellido del campo name (formato: "FirstName LastName")
      const nameParts = (result.user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // NO obtener la foto aquí - solo devolver URL del endpoint
      // Esto evita que la foto en Base64 haga la URL de redirección demasiado grande
      const profilePhotoUrl = `/api/auth/photo/${result.user.id}`;

      logger.info('Usuario autenticado exitosamente:', {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: role,
        grupos: result.user.groups.length
      });

      // Codificar los datos del usuario como JSON en Base64 para pasarlos por URL
      const authData = {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: firstName,
          lastName: lastName,
          fullName: result.user.name,
          role: role,
          permissions: permissions,
          groups: result.user.groups,
          groupAnalysis: groupAnalysis
        },
        token: result.token,
        profilePhotoUrl: profilePhotoUrl || `/api/auth/photo/${result.user.id}`,
        expiresIn: process.env.JWT_EXPIRES_IN
      };

      // Codificar los datos en Base64
      const encodedData = Buffer.from(JSON.stringify(authData)).toString('base64');

      logger.info('Enviando HTML de redirección al frontend...');

      // Enviar HTML que redirige al frontend con meta refresh
      // meta refresh respeta el Content Security Policy
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Autenticación en progreso...</title>
            <meta http-equiv="refresh" content="0; url=http://localhost:5173/login?auth_data=${encodedData}">
          </head>
          <body>
            <p>Redirigiendo...</p>
            <p>Si no se redirige automáticamente, <a href="http://localhost:5173/login?auth_data=${encodedData}">haz clic aquí</a>.</p>
          </body>
        </html>
      `;

      res.send(html);

    } catch (err) {
      logger.error('Error en callback:', err);

      // Enviar error con HTML meta refresh (respeta CSP)
      const errorMsg = encodeURIComponent(err.message);
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error de autenticación</title>
            <meta http-equiv="refresh" content="0; url=http://localhost:5173/login?error=auth_error&error_description=${errorMsg}">
          </head>
          <body>
            <p>Error de autenticación. Si no se redirige automáticamente, <a href="http://localhost:5173/login?error=auth_error&error_description=${errorMsg}">haz clic aquí</a>.</p>
          </body>
        </html>
      `;

      res.send(html);
    }
  });

  /**
   * Obtener información del usuario actual
   */
  me = asyncHandler(async (req, res) => {
    try {
      const user = req.user;
      
      const userInfo = {
        id: user.id,
        email: user.email,
        name: user.name,
        groups: user.groups || [],
        tenantId: user.tenantId,
        iat: user.iat,
        exp: user.exp
      };
      
      success(res, { user: userInfo }, 'Información del usuario obtenida');
    } catch (err) {
      logger.error('Error en me:', err);
      error(res, 'Error al obtener información del usuario', 500);
    }
  });

  /**
   * Refrescar token
   */
  refresh = asyncHandler(async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return error(res, 'Refresh token requerido', 400);
      }

      const result = await authService.refreshToken(refreshToken);
      
      logger.info('Token refrescado para usuario:', result.user.id);
      
      success(res, {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          groups: result.user.groups
        },
        token: result.token,
        expiresIn: process.env.JWT_EXPIRES_IN
      }, 'Token refrescado exitosamente');
    } catch (err) {
      logger.error('Error en refresh:', err);
      error(res, 'Error al refrescar token', 500);
    }
  });

  /**
   * Cerrar sesión
   */
  logout = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      
      await authService.logout(userId);
      
      logger.info('Usuario cerró sesión:', userId);
      
      success(res, null, 'Sesión cerrada exitosamente');
    } catch (err) {
      logger.error('Error en logout:', err);
      error(res, 'Error al cerrar sesión', 500);
    }
  });

  /**
   * Verificar estado de autenticación
   */
  status = asyncHandler(async (req, res) => {
    try {
      const user = req.user;
      
      success(res, {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          groups: user.groups
        },
        tokenExpiry: new Date(user.exp * 1000)
      }, 'Usuario autenticado');
    } catch (err) {
      logger.error('Error en status:', err);
      error(res, 'Error al verificar estado', 500);
    }
  });

  /**
   * Obtener foto del perfil por URL
   */
  getPhoto = asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      // Verificar que el usuario solo pueda acceder a su propia foto
      if (req.user.id !== userId) {
        return error(res, 'Solo puedes acceder a tu propia foto de perfil', 403);
      }

      // Obtener el access token del cache
      const tokenData = accessTokenCache.get(userId);

      if (!tokenData || !tokenData.accessToken) {
        // Si no hay token en cache, devolver una imagen por defecto
        const defaultImageUrl = 'https://via.placeholder.com/150x150/4A90E2/FFFFFF?text=Usuario';
        return res.redirect(defaultImageUrl);
      }

      try {
        // Intentar obtener la foto de Azure
        const photoData = await authService.getUserPhoto(tokenData.accessToken);

        if (photoData && photoData.data) {
          // Devolver la foto en base64
          res.type(photoData.mimeType || 'image/jpeg');
          // Extraer solo los datos de base64 sin el data:image/jpeg;base64, prefix
          const base64Data = photoData.data.split(',')[1] || photoData.data;
          res.send(Buffer.from(base64Data, 'base64'));
        } else {
          // Si no hay foto, devolver imagen por defecto
          const defaultImageUrl = 'https://via.placeholder.com/150x150/4A90E2/FFFFFF?text=Usuario';
          res.redirect(defaultImageUrl);
        }
      } catch (photoError) {
        logger.warn(`No se pudo obtener foto de Azure para usuario ${userId}:`, photoError.message);
        // Devolver imagen por defecto si hay error
        const defaultImageUrl = 'https://via.placeholder.com/150x150/4A90E2/FFFFFF?text=Usuario';
        res.redirect(defaultImageUrl);
      }

    } catch (err) {
      logger.error('Error obteniendo foto:', err);
      error(res, 'Error obteniendo foto de perfil', 500);
    }
  });

  /**
   * Obtener foto en base64 (para casos específicos)
   */
  getPhotoBase64 = asyncHandler(async (req, res) => {
    try {
      // Este endpoint requeriría re-autenticación para obtener access token fresco
      success(res, {
        message: 'Para obtener foto en base64, realiza nuevo login',
        alternativeUrl: `/api/auth/photo/${req.user.id}`
      });
    } catch (err) {
      error(res, 'Error procesando solicitud', 500);
    }
  });
}

module.exports = new AuthController();