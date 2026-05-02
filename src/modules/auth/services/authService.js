// src/modules/auth/services/authService.js - CORREGIDO
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { msalInstance } from '../config/msalConfig.js';
import logger from '../../../shared/utils/logger.js';
import { GUID_TO_GROUP_MAP } from '../config/roles.js';
import Personal from '../../../models/Personal.js';

// GUIDs de grupos autorizados a ingresar a la plataforma.
// Se deriva del mapeo central en config/roles.js — agregar un grupo nuevo
// allá lo habilita automáticamente acá.
const AUTHORIZED_GROUP_GUIDS = Object.keys(GUID_TO_GROUP_MAP);
const AUTHORIZED_GROUP_NAMES = Object.values(GUID_TO_GROUP_MAP);

class AuthService {
  /**
   * Validar que el usuario pertenece a uno de los grupos autorizados
   */
  validateAuthorizedGroups(userGroups = []) {
    if (!Array.isArray(userGroups) || userGroups.length === 0) {
      logger.warn('Usuario sin grupos de Azure AD - acceso denegado');
      return false;
    }

    const hasAuthorizedGroup = userGroups.some(group =>
      AUTHORIZED_GROUP_GUIDS.includes(group)
    );

    if (!hasAuthorizedGroup) {
      logger.warn('Usuario tiene grupos pero no están autorizados:', {
        userGroups,
        authorizedGroups: AUTHORIZED_GROUP_GUIDS
      });
    }

    return hasAuthorizedGroup;
  }

  /**
   * Obtener nombres de grupos a partir de GUIDs
   */
  getGroupNames(groupGuids = []) {
    return groupGuids
      .filter(guid => GUID_TO_GROUP_MAP[guid])
      .map(guid => GUID_TO_GROUP_MAP[guid]);
  }
  /**
   * Generar URL de autenticación
   */
  async generateAuthUrl() {
    try {
      const authCodeUrlParameters = {
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        redirectUri: process.env.AZURE_REDIRECT_URI,
      };

      return await msalInstance.getAuthCodeUrl(authCodeUrlParameters);
    } catch (error) {
      logger.error('Error generando URL de auth:', error);
      throw error;
    }
  }

  /**
   * Procesar callback de autenticación
   */
  async processAuthCallback(authorizationCode) {
    try {
      const tokenRequest = {
        code: authorizationCode,
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        redirectUri: process.env.AZURE_REDIRECT_URI,
      };

      const response = await msalInstance.acquireTokenByCode(tokenRequest);

      if (!response || !response.account) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      // Obtener grupos del usuario desde Azure AD
      const userGroups = response.account.idTokenClaims?.groups || [];

      // VALIDAR que el usuario pertenece a un grupo autorizado
      if (!this.validateAuthorizedGroups(userGroups)) {
        const error = new Error('No tienes permiso para acceder a esta aplicación. Por favor contacta a Infraestructura.');
        error.code = 'UNAUTHORIZED_GROUP';
        error.statusCode = 403;
        error.authorizedGroups = AUTHORIZED_GROUP_NAMES;
        throw error;
      }

      // Información BÁSICA del usuario (sin foto)
      const userInfo = {
        id: response.account.localAccountId, // Usar localAccountId en lugar de homeAccountId
        email: response.account.username,
        name: response.account.name,
        tenantId: response.account.tenantId,
        groups: userGroups,
        groupNames: this.getGroupNames(userGroups)
      };

      logger.info('Usuario autenticado exitosamente:', {
        email: userInfo.email,
        groupNames: userInfo.groupNames
      });

      // IMPORTANTE: Antes de generar el JWT, mapear al ID de la tabla Personal
      // en lugar de usar el Azure AD localAccountId
      try {
        // Personal ya importado al inicio del archivo
        const personalRecord = await Personal.findOne({
          where: { email: userInfo.email.toLowerCase() }
        });

        if (personalRecord) {
          // Guardar el Azure ID original como referencia
          userInfo.azureId = userInfo.id;
          // Usar el ID de la tabla Personal
          userInfo.id = personalRecord.id;

          logger.info('Usuario mapeado a ID de Personal:', {
            email: userInfo.email,
            azureId: userInfo.azureId,
            personalId: personalRecord.id
          });
        }
      } catch (mappingError) {
        logger.warn('Error mapeando usuario a Personal, usando Azure ID:', {
          email: userInfo.email,
          error: mappingError.message
        });
      }

      // Generar JWT token con el ID de Personal (no el de Azure)
      const token = this.generateJWT(userInfo);

      return {
        user: userInfo,
        token,
        accessToken: response.accessToken
      };
    } catch (error) {
      logger.error('Error en processAuthCallback:', error);
      throw error;
    }
  }

  /**
   * Generar JWT token con privilegios de aplicación
   */
  generateJWT(userInfo) {
    try {
      const payload = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        groups: userInfo.groups,
        tenantId: userInfo.tenantId,
        privilegioApp: userInfo.privilegioApp || 'user'
      };

      return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'sistema-gestion-backend',
        audience: 'sistema-gestion-frontend'
      });
    } catch (error) {
      logger.error('Error generando JWT:', error);
      throw error;
    }
  }

  /**
   * Crear token local para usuarios de desarrollo.
   * Este método no valida credenciales externas y debe usarse solo detrás
   * de endpoints protegidos por ambiente de desarrollo.
   */
  generateDevJWT(personal, groups = []) {
    const userInfo = {
      id: personal.id,
      email: personal.email,
      name: `${personal.nombre} ${personal.apellido}`,
      groups,
      tenantId: 'local-development',
      privilegioApp: personal.privilegio_app || 'user'
    };

    return this.generateJWT(userInfo);
  }

  /**
   * Verificar JWT token
   */
  verifyJWT(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      logger.error('Error verificando JWT:', error);
      throw error;
    }
  }

  /**
   * Refrescar token
   */
  async refreshToken(refreshToken) {
    try {
      const refreshTokenRequest = {
        refreshToken: refreshToken,
        scopes: ['openid', 'profile', 'email', 'User.Read'],
      };

      const response = await msalInstance.acquireTokenByRefreshToken(refreshTokenRequest);

      if (!response || !response.account) {
        throw new Error('No se pudo refrescar el token');
      }

      const userInfo = {
        id: response.account.homeAccountId,
        email: response.account.username,
        name: response.account.name,
        tenantId: response.account.tenantId,
        groups: response.account.idTokenClaims?.groups || []
      };

      const token = this.generateJWT(userInfo);

      return {
        user: userInfo,
        token,
        accessToken: response.accessToken
      };
    } catch (error) {
      logger.error('Error en refreshToken:', error);
      throw error;
    }
  }

  /**
   * Cerrar sesión
   */
  async logout(userId) {
    try {
      logger.info(`Usuario ${userId} cerró sesión`);
      return true;
    } catch (error) {
      logger.error('Error en logout:', error);
      throw error;
    }
  }

  /**
   * Obtener foto del perfil por separado
   */
  async getUserPhoto(accessToken) {
    try {
      // axios ya importado al inicio del archivo

      const photoResponse = await axios.get('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        responseType: 'arraybuffer'
      });

      const photoBuffer = Buffer.from(photoResponse.data);
      const photoBase64 = photoBuffer.toString('base64');
      const photoMimeType = photoResponse.headers['content-type'] || 'image/jpeg';

      return {
        data: `data:${photoMimeType};base64,${photoBase64}`,
        mimeType: photoMimeType,
        size: photoBuffer.length
      };

    } catch (error) {
      logger.warn('No se pudo obtener la foto de perfil:', error.message);
      return null;
    }
  }
}

export default new AuthService();
