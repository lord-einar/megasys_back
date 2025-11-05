// src/modules/empresas/controllers/empresaController.js
const empresaService = require('../services/empresaService');
const { success, error } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const TransactionWrapper = require('../../../shared/utils/transactionWrapper');

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
      const { nombre, razonSocial, cuit, direccion, telefono, email } = req.body;

      // Validaciones básicas
      if (!nombre || nombre.trim() === '') {
        return error(res, 'El nombre de la empresa es requerido', 400);
      }

      const datosEmpresa = {
        nombre: nombre.trim(),
        razonSocial: razonSocial?.trim(),
        cuit: cuit?.trim(),
        direccion: direccion?.trim(),
        telefono: telefono?.trim(),
        email: email?.trim()
      };

      // Ejecutar con transacción y auditoría
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await empresaService.crearEmpresa(datosEmpresa, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'empresas',
        accion: 'crear',
        recurso: 'Empresa',
        descripcion: `Creación de nueva empresa: ${datosEmpresa.nombre}`,
        valoresNuevos: datosEmpresa,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      logger.info('Empresa creada correctamente', { empresaId: resultado.data.id });
      success(res, resultado.data, 'Empresa creada correctamente', 201);
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
      const { nombre, razonSocial, cuit, direccion, telefono, email, activo } = req.body;

      // Obtener valores anteriores para auditoría
      const empresaAnterior = await empresaService.getEmpresaById(id);

      const datosActualizacion = {
        nombre: nombre?.trim(),
        razonSocial: razonSocial?.trim(),
        cuit: cuit?.trim(),
        direccion: direccion?.trim(),
        telefono: telefono?.trim(),
        email: email?.trim(),
        activo
      };

      // Ejecutar con transacción y auditoría
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await empresaService.actualizarEmpresa(id, datosActualizacion, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'empresas',
        accion: 'actualizar',
        recurso: 'Empresa',
        recursoId: id,
        descripcion: `Actualización de empresa: ${empresaAnterior.nombre_empresa}`,
        valoresAnteriores: {
          nombre_empresa: empresaAnterior.nombre_empresa,
          rason_social: empresaAnterior.rason_social,
          cuit: empresaAnterior.cuit,
          direccion: empresaAnterior.direccion,
          telefono: empresaAnterior.telefono,
          email: empresaAnterior.email,
          activo: empresaAnterior.activo
        },
        valoresNuevos: datosActualizacion,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      logger.info('Empresa actualizada correctamente', { empresaId: id });
      success(res, resultado.data, 'Empresa actualizada correctamente');
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

      // Obtener datos anteriores para auditoría
      const empresaAnterior = await empresaService.getEmpresaById(id);

      // Ejecutar con transacción y auditoría
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => {
          return await empresaService.eliminarEmpresa(id, { transaction });
        },
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'empresas',
        accion: 'eliminar',
        recurso: 'Empresa',
        recursoId: id,
        descripcion: `Eliminación de empresa: ${empresaAnterior.nombre_empresa}`,
        valoresAnteriores: {
          nombre_empresa: empresaAnterior.nombre_empresa,
          rason_social: empresaAnterior.rason_social,
          cuit: empresaAnterior.cuit,
          activo: empresaAnterior.activo
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      logger.info('Empresa eliminada correctamente', { empresaId: id });
      success(res, resultado.data, 'Empresa eliminada correctamente');
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
