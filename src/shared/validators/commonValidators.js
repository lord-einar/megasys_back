// src/shared/validators/commonValidators.js - VALIDACIONES COMUNES COMPARTIDAS
import { Personal, Sede, TipoArticulo, Rol } from '../../models/index.js';

/**
 * Validadores comunes reutilizables entre servicios
 * Centraliza validaciones que antes estaban duplicadas
 */
class CommonValidators {
  /**
   * Validar que una persona existe y está activa
   * @param {string} personalId - UUID de la persona
   * @param {string} label - Etiqueta para el mensaje de error
   * @returns {Promise<Object>} La persona encontrada
   * @throws {Error} Si no existe o no está activa
   */
  static async validarPersonaActiva(personalId, label = 'Personal') {
    const persona = await Personal.findOne({
      where: {
        id: personalId,
        activo: true
      }
    });

    if (!persona) {
      throw new Error(`${label} no existe o no está activo`);
    }

    return persona;
  }

  /**
   * Validar que una sede existe y está activa
   * @param {string} sedeId - UUID de la sede
   * @param {string} label - Etiqueta para el mensaje de error
   * @returns {Promise<Object>} La sede encontrada
   * @throws {Error} Si no existe o no está activa
   */
  static async validarSedeActiva(sedeId, label = 'Sede') {
    const sede = await Sede.findOne({
      where: {
        id: sedeId,
        activo: true
      }
    });

    if (!sede) {
      throw new Error(`${label} no existe o no está activa`);
    }

    return sede;
  }

  /**
   * Validar que un tipo de artículo existe y está activo
   * @param {string} tipoArticuloId - UUID del tipo de artículo
   * @param {string} label - Etiqueta para el mensaje de error
   * @returns {Promise<Object>} El tipo de artículo encontrado
   * @throws {Error} Si no existe o no está activo
   */
  static async validarTipoArticuloActivo(tipoArticuloId, label = 'Tipo de artículo') {
    const tipoArticulo = await TipoArticulo.findOne({
      where: {
        id: tipoArticuloId,
        activo: true
      }
    });

    if (!tipoArticulo) {
      throw new Error(`${label} no existe o no está activo`);
    }

    return tipoArticulo;
  }

  /**
   * Validar que un rol existe y está activo
   * @param {string} rolId - UUID del rol
   * @param {string} label - Etiqueta para el mensaje de error
   * @returns {Promise<Object>} El rol encontrado
   * @throws {Error} Si no existe o no está activo
   */
  static async validarRolActivo(rolId, label = 'Rol') {
    const rol = await Rol.findOne({
      where: {
        id: rolId,
        activo: true
      }
    });

    if (!rol) {
      throw new Error(`${label} no existe o no está activo`);
    }

    return rol;
  }

  /**
   * Validar múltiples sedes activas
   * @param {Array<string>} sedeIds - Array de UUIDs de sedes
   * @param {boolean} requerirAlMenosUna - Si true, lanza error si el array está vacío
   * @throws {Error} Si alguna sede no existe o no está activa
   */
  static async validarSedesActivas(sedeIds, requerirAlMenosUna = true) {
    if (!Array.isArray(sedeIds) || sedeIds.length === 0) {
      if (requerirAlMenosUna) {
        throw new Error('Debes seleccionar al menos una sede');
      }
      return;
    }

    const sedesValidas = await Sede.count({
      where: {
        id: sedeIds,
        activo: true
      }
    });

    if (sedesValidas !== sedeIds.length) {
      const inactivas = sedeIds.length - sedesValidas;
      throw new Error(`${inactivas} de las sedes seleccionadas no existen o están inactivas`);
    }
  }

  /**
   * Validar formato UUID
   * @param {string} id - String a validar
   * @returns {boolean} True si es UUID válido
   */
  static esUuidValido(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}

export default CommonValidators;
