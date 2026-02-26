// src/modules/proveedores/controllers/SoporteNivelController.js
import soporteNivelService from '../services/soporteNivelService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class SoporteNivelController {
  /**
   * Listar niveles de soporte de un proveedor para un tipo de servicio
   * GET /proveedores/:proveedorId/soporte/:tipoServicioId
   */
  listarPorProveedorYTipo = asyncHandler(async (req, res) => {
    const { proveedorId, tipoServicioId } = req.params;
    const resultado = await soporteNivelService.listarPorProveedorYTipo(proveedorId, tipoServicioId, req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Niveles de soporte obtenidos correctamente');
  });

  /**
   * Listar todos los niveles de soporte de un proveedor
   * GET /proveedores/:proveedorId/soporte
   */
  listarPorProveedor = asyncHandler(async (req, res) => {
    const { proveedorId } = req.params;
    const resultado = await soporteNivelService.listarPorProveedor(proveedorId, req.query);
    paginated(res, resultado.rows, resultado.pagination, 'Niveles de soporte obtenidos correctamente');
  });

  /**
   * Obtener nivel de soporte por ID
   * GET /proveedores/:proveedorId/soporte/nivel/:id
   */
  obtener = asyncHandler(async (req, res) => {
    const nivel = await soporteNivelService.obtenerPorId(req.params.id);
    if (!nivel) return error(res, 'Nivel de soporte no encontrado', 404);
    success(res, nivel, 'Nivel de soporte obtenido correctamente');
  });

  /**
   * Crear nivel de soporte para un proveedor + tipo de servicio
   * POST /proveedores/:proveedorId/soporte/:tipoServicioId
   */
  crear = asyncHandler(async (req, res) => {
    const { proveedorId, tipoServicioId } = req.params;
    const resultado = await TransactionWrapper.execute({
      operation: async (transaction) => await soporteNivelService.crear(proveedorId, tipoServicioId, req.body, { transaction }),
      usuarioEmail: req.user?.email,
      usuarioId: req.user?.id,
      modulo: 'proveedores',
      accion: 'create',
      recurso: 'SoporteNivel',
      descripcion: `Creación de nivel de soporte para proveedor ${proveedorId}, tipo ${tipoServicioId}`,
      valoresNuevos: { ...req.body, proveedor_id: proveedorId, tipo_servicio_id: tipoServicioId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    success(res, resultado.data, 'Nivel de soporte creado correctamente', 201);
  });

  /**
   * Actualizar nivel de soporte
   * PUT /proveedores/:proveedorId/soporte/nivel/:id
   */
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

  /**
   * Eliminar nivel de soporte (soft delete)
   * DELETE /proveedores/:proveedorId/soporte/nivel/:id
   */
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
