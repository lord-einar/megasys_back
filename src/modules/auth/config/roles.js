// src/modules/auth/config/roles.js - Con GUIDs específicos
/**
 * Configuración de roles y permisos con GUIDs reales
 */

// Mapeo de GUIDs de Azure AD a nombres de grupos
const GUID_TO_GROUP_MAP = {
  'edc49d22-9ee8-4d90-a8b2-41cf64db1eed': 'Infraestructura',
  '4c25f14c-c4ba-4bf9-b07b-5d03572a2661': 'Soporte',
  '88c0f708-14a1-4081-bcc6-4b3ab33a7ca6': 'Mesa de ayuda',
  '55feb1c9-997c-4545-b383-ca9b55967500': 'Administracion de personal',
  'fec8b151-9369-475c-b47d-e786d5c4c812': 'Compras'
};

// Mapeo de grupos a roles internos (ORDEN JERÁRQUICO)
const GROUP_TO_ROLE_MAP = {
  'Infraestructura': 'super_admin',    // Prioridad 1 - MÁS ALTO
  'Mesa de ayuda': 'helpdesk',         // Prioridad 2
  'Soporte': 'support',                // Prioridad 3
  'Administracion de personal': 'rrhh', // Área funcional (paralela)
  'Compras': 'compras'                 // Área funcional (paralela)
};

// Jerarquía de roles (de mayor a menor poder).
// rrhh y compras se ubican al final porque son áreas funcionales:
// las decisiones del workflow de solicitudes de compra se chequean
// por GRUPO (requireGroup), no por jerarquía.
const ROLE_HIERARCHY = ['super_admin', 'helpdesk', 'support', 'rrhh', 'compras', 'user'];

// Definición de permisos por recurso
const PERMISSIONS = {
  // Permisos para Sedes
  sedes: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin'],
    update: ['super_admin', 'helpdesk', 'support'],
    delete: ['super_admin']
  },

  // Permisos para Personal
  personal: {
    read: ['super_admin', 'helpdesk', 'support'],
    create: ['super_admin', 'helpdesk', 'support'],
    update: ['super_admin', 'helpdesk', 'support'],
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
    create: ['super_admin', 'helpdesk'],
    update: ['super_admin', 'helpdesk'],
    delete: ['super_admin', 'helpdesk']
  },

  // Permisos administrativos
  admin: {
    system_settings: ['super_admin'],
    user_management: ['super_admin'],
    audit_logs: ['super_admin', 'helpdesk'],
    reports: ['super_admin']
  },

  // Permisos para CRM (Dynamics 365)
  crm: {
    read: ['super_admin', 'helpdesk', 'support']
  },

  // Permisos para Solicitudes de Compra de equipos (celulares y notebooks)
  // Las acciones del workflow (aprobar_infra, aprobar_rrhh, registrar_compra)
  // se validan por GRUPO Azure, no por rol jerárquico.
  solicitudes_compra: {
    read: ['super_admin', 'rrhh', 'compras'],
    create: ['super_admin', 'rrhh', 'compras'],
    update: ['super_admin', 'rrhh', 'compras'],
    cancelar: ['super_admin', 'rrhh', 'compras'],
    aprobar_infra: ['super_admin'],
    aprobar_rrhh: ['rrhh'],
    registrar_compra: ['compras'],
    rechazar: ['super_admin', 'rrhh'],
    dashboard: ['super_admin', 'rrhh', 'compras']
  },

  // Catálogo de equipos aprobados (marca/modelo de celulares y notebooks)
  catalogo_equipos: {
    read: ['super_admin', 'helpdesk', 'support', 'rrhh', 'compras'],
    create: ['super_admin'],
    update: ['super_admin'],
    delete: ['super_admin']
  },

  // Solicitudes de asignación de equipos del stock
  solicitudes_asignacion: {
    read: ['super_admin', 'rrhh', 'compras'],
    create: ['super_admin', 'rrhh'],
    update: ['super_admin', 'rrhh'],
    cancelar: ['super_admin', 'rrhh', 'compras'],
    rechazar: ['super_admin', 'rrhh'],
    dashboard: ['super_admin', 'rrhh', 'compras']
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
    description: 'Gestión de personal y sedes, lectura del resto',
    azureGroup: 'Mesa de ayuda',
    azureGuid: '88c0f708-14a1-4081-bcc6-4b3ab33a7ca6',
    level: 2
  },
  support: {
    name: 'Soporte',
    description: 'Gestión de inventario, personal, sedes y remitos propios',
    azureGroup: 'Soporte',
    azureGuid: '4c25f14c-c4ba-4bf9-b07b-5d03572a2661',
    level: 3
  },
  rrhh: {
    name: 'Recursos Humanos',
    description: 'Aprobación de solicitudes de compra desde RRHH',
    azureGroup: 'Administracion de personal',
    azureGuid: '55feb1c9-997c-4545-b383-ca9b55967500',
    level: 3
  },
  compras: {
    name: 'Compras',
    description: 'Registro de compras y cierre de solicitudes',
    azureGroup: 'Compras',
    azureGuid: 'fec8b151-9369-475c-b47d-e786d5c4c812',
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
