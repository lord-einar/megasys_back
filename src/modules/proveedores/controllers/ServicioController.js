// src/modules/proveedores/controllers/ServicioController.js
import servicioService from '../services/servicioService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class ServicioController {
  listar = asyncHandler(async (req, res) => {
    const resultado = await servicioService.listar(req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Servicios obtenidos correctamente');
  });

  obtener = asyncHandler(async (req, res) => {
    const servicio = await servicioService.obtenerConDetalles(req.params.id);
    if (!servicio) return error(res, 'Servicio no encontrado', 404);
    success(res, servicio, 'Servicio obtenido correctamente');
  });

  crear = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await servicioService.crear(req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'create',
      recurso: 'Servicio',
      descripcion: `Creación de servicio: ${req.body.nombre}`,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Servicio creado correctamente', 201);
  });

  actualizar = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await servicioService.actualizar(req.params.id, req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'Servicio',
      recursoId: req.params.id,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Servicio actualizado correctamente');
  });

  eliminar = asyncHandler(async (req, res) => {
    await TransactionWrapper.execute({
      operation: async (transaction) => await servicioService.eliminar(req.params.id, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'delete',
      recurso: 'Servicio',
      recursoId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, null, 'Servicio eliminado correctamente');
  });
}

export default new ServicioController();
