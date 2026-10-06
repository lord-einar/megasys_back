// src/shared/utils/fechas.js
// El servidor corre en UTC: después de las 21 h de Argentina, toISOString()
// ya devuelve el día siguiente. Para fechas sin hora (DATEONLY) usar estas.

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/**
 * Fecha en formato YYYY-MM-DD según la hora de Argentina.
 * @param {Date} [fecha=new Date()]
 */
export const fechaArgentina = (fecha = new Date()) =>
  fecha.toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });
