// src/modules/auth/controllers/authController.js - REFACTORIZADO PARA SOLID
import authService from '../services/authService.js';
import tokenCacheService from '../services/tokenCacheService.js';
import authResponseFormatter from '../services/authResponseFormatter.js';
import roleService from '../services/roleService.js';
import devAuthService from '../services/devAuthService.js';
import personalService from '../../personal/services/personalService.js';
import { GUID_TO_GROUP_MAP } from '../config/roles.js';
import { success, error } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';
import Personal from '../../../models/Personal.js';

class AuthController {
  devUsers = asyncHandler(async (req, res) => {
    if (!devAuthService.isEnabled()) {
      return error(res, 'Login de desarrollo deshabilitado', 403);
    }

    success(res, { users: devAuthService.getAvailableUsers() }, 'Usuarios de desarrollo disponibles');
  });

  devLogin = asyncHandler(async (req, res) => {
    try {
      const { user, email } = req.body || {};
      const authData = await devAuthService.login(user || email);

      logger.info('Login local de desarrollo:', {
        email: authData.user.email,
        role: authData.user.role,
        ip: req.ip
      });

      success(res, authData, 'Login de desarrollo exitoso');
    } catch (err) {
      logger.warn('Error en login local de desarrollo:', {
        message: err.message,
        statusCode: err.statusCode
      });
      error(res, err.message, err.statusCode || 500);
    }
  });

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

        const html = authResponseFormatter.formatAuthErrorRedirect(authError, error_description);
        return res.send(html);
      }

      if (!code) {
        const html = authResponseFormatter.formatMissingCodeRedirect();
        return res.send(html);
      }

      let result;
      try {
        result = await authService.processAuthCallback(code);
      } catch (authError) {
        // Verificar si es error de grupo no autorizado
        if (authError.code === 'UNAUTHORIZED_GROUP' || authError.statusCode === 403) {
          logger.warn('Intento de acceso denegado por grupo no autorizado:', {
            message: authError.message
          });
          const gruposAutorizados = Object.values(GUID_TO_GROUP_MAP).join(', ');
          const html = authResponseFormatter.formatAuthErrorRedirect(
            'unauthorized_group',
            `No tienes permiso para acceder a esta aplicación. Solo usuarios de los grupos ${gruposAutorizados} pueden ingresar. Por favor contacta a Infraestructura.`
          );
          return res.send(html);
        }
        throw authError;
      }

      // Guardar el access token en cache para obtener la foto después
      tokenCacheService.set(result.user.id, result.accessToken);

      // Obtener rol y permisos basados en grupos
      const roleInfo = roleService.getRoleAndPermissions(result.user.groups);

      logger.info('Usuario autenticado exitosamente:', {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: roleInfo.role,
        grupos: result.user.groups.length
      });

      // Auto-provisionar Personal si no existe
      let privilegioApp = roleInfo.role; // Por defecto, usar el role de Azure AD
      try {
        await personalService.autoProvisionarPersonal(result.user, roleInfo);

        // Obtener el privilegio_app y el ID del registro Personal creado/actualizado
        // Personal ya importado al inicio del archivo
        const personalRecord = await Personal.findOne({
          where: { email: result.user.email.toLowerCase() }
        });

        if (personalRecord) {
          // IMPORTANTE: Usar el ID de la tabla personal, no el de Azure AD
          result.user.id = personalRecord.id;

          if (personalRecord.privilegio_app) {
            privilegioApp = personalRecord.privilegio_app;
          }

          logger.info('Usuario mapeado a registro Personal:', {
            email: result.user.email,
            azureId: result.user.azureId || 'N/A',
            personalId: personalRecord.id,
            privilegioApp
          });
        }
      } catch (provisioningError) {
        // Log el error pero no fallar la autenticación
        logger.warn('Error en auto-provisioning durante login:', {
          email: result.user.email,
          error: provisioningError.message
        });
      }

      // Agregar privilegio_app al resultado para incluir en JWT y respuesta
      result.user.privilegioApp = privilegioApp;

      // Formatear datos de autenticación
      const authData = authResponseFormatter.formatAuthData(result, roleInfo);

      logger.info('Enviando HTML de redirección al frontend...');

      // Generar HTML con redirección
      const html = authResponseFormatter.formatSuccessRedirect(authData);
      res.send(html);

    } catch (err) {
      logger.error('Error en callback:', err);

      const html = authResponseFormatter.formatAuthErrorRedirect('auth_error', err.message);
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
        role: user.role || null,
        roleInfo: user.roleInfo || null,
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
      const accessToken = tokenCacheService.get(userId);

      if (!accessToken) {
        // Si no hay token en cache, devolver una imagen por defecto
        const defaultImageUrl = 'https://via.placeholder.com/150x150/4A90E2/FFFFFF?text=Usuario';
        return res.redirect(defaultImageUrl);
      }

      try {
        // Intentar obtener la foto de Azure
        const photoData = await authService.getUserPhoto(accessToken);

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

  /**
   * Obtener permisos del usuario actual
   */
  getPermissions = asyncHandler(async (req, res) => {
    try {
      const permissionsData = {
        user: {
          name: req.user?.name || 'Usuario',
          email: req.user?.email || 'email@test.com',
          role: req.user?.role || 'user',
          roleInfo: req.user?.roleInfo || {}
        },
        permissions: req.user?.permissions || {}
      };

      success(res, permissionsData, 'Permisos del usuario obtenidos correctamente');
    } catch (err) {
      logger.error('Error obteniendo permisos:', err);
      error(res, 'Error al obtener permisos del usuario', 500);
    }
  });

  /**
   * Análisis de grupos del usuario (debug)
   */
  debugGroups = asyncHandler(async (req, res) => {
    try {
      const analysis = roleService.analyzeUserGroups(req.user.groups || []);

      success(res, {
        user: {
          name: req.user.name,
          email: req.user.email
        },
        groupAnalysis: analysis,
        rawGroups: req.user.groups,
        guidMapping: GUID_TO_GROUP_MAP
      }, 'Análisis de grupos del usuario');
    } catch (err) {
      logger.error('Error en debugGroups:', err);
      error(res, 'Error al analizar grupos', 500);
    }
  });
}

export default new AuthController();
