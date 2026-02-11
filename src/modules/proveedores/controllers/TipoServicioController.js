// src/modules/proveedores/controllers/TipoServicioController.js
import tipoServicioService from '../services/tipoServicioService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class TipoServicioController {
  listar = asyncHandler(async (req, res) => {
    const resultado = await tipoServicioService.listar(req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Tipos de servicio obtenidos correctamente');
  });

  obtener = asyncHandler(async (req, res) => {
    const tipo = await tipoServicioService.obtenerPorId(req.params.id);
    if (!tipo) return error(res, 'Tipo de servicio no encontrado', 404);
    success(res, tipo, 'Tipo de servicio obtenido correctamente');
  });

  crear = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await tipoServicioService.crear(req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'create',
      recurso: 'TipoServicio',
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Tipo de servicio creado correctamente', 201);
  });

  actualizar = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await tipoServicioService.actualizar(req.params.id, req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'TipoServicio',
      recursoId: req.params.id,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Tipo de servicio actualizado correctamente');
  });

  eliminar = asyncHandler(async (req, res) => {
    await TransactionWrapper.execute({
      operation: async (transaction) => await tipoServicioService.eliminar(req.params.id, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'delete',
      recurso: 'TipoServicio',
      recursoId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, null, 'Tipo de servicio eliminado correctamente');
  });
}

export default new TipoServicioController();
