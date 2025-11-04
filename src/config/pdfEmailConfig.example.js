/**
 * Configuración PDF y Email
 * Copiar a .env y rellenar con valores reales
 */

// EMAIL CONFIGURATION
const EMAIL_CONFIG = {
  // SMTP Server
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'tu-email@megatlon.com.ar',
      pass: process.env.SMTP_PASSWORD || 'tu-password-aqui'
    }
  },

  // From address
  from: process.env.SMTP_FROM || 'noreply@megatlon.com.ar',

  // Recipients
  infraestructura: process.env.EMAIL_INFRAESTRUCTURA || 'infraestructura@megatlon.com.ar',

  // Email templates
  templates: {
    remito_infraestructura: 'Nuevo remito creado - {remito_numero}',
    remito_solicitante: 'Su remito ha sido registrado - {remito_numero}',
    confirmacion_recibida: 'Confirmación de recepción - {remito_numero}'
  }
};

// PDF CONFIGURATION
const PDF_CONFIG = {
  // Storage paths
  storagePath: process.env.PDF_STORAGE_PATH || '/backend/storage/remitos',
  confirmacionPath: process.env.PDF_CONFIRMACION_PATH || '/backend/storage/confirmaciones',

  // PDF settings
  pageSize: 'A4',
  margin: 40,

  // Font
  font: 'Helvetica',
  fontSize: {
    title: 16,
    heading: 12,
    normal: 10,
    small: 9
  },

  // Colors
  colors: {
    header: '#1a1a1a',
    text: '#333333',
    border: '#cccccc'
  }
};

// TOKEN CONFIGURATION
const TOKEN_CONFIG = {
  secret: process.env.JWT_SECRET || 'tu-secret-key-aqui',
  expiresIn: process.env.CONFIRMATION_TOKEN_EXPIRES || '30d', // 30 days
  algorithm: 'HS256'
};

module.exports = {
  EMAIL_CONFIG,
  PDF_CONFIG,
  TOKEN_CONFIG
};
