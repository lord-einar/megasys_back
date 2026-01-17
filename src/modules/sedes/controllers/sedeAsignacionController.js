// src/modules/sedes/controllers/sedeAsignacionController.js
import sedeAsignacionService from '../services/sedeAsignacionService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import logger from '../../../shared/utils/logger.js';

class SedeAsignacionController {
  /**
   * POST /sedes/:id/asignaciones
   * Asignar un técnico de soporte a una sede
   * Solo Infraestructura puede hacer esto
   */
  asignarTecnico = asyncHandler(async (req, res) => {
    try {
      const { id: sedeId } = req.params;
      const { personal_id, notas } = req.body;

      if (!personal_id) {
        return error(res, 'El personal_id es requerido', 400);
      }

      const asignacion = await sedeAsignacionService.asignarTecnico(
        sedeId,
        personal_id,
        notas
      );

      logger.info('Técnico asignado a sede exitosamente:', {
        sedeId,
        personalId: personal_id,
        usuario: req.user?.email
      });

      success(
        res,
        asignacion,
        'Técnico asignado a la sede exitosamente',
        201
      );
    } catch (err) {
      logger.error('Error asignando técnico:', err);
      error(res, err.message || 'Error al asignar técnico', 400);
    }
  });

  /**
   * DELETE /sedes/:id/asignaciones/:personalId
   * Desasignar un técnico de una sede
   * Solo Infraestructura puede hacer esto
   */
  desasignarTecnico = asyncHandler(async (req, res) => {
    try {
      const { id: sedeId, personalId } = req.params;

      const asignacion = await sedeAsignacionService.desasignarTecnico(
        sedeId,
        personalId
      );

      logger.info('Técnico desasignado de sede exitosamente:', {
        sedeId,
        personalId,
        usuario: req.user?.email
      });

      success(res, asignacion, 'Técnico desasignado exitosamente');
    } catch (err) {
      logger.error('Error desasignando técnico:', err);
      error(res, err.message || 'Error al desasignar técnico', 400);
    }
  });

  /**
   * GET /sedes/:id/asignaciones/tecnico/activo
   * Obtener el técnico asignado actualmente a una sede
   */
  obtenerTecnicoActivo = asyncHandler(async (req, res) => {
    try {
      const { id: sedeId } = req.params;

      const asignacion = await sedeAsignacionService.obtenerTecnicoAsignado(
        sedeId
      );

      success(res, asignacion, 'Técnico asignado obtenido correctamente');
    } catch (err) {
      logger.error('Error obteniendo técnico asignado:', err);
      error(res, err.message || 'Error al obtener técnico', 500);
    }
  });

  /**
   * GET /sedes/:id/asignaciones
   * Obtener todas las asignaciones (actuales e históricas) de una sede
   */
  obtenerAsignacionesSede = asyncHandler(async (req, res) => {
    try {
      const { id: sedeId } = req.params;
      const { historicas } = req.query;

      const soloActivas = !historicas || historicas !== 'true';
      const asignaciones = await sedeAsignacionService.obtenerAsignacionesSede(
        sedeId,
        soloActivas
      );

      success(res, asignaciones, 'Asignaciones obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo asignaciones:', err);
      error(res, err.message || 'Error al obtener asignaciones', 500);
    }
  });

  /**
   * GET /personal/:id/asignaciones
   * Obtener todas las sedes asignadas a un técnico
   */
  obtenerSedesAsignadas = asyncHandler(async (req, res) => {
    try {
      const { personalId } = req.params;
      const { historicas } = req.query;

      const soloActivas = !historicas || historicas !== 'true';
      const asignaciones = await sedeAsignacionService.obtenerSedesAsignadas(
        personalId,
        soloActivas
      );

      success(res, asignaciones, 'Sedes asignadas obtenidas correctamente');
    } catch (err) {
      logger.error('Error obteniendo sedes asignadas:', err);
      error(res, err.message || 'Error al obtener sedes', 500);
    }
  });

  /**
   * GET /sedes/asignaciones/tecnicos/disponibles
   * Listar todos los técnicos disponibles del grupo Soporte
   */
  obtenerTecnicosDisponibles = asyncHandler(async (req, res) => {
    try {
      const tecnicos = await sedeAsignacionService.obtenerTecnicosDisponibles();

      success(res, tecnicos, 'Técnicos disponibles obtenidos correctamente');
    } catch (err) {
      logger.error('Error obteniendo técnicos disponibles:', err);
      error(res, err.message || 'Error al obtener técnicos', 500);
    }
  });
}

export default new SedeAsignacionController();
