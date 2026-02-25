/**
 * Token Service
 * Genera y valida tokens JWT para confirmaci�n de recepci�n de remitos
 */

import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const TOKEN_SECRET = process.env.CONFIRMATION_TOKEN_SECRET || process.env.JWT_SECRET || 'default-confirmation-secret-change-in-production';
const TOKEN_EXPIRATION = process.env.CONFIRMATION_TOKEN_EXPIRES || '30d';

class TokenService {
  /**
   * Generar token de confirmaci�n
   * @param {number} remitoId - ID del remito
   * @param {string} email - Email del solicitante
   * @returns {string} Token JWT
   */
  generarTokenConfirmacion(remitoId, email) {
    try {
      const payload = {
        remitoId,
        email,
        tipo: 'confirmacion_recepcion',
        generadoEn: new Date().toISOString()
      };

      const token = jwt.sign(payload, TOKEN_SECRET, {
        expiresIn: TOKEN_EXPIRATION,
        algorithm: 'HS256'
      });

      logger.info('Token de confirmaci�n generado:', {
        remitoId,
        email,
        expiresIn: TOKEN_EXPIRATION
      });

      return token;
    } catch (error) {
      logger.error('Error generando token de confirmaci�n:', {
        error: error.message,
        remitoId,
        email
      });
      throw error;
    }
  }

  /**
   * Validar token de confirmaci�n
   * @param {string} token - Token JWT
   * @returns {object} Payload del token (remitoId, email, etc.)
   */
  validarTokenConfirmacion(token) {
    try {
      const payload = jwt.verify(token, TOKEN_SECRET, {
        algorithms: ['HS256']
      });

      if (payload.tipo !== 'confirmacion_recepcion') {
        throw new Error('Tipo de token inv�lido');
      }

      logger.info('Token de confirmaci�n validado:', {
        remitoId: payload.remitoId,
        email: payload.email
      });

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.warn('Token de confirmaci�n expirado:', {
          error: error.message,
          expiresAt: error.expiredAt
        });
        throw new Error('El token de confirmaci�n ha expirado');
      }

      if (error.name === 'JsonWebTokenError') {
        logger.warn('Token de confirmaci�n inv�lido:', {
          error: error.message
        });
        throw new Error('Token de confirmaci�n inv�lido');
      }

      logger.error('Error validando token de confirmaci�n:', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generar URL de confirmaci�n
   * @param {number} remitoId - ID del remito
   * @param {string} email - Email del solicitante
   * @param {string} baseUrl - URL base de la aplicaci�n
   * @returns {string} URL completa de confirmaci�n
   */
  generarUrlConfirmacion(remitoId, email, baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000') {
    try {
      const token = this.generarTokenConfirmacion(remitoId, email);
      const url = `${baseUrl}/confirmar-recepcion?remito=${remitoId}&token=${token}`;

      logger.info('URL de confirmaci�n generada:', {
        remitoId,
        email,
        urlLength: url.length
      });

      return url;
    } catch (error) {
      logger.error('Error generando URL de confirmaci�n:', {
        error: error.message,
        remitoId,
        email
      });
      throw error;
    }
  }
}

export default new TokenService();
