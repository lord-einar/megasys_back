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

/**
 * Middleware para verificar que el usuario tiene un rol específico en base de datos
 * Verifica contra la tabla Personal.rol_id
 */
const requireDatabaseRole = (roleName) => {
  const { Personal, Rol } = require('../../../models');

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return error(res, 'Usuario no autenticado', 401);
      }

      // Buscar el usuario en base de datos por email
      const personal = await Personal.findOne({
        where: { email: req.user.email.toLowerCase(), activo: true },
        include: [{
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre']
        }]
      });

      if (!personal) {
        logger.warn('Personal no encontrado para email:', {
          email: req.user.email,
          userId: req.user.id
        });
        return error(res, 'Usuario no registrado en el sistema', 404);
      }

      // Verificar si tiene el rol requerido
      if (!personal.rol || personal.rol.nombre !== roleName) {
        logger.warn('Acceso denegado por rol insuficiente en BD:', {
          email: req.user.email,
          rolRequerido: roleName,
          rolActual: personal.rol?.nombre || 'ninguno'
        });
        return error(res, `Se requiere el rol "${roleName}" para acceder a este recurso`, 403);
      }

      // Agregar información al request
      req.user.personalId = personal.id;
      req.user.databaseRole = personal.rol.nombre;
      req.user.personalData = personal;

      logger.info('Acceso autorizado por rol de BD:', {
        email: req.user.email,
        rol: roleName,
        personalId: personal.id
      });

      next();
    } catch (err) {
      logger.error('Error en middleware de rol de base de datos:', err);
      return error(res, 'Error al verificar rol', 500);
    }
  };
};

module.exports = {
  requirePermission,
  requireRole,
  enrichUserWithRole,
  requireDatabaseRole
};