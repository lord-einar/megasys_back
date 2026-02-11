// src/modules/proveedores/controllers/SoporteNivelController.js
import soporteNivelService from '../services/soporteNivelService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class SoporteNivelController {
  listar = asyncHandler(async (req, res) => {
    const resultado = await soporteNivelService.listar(req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Niveles de soporte obtenidos correctamente');
  });

  obtener = asyncHandler(async (req, res) => {
    const nivel = await soporteNivelService.obtenerPorId(req.params.id);
    if (!nivel) return error(res, 'Nivel de soporte no encontrado', 404);
    success(res, nivel, 'Nivel de soporte obtenido correctamente');
  });

  crear = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await soporteNivelService.crear(req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'create',
      recurso: 'SoporteNivel',
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Nivel de soporte creado correctamente', 201);
  });

  actualizar = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await soporteNivelService.actualizar(req.params.id, req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'SoporteNivel',
      recursoId: req.params.id,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Nivel de soporte actualizado correctamente');
  });

  eliminar = asyncHandler(async (req, res) => {
    await TransactionWrapper.execute({
      operation: async (transaction) => await soporteNivelService.eliminar(req.params.id, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'delete',
      recurso: 'SoporteNivel',
      recursoId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, null, 'Nivel de soporte eliminado correctamente');
  });
}

export default new SoporteNivelController();
