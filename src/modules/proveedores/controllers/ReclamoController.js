// src/modules/proveedores/controllers/ReclamoController.js
import reclamoService from '../services/reclamoService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class ReclamoController {
  listar = asyncHandler(async (req, res) => {
    const resultado = await reclamoService.listar(req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Reclamos obtenidos correctamente');
  });

  obtener = asyncHandler(async (req, res) => {
    const reclamo = await reclamoService.obtenerConDetalles(req.params.id);
    if (!reclamo) return error(res, 'Reclamo no encontrado', 404);
    success(res, reclamo, 'Reclamo obtenido correctamente');
  });

  crear = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await reclamoService.crear(req.body, req.user.id, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'create',
      recurso: 'Reclamo',
      descripcion: `Creación de reclamo: ${req.body.titulo}`,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Reclamo creado correctamente', 201);
  });

  actualizar = asyncHandler(async (req, res) => {
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await reclamoService.actualizar(req.params.id, req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'Reclamo',
      recursoId: req.params.id,
      valoresNuevos: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Reclamo actualizado correctamente');
  });

  cambiarEstado = asyncHandler(async (req, res) => {
    const { estado } = req.body;
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await reclamoService.cambiarEstado(req.params.id, estado, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'Reclamo',
      recursoId: req.params.id,
      descripcion: `Cambio de estado a: ${estado}`,
      valoresNuevos: { estado },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Estado actualizado correctamente');
  });

  asignarTecnico = asyncHandler(async (req, res) => {
    const { tecnico_id } = req.body;
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await reclamoService.asignarTecnico(req.params.id, tecnico_id, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'update',
      recurso: 'Reclamo',
      recursoId: req.params.id,
      descripcion: `Asignación de técnico`,
      valoresNuevos: { tecnico_id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Técnico asignado correctamente');
  });

  obtenerEstadisticas = asyncHandler(async (req, res) => {
    const estadisticas = await reclamoService.obtenerEstadisticas();
    success(res, estadisticas, 'Estadísticas obtenidas correctamente');
  });
}

export default new ReclamoController();
