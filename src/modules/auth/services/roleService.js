// src/modules/auth/services/roleService.js - Actualizado para usar GUIDs
import { GUID_TO_GROUP_MAP, GROUP_TO_ROLE_MAP, ROLE_HIERARCHY, PERMISSIONS, ROLES } from '../config/roles.js';
import logger from '../../../shared/utils/logger.js';

class RoleService {
  /**
   * Obtener el rol MÁS ALTO del usuario basado en GUIDs de Azure AD
   */
  getUserRole(azureGroups = []) {
    logger.info('Procesando grupos del usuario:', {
      totalGroups: azureGroups.length,
      relevantGroups: this.getRelevantGroups(azureGroups)
    });
    
    // Buscar el rol con mayor jerarquía usando GUIDs
    for (const role of ROLE_HIERARCHY) {
      // Encontrar el grupo que corresponde a este rol
      const groupName = Object.keys(GROUP_TO_ROLE_MAP).find(
        group => GROUP_TO_ROLE_MAP[group] === role
      );
      
      if (groupName) {
        // Buscar el GUID que corresponde a este grupo
        const groupGuid = Object.keys(GUID_TO_GROUP_MAP).find(
          guid => GUID_TO_GROUP_MAP[guid] === groupName
        );
        
        if (groupGuid && azureGroups.includes(groupGuid)) {
          logger.info(`✅ Usuario asignado al rol de mayor jerarquía: ${role}`, {
            grupo: groupName,
            guid: groupGuid,
            nivel: ROLES[role].level
          });
          return role;
        }
      }
    }
    
    // Si no encuentra ningún grupo válido, rol por defecto
    logger.warn('⚠️ Usuario sin rol específico, asignando rol básico', {
      gruposRecibidos: azureGroups.length,
      gruposRelevantes: this.getRelevantGroups(azureGroups)
    });
    return 'user';
  }

  /**
   * Obtener grupos relevantes para debugging
   */
  getRelevantGroups(azureGroups = []) {
    const relevant = {};
    
    azureGroups.forEach(guid => {
      if (GUID_TO_GROUP_MAP[guid]) {
        relevant[guid] = GUID_TO_GROUP_MAP[guid];
      }
    });
    
    return relevant;
  }

  /**
   * Verificar si el usuario tiene un grupo específico
   */
  hasGroup(azureGroups, groupName) {
    const groupGuid = Object.keys(GUID_TO_GROUP_MAP).find(
      guid => GUID_TO_GROUP_MAP[guid] === groupName
    );
    
    return groupGuid && azureGroups.includes(groupGuid);
  }

  /**
   * Verificar si el usuario tiene permiso específico
   */
  hasPermission(userRole, resource, action) {
    if (!PERMISSIONS[resource]) {
      logger.warn(`Recurso no encontrado: ${resource}`);
      return false;
    }
    
    if (!PERMISSIONS[resource][action]) {
      logger.warn(`Acción no encontrada: ${action} para recurso ${resource}`);
      return false;
    }
    
    return PERMISSIONS[resource][action].includes(userRole);
  }

  /**
   * Verificar si un rol tiene permisos de otro rol (jerarquía)
   */
  hasRoleLevel(userRole, requiredRole) {
    const userLevel = ROLES[userRole]?.level || 999;
    const requiredLevel = ROLES[requiredRole]?.level || 999;
    
    // Menor número = mayor jerarquía
    return userLevel <= requiredLevel;
  }

  /**
   * Obtener todos los permisos del usuario
   */
  getUserPermissions(userRole) {
    const permissions = {};
    
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      permissions[resource] = {};
      
      for (const [action, allowedRoles] of Object.entries(actions)) {
        permissions[resource][action] = allowedRoles.includes(userRole);
      }
    }
    
    return permissions;
  }

  /**
   * Obtener información del rol
   */
  getRoleInfo(roleName) {
    return ROLES[roleName] || null;
  }

  /**
   * Obtener todos los roles que el usuario puede "actuar como"
   */
  getUserAvailableRoles(userRole) {
    const userLevel = ROLES[userRole]?.level || 999;
    
    return Object.keys(ROLES).filter(role => {
      const roleLevel = ROLES[role]?.level || 999;
      return roleLevel >= userLevel;
    });
  }

  /**
   * Obtener análisis detallado de grupos del usuario
   */
  analyzeUserGroups(azureGroups = []) {
    const analysis = {
      totalGroups: azureGroups.length,
      relevantGroups: this.getRelevantGroups(azureGroups),
      assignedRole: this.getUserRole(azureGroups),
      hasInfraestructura: this.hasGroup(azureGroups, 'Infraestructura'),
      hasMesaAyuda: this.hasGroup(azureGroups, 'Mesa de ayuda'),
      hasSoporte: this.hasGroup(azureGroups, 'Soporte'),
      hasRRHH: this.hasGroup(azureGroups, 'RRHH Acceso PortalIT'),
      hasCompras: this.hasGroup(azureGroups, 'Compras')
    };

    logger.info('📊 Análisis de grupos del usuario:', analysis);
    return analysis;
  }

  /**
   * Obtener rol y permisos completos del usuario (para el frontend)
   */
  getRoleAndPermissions(azureGroups = []) {
    const role = this.getUserRole(azureGroups);
    const permissions = this.getUserPermissions(role);
    const groupAnalysis = this.analyzeUserGroups(azureGroups);

    return {
      role,
      permissions,
      groupAnalysis
    };
  }
}

export default new RoleService();