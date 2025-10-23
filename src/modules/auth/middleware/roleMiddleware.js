// src/modules/auth/middleware/roleMiddleware.js - Versión jerárquica actualizada
const roleService = require('../services/roleService');
const { error } = require('../../../shared/utils/response');
const logger = require('../../../shared/utils/logger');

/**
 * Middleware para verificar permisos específicos
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return error(res, 'Usuario no autenticado', 401);
      }

      // Obtener rol del usuario (siempre el más alto por jerarquía)
      const userRole = roleService.getUserRole(req.user.groups || []);
      
      // Agregar información del rol al objeto user
      req.user.role = userRole;
      req.user.roleInfo = roleService.getRoleInfo(userRole);
      req.user.availableRoles = roleService.getUserAvailableRoles(userRole);
      
      // Verificar permiso
      const hasPermission = roleService.hasPermission(userRole, resource, action);
      
      if (!hasPermission) {
        logger.warn('Acceso denegado por falta de permisos:', {
          userId: req.user.id,
          email: req.user.email,
          userRole,
          resource,
          action,
          groups: req.user.groups?.slice(0, 5) // Solo primeros 5 grupos en log
        });
        
        return error(res, `Sin permisos para ${action} en ${resource}. Rol requerido superior a ${userRole}`, 403);
      }
      
      logger.info('Acceso autorizado:', {
        userId: req.user.id,
        userRole,
        resource,
        action
      });
      
      next();
    } catch (err) {
      logger.error('Error en middleware de permisos:', err);
      return error(res, 'Error al verificar permisos', 500);
    }
  };
};

/**
 * Middleware para verificar rol específico (respeta jerarquía)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return error(res, 'Usuario no autenticado', 401);
      }

      const userRole = roleService.getUserRole(req.user.groups || []);
      req.user.role = userRole;
      req.user.roleInfo = roleService.getRoleInfo(userRole);
      
      // Verificar si el usuario tiene suficiente jerarquía
      const hasAccess = allowedRoles.some(requiredRole => 
        roleService.hasRoleLevel(userRole, requiredRole)
      );
      
      if (!hasAccess) {
        logger.warn('Acceso denegado por jerarquía de rol:', {
          userId: req.user.id,
          userRole,
          allowedRoles
        });
        
        return error(res, 'Sin permisos suficientes para este recurso', 403);
      }
      
      next();
    } catch (err) {
      logger.error('Error en middleware de rol:', err);
      return error(res, 'Error al verificar rol', 500);
    }
  };
};

/**
 * Middleware para agregar información de rol al usuario
 */
const enrichUserWithRole = (req, res, next) => {
  try {
    if (req.user) {
      const userRole = roleService.getUserRole(req.user.groups || []);
      req.user.role = userRole;
      req.user.roleInfo = roleService.getRoleInfo(userRole);
      req.user.permissions = roleService.getUserPermissions(userRole);
      req.user.availableRoles = roleService.getUserAvailableRoles(userRole);
    }
    next();
  } catch (err) {
    logger.error('Error enriqueciendo usuario con rol:', err);
    next();
  }
};

module.exports = {
  requirePermission,
  requireRole,
  enrichUserWithRole
};