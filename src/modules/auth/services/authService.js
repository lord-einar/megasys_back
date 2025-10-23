// src/modules/auth/services/authService.js - CORREGIDO
const jwt = require('jsonwebtoken');
const { msalInstance } = require('../config/msalConfig');
const logger = require('../../../shared/utils/logger');

class AuthService {
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

      // Información BÁSICA del usuario (sin foto)
      const userInfo = {
        id: response.account.homeAccountId,
        email: response.account.username,
        name: response.account.name,
        tenantId: response.account.tenantId,
        groups: response.account.idTokenClaims?.groups || []
      };

      // Generar JWT token SOLO con datos básicos
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
   * Generar JWT token (SOLO datos básicos)
   */
  generateJWT(userInfo) {
    try {
      const payload = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        groups: userInfo.groups,
        tenantId: userInfo.tenantId
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
      const axios = require('axios');
      
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

module.exports = new AuthService();