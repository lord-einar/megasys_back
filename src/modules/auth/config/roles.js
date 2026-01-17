// src/modules/auth/config/roles.js - Con GUIDs específicos
/**
 * Configuración de roles y permisos con GUIDs reales
 */

// Mapeo de GUIDs de Azure AD a nombres de grupos
const GUID_TO_GROUP_MAP = {
  'edc49d22-9ee8-4d90-a8b2-41cf64db1eed': 'Infraestructura',
  '4c25f14c-c4ba-4bf9-b07b-5d03572a2661': 'Soporte',
  '88c0f708-14a1-4081-bcc6-4b3ab33a7ca6': 'Mesa de ayuda'
};

// Mapeo de grupos a roles internos (ORDEN JERÁRQUICO)
const GROUP_TO_ROLE_MAP = {
  'Infraestructura': 'super_admin',    // Prioridad 1 - MÁS ALTO
  'Mesa de ayuda': 'helpdesk',         // Prioridad 2
  'Soporte': 'support'                 // Prioridad 3 - MÁS BAJO
};

// Jerarquía de roles (de mayor a menor poder)
const ROLE_HIERARCHY = ['super_admin', 'helpdesk', 'support', 'user'];

// Definición de permisos por recurso
const PERMISSIONS = {
  // Permisos para Sedes
  sedes: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin'],
    update: ['super_admin'],
    delete: ['super_admin']
  },

  // Permisos para Personal
  personal: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin', 'helpdesk'],
    update: ['super_admin', 'helpdesk'],
    delete: ['super_admin', 'helpdesk']
  },

  // Permisos para Inventario
  inventario: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin', 'support'],
    update: ['super_admin', 'support'],
    delete: ['super_admin', 'support']
  },

  // Permisos para Remitos
  remitos: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin', 'support'],
    update: ['super_admin', 'support'],
    delete: ['super_admin', 'support']
  },

  // Permisos para Proveedores
  proveedores: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin'],
    update: ['super_admin'],
    delete: ['super_admin']
  },

  // Permisos administrativos
  admin: {
    system_settings: ['super_admin'],
    user_management: ['super_admin'],
    audit_logs: ['super_admin', 'helpdesk'],
    reports: ['super_admin', 'helpdesk', 'support']
  }
};

// Roles con descripción
const ROLES = {
  super_admin: {
    name: 'Super Administrador',
    description: 'Acceso total al sistema - Infraestructura',
    azureGroup: 'Infraestructura',
    azureGuid: 'edc49d22-9ee8-4d90-a8b2-41cf64db1eed',
    level: 1
  },
  helpdesk: {
    name: 'Mesa de Ayuda',
    description: 'Lectura total, gestión de personal',
    azureGroup: 'Mesa de ayuda',
    azureGuid: '88c0f708-14a1-4081-bcc6-4b3ab33a7ca6',
    level: 2
  },
  support: {
    name: 'Soporte',
    description: 'Gestión de inventario y remitos, lectura total',
    azureGroup: 'Soporte',
    azureGuid: '4c25f14c-c4ba-4bf9-b07b-5d03572a2661',
    level: 3
  },
  user: {
    name: 'Usuario',
    description: 'Sin permisos especiales',
    azureGroup: null,
    azureGuid: null,
    level: 4
  }
};

export {
  GUID_TO_GROUP_MAP,
  GROUP_TO_ROLE_MAP,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLES
};

export default {
  GUID_TO_GROUP_MAP,
  GROUP_TO_ROLE_MAP,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLES
};
