// src/modules/auth/services/tokenCacheService.js
const logger = require('../../../shared/utils/logger');

class TokenCacheService {
  /**
   * Constructor para TokenCacheService
   * @param {number} ttl - Time to live en milisegundos (default: 30 minutos)
   * @param {number} cleanupInterval - Intervalo de limpieza en milisegundos (default: 5 minutos)
   */
  constructor(ttl = 30 * 60 * 1000, cleanupInterval = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.cleanupInterval = cleanupInterval;
    this.startCleanupInterval();

    logger.info('TokenCacheService inicializado', {
      ttl: `${ttl / 1000 / 60} minutos`,
      cleanupInterval: `${cleanupInterval / 1000 / 60} minutos`
    });
  }

  /**
   * Guardar token en cache
   */
  set(userId, accessToken) {
    try {
      const tokenData = {
        accessToken,
        expiresAt: Date.now() + this.ttl,
        createdAt: Date.now()
      };

      this.cache.set(userId, tokenData);

      logger.debug(`Token cacheado para usuario: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error guardando token en cache:', error);
      return false;
    }
  }

  /**
   * Obtener token del cache
   */
  get(userId) {
    try {
      const tokenData = this.cache.get(userId);

      if (!tokenData) {
        logger.debug(`Token no encontrado en cache para usuario: ${userId}`);
        return null;
      }

      // Verificar si el token ha expirado
      if (Date.now() > tokenData.expiresAt) {
        this.cache.delete(userId);
        logger.debug(`Token expirado para usuario: ${userId}, eliminado del cache`);
        return null;
      }

      return tokenData.accessToken;
    } catch (error) {
      logger.error('Error obteniendo token del cache:', error);
      return null;
    }
  }

  /**
   * Eliminar token del cache
   */
  delete(userId) {
    try {
      const deleted = this.cache.delete(userId);
      if (deleted) {
        logger.debug(`Token eliminado del cache para usuario: ${userId}`);
      }
      return deleted;
    } catch (error) {
      logger.error('Error eliminando token del cache:', error);
      return false;
    }
  }

  /**
   * Limpiar todos los tokens expirados
   */
  cleanup() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [userId, tokenData] of this.cache.entries()) {
        if (now > tokenData.expiresAt) {
          this.cache.delete(userId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug(`TokenCacheService: ${cleanedCount} tokens expirados eliminados`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Error en limpieza de cache:', error);
      return 0;
    }
  }

  /**
   * Iniciar intervalo de limpieza automática
   */
  startCleanupInterval() {
    this.intervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Detener intervalo de limpieza
   */
  stopCleanupInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('TokenCacheService: Intervalo de limpieza detenido');
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    return {
      totalTokens: this.cache.size,
      ttl: `${this.ttl / 1000 / 60} minutos`,
      cleanupInterval: `${this.cleanupInterval / 1000 / 60} minutos`
    };
  }

  /**
   * Limpiar todo el cache (para testing)
   */
  clear() {
    this.cache.clear();
    logger.info('TokenCacheService: Cache completamente limpiado');
  }
}

module.exports = new TokenCacheService();
