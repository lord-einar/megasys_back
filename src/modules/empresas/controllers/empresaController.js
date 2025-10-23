// src/modules/empresas/controllers/empresaController.js
const empresaService = require('../services/empresaService');
const { success, error } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');

class EmpresaController {
  /**
   * Obtener todas las empresas activas (para combobox)
   */
  activas = asyncHandler(async (req, res) => {
    try {
      const empresas = await empresaService.getEmpresasActivas();
      success(res, empresas, 'Empresas activas obtenidas');
    } catch (err) {
      logger.error('Error obteniendo empresas activas:', err);
      error(res, 'Error al obtener empresas activas', 500);
    }
  });

  /**
   * Obtener todas las empresas
   */
  todas = asyncHandler(async (req, res) => {
    try {
      const filtros = {
        nombre: req.query.nombre,
        activo: req.query.activo === 'false' ? false : req.query.activo === 'true' ? true : undefined
      };

      const empresas = await empresaService.getTodasLasEmpresas(filtros);
      success(res, empresas, 'Empresas obtenidas');
    } catch (err) {
      logger.error('Error obteniendo empresas:', err);
      error(res, 'Error al obtener empresas', 500);
    }
  });

  /**
   * Obtener empresa por ID
   */
  obtenerPorId = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const empresa = await empresaService.getEmpresaById(id);
      success(res, empresa, 'Empresa obtenida');
    } catch (err) {
      logger.error('Error obteniendo empresa:', err);
      if (err.message === 'Empresa no encontrada') {
        error(res, 'Empresa no encontrada', 404);
      } else {
        error(res, 'Error al obtener empresa', 500);
      }
    }
  });

  /**
   * Crear nueva empresa
   */
  crear = asyncHandler(async (req, res) => {
    try {
      const { nombre, razonSocial, rfc, direccion, telefono, email, sitioWeb } = req.body;

      // Validaciones básicas
      if (!nombre || nombre.trim() === '') {
        return error(res, 'El nombre de la empresa es requerido', 400);
      }

      const empresa = await empresaService.crearEmpresa({
        nombre: nombre.trim(),
        razonSocial: razonSocial?.trim(),
        rfc: rfc?.trim(),
        direccion: direccion?.trim(),
        telefono: telefono?.trim(),
        email: email?.trim(),
        sitioWeb: sitioWeb?.trim()
      });

      logger.info('Empresa creada por usuario', { empresaId: empresa.id });
      success(res, empresa, 'Empresa creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando empresa:', err);
      error(res, err.message || 'Error al crear empresa', 500);
    }
  });

  /**
   * Actualizar empresa
   */
  actualizar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, razonSocial, rfc, direccion, telefono, email, sitioWeb, activo } = req.body;

      const empresa = await empresaService.actualizarEmpresa(id, {
        nombre: nombre?.trim(),
        razonSocial: razonSocial?.trim(),
        rfc: rfc?.trim(),
        direccion: direccion?.trim(),
        telefono: telefono?.trim(),
        email: email?.trim(),
        sitioWeb: sitioWeb?.trim(),
        activo
      });

      logger.info('Empresa actualizada por usuario', { empresaId: id });
      success(res, empresa, 'Empresa actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando empresa:', err);
      if (err.message === 'Empresa no encontrada') {
        error(res, 'Empresa no encontrada', 404);
      } else {
        error(res, err.message || 'Error al actualizar empresa', 500);
      }
    }
  });

  /**
   * Eliminar empresa
   */
  eliminar = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const resultado = await empresaService.eliminarEmpresa(id);

      logger.info('Empresa eliminada por usuario', { empresaId: id });
      success(res, resultado, 'Empresa eliminada correctamente');
    } catch (err) {
      logger.error('Error eliminando empresa:', err);
      if (err.message === 'Empresa no encontrada') {
        error(res, 'Empresa no encontrada', 404);
      } else {
        error(res, err.message || 'Error al eliminar empresa', 500);
      }
    }
  });
}

module.exports = new EmpresaController();
