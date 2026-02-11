// src/modules/proveedores/controllers/EjecutivoCuentasController.js
import ejecutivoCuentasService from '../services/ejecutivoCuentasService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class EjecutivoCuentasController {
  listar = asyncHandler(async (req, res) => {
    const resultado = await ejecutivoCuentasService.listar(req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Ejecutivos obtenidos correctamente');
  });

  obtener = asyncHandler(async (req, res) => {
    const ejecutivo = await ejecutivoCuentasService.obtenerPorId(req.params.id);
    if (!ejecutivo) return error(res, 'Ejecutivo no encontrado', 404);
    success(res, ejecutivo, 'Ejecutivo obtenido correctamente');
  });

  crear = asyncHandler(async (req, res) => {
    try {
      const resultado = await TransactionWrapper.execute({
        operation: async (transaction) => await ejecutivoCuentasService.crear(req.body, { transaction }),
        usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
        usuarioId: req.user?.id,
        modulo: 'proveedores',
        accion: 'create',
        recurso: 'EjecutivoCuentas',
        descripcion: `Creación de ejecutivo: ${req.body.nombre}`,
        valoresNuevos: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      success(res, resultado.data, 'Ejecutivo creado correctamente', 201);
    } catch (err) {
      logger.error('Error creando ejecutivo:', err);
      error(res, err.message || 'Error al crear ejecutivo', 500);
    }
  });

  actualizar = asyncHandler(async (req, res) => {
    const previousData = await ejecutivoCuentasService.obtenerPorId(req.params.id);
    if (!previousData) return error(res, 'Ejecutivo no encontrado', 404);

    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await ejecutivoCuentasService.actualizar(req.params.id, req.body, { transaction }),
      usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'EjecutivoCuentas',
      recursoId: req.params.id,
      valoresAnteriores: previousData,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Ejecutivo actualizado correctamente');
  });

  eliminar = asyncHandler(async (req, res) => {
    const previousData = await ejecutivoCuentasService.obtenerPorId(req.params.id);
    if (!previousData) return error(res, 'Ejecutivo no encontrado', 404);

    await TransactionWrapper.execute({
      operation: async (transaction) => await ejecutivoCuentasService.eliminar(req.params.id, { transaction }),
      usuarioEmail: req.user?.email || 'sistema@aplicacion.com',
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'delete',
      recurso: 'EjecutivoCuentas',
      recursoId: req.params.id,
      valoresAnteriores: previousData,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, null, 'Ejecutivo eliminado correctamente');
  });
}

export default new EjecutivoCuentasController();
