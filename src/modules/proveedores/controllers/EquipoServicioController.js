// src/modules/proveedores/controllers/EquipoServicioController.js
import equipoServicioService from '../services/equipoServicioService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class EquipoServicioController {
  listar = asyncHandler(async (req, res) => {
    const resultado = await equipoServicioService.listar(req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Equipos obtenidos correctamente');
  });

  obtener = asyncHandler(async (req, res) => {
    const equipo = await equipoServicioService.obtenerConDetalles(req.params.id);
    if (!equipo) return error(res, 'Equipo no encontrado', 404);
    success(res, equipo, 'Equipo obtenido correctamente');
  });

  crear = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await equipoServicioService.crear(req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'create',
      recurso: 'EquipoServicio',
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Equipo creado correctamente', 201);
  });

  actualizar = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await equipoServicioService.actualizar(req.params.id, req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'EquipoServicio',
      recursoId: req.params.id,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Equipo actualizado correctamente');
  });

  eliminar = asyncHandler(async (req, res) => {
    await TransactionWrapper.execute({
      operation: async (transaction) => await equipoServicioService.eliminar(req.params.id, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'delete',
      recurso: 'EquipoServicio',
      recursoId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, null, 'Equipo eliminado correctamente');
  });
}

export default new EquipoServicioController();
