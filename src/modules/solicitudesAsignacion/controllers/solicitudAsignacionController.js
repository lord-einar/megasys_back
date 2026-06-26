import solicitudAsignacionService from '../services/solicitudAsignacionService.js';
import roleService from '../../auth/services/roleService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { SolicitudAsignacion, SolicitudAsignacionAdjunto, SolicitudAsignacionHistorial } from '../../../models/index.js';
import storageService from '../../../shared/services/storageService.js';

const MAX_ADJUNTO_MB = 8;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

export const uploadAdjuntoMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ADJUNTO_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG/PNG/WEBP o PDF'));
  }
}).single('archivo');

const buildContexto = (req) => ({
  email: req.user?.email,
  roleAnalysis: roleService.analyzeUserGroups(req.user?.groups || [])
});

class SolicitudAsignacionController {
  lookupPersonal = async (req, res) => {
    try {
      const items = await solicitudAsignacionService.lookupPersonal(req.query);
      return success(res, items);
    } catch (err) {
      logger.error('Error en lookup de personal para solicitudes de asignación:', err);
      return error(res, err.message || 'Error al obtener personal', 500);
    }
  };

  lookupInventarioDisponible = async (req, res) => {
    try {
      const items = await solicitudAsignacionService.lookupInventarioDisponible(req.query);
      return success(res, items);
    } catch (err) {
      logger.error('Error en lookup de inventario disponible:', err);
      return error(res, err.message || 'Error al obtener inventario disponible', 500);
    }
  };

  listar = async (req, res) => {
    try {
      const { estado, tipo_equipo, motivo, beneficiario_personal_id, desde, hasta, q, page, limit } = req.query;
      const { rows, count, page: p, limit: l } = await solicitudAsignacionService.listar(
        { estado, tipo_equipo, motivo, beneficiario_personal_id, desde, hasta, q },
        { page, limit }
      );
      return paginated(res, rows, { page: p, limit: l, total: count });
    } catch (err) {
      logger.error('Error listando solicitudes de asignación:', err);
      return error(res, err.message || 'Error al listar solicitudes', 500);
    }
  };

  obtener = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.obtener(req.params.id);
      if (!solicitud) return error(res, 'Solicitud no encontrada', 404);
      return success(res, solicitud);
    } catch (err) {
      logger.error('Error obteniendo solicitud:', err);
      return error(res, err.message, 500);
    }
  };

  crear = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.crear(req.body, buildContexto(req));
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando solicitud:', err);
      return error(res, err.message || 'Error al crear solicitud', 400);
    }
  };

  asignarEquipo = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.asignarEquipo(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Equipo asignado correctamente');
    } catch (err) {
      logger.error('Error asignando equipo:', err);
      return error(res, err.message, 400);
    }
  };

  aprobarRrhh = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.aprobarRrhh(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud aprobada por RRHH');
    } catch (err) {
      logger.error('Error aprobando como RRHH:', err);
      return error(res, err.message, 400);
    }
  };

  lookupSoporte = async (req, res) => {
    try {
      const items = await solicitudAsignacionService.lookupSoporte();
      return success(res, items);
    } catch (err) {
      logger.error('Error en lookup de soporte:', err);
      return error(res, err.message || 'Error al obtener soporte', 500);
    }
  };

  generarRemito = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.generarRemito(
        req.params.id,
        { tecnico_id: req.body?.tecnico_id || null },
        buildContexto(req)
      );
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Remito generado correctamente');
    } catch (err) {
      logger.error('Error generando remito:', err);
      return error(res, err.message, 400);
    }
  };

  finalizar = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.finalizar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud finalizada correctamente');
    } catch (err) {
      logger.error('Error finalizando solicitud:', err);
      return error(res, err.message, 400);
    }
  };

  rechazar = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.rechazar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud rechazada');
    } catch (err) {
      logger.error('Error rechazando solicitud:', err);
      return error(res, err.message, 400);
    }
  };

  cancelar = async (req, res) => {
    try {
      const solicitud = await solicitudAsignacionService.cancelar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudAsignacionService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud cancelada');
    } catch (err) {
      logger.error('Error cancelando solicitud:', err);
      return error(res, err.message, 400);
    }
  };

  reenviarAviso = async (req, res) => {
    try {
      const resultado = await solicitudAsignacionService.reenviarAviso(req.params.id);
      return success(res, resultado, 'Aviso reenviado correctamente');
    } catch (err) {
      logger.error('Error reenviando aviso:', err);
      return error(res, err.message, 400);
    }
  };

  subirAdjunto = async (req, res) => {
    try {
      const { id } = req.params;
      const tipo = req.body?.tipo || 'otro';
      if (!['denuncia', 'rotura', 'otro'].includes(tipo)) {
        return error(res, 'Tipo de adjunto inválido', 400);
      }
      if (!req.file) return error(res, 'No se recibió ningún archivo', 400);

      const solicitud = await solicitudAsignacionService.obtener(id);
      if (!solicitud) return error(res, 'Solicitud no encontrada', 404);

      const actor = await solicitudAsignacionService.resolverPersonal(req.user?.email);
      const ext = path.extname(req.file.originalname).toLowerCase()
        || (req.file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
      const filename = `${randomUUID()}${ext}`;
      const folder = `solicitudes-asignacion/${id}`;
      const url = await storageService.uploadImage(req.file.buffer, filename, folder, req.file.mimetype);

      const adjunto = await SolicitudAsignacionAdjunto.create({
        solicitud_id: id,
        tipo,
        filename,
        url,
        nombre_original: req.file.originalname,
        tamanio: req.file.size,
        mime_type: req.file.mimetype,
        subido_por_id: actor.id
      });

      await SolicitudAsignacionHistorial.create({
        solicitud_id: id,
        accion: 'adjunto_agregado',
        actor_personal_id: actor.id,
        comentario: `Adjunto ${tipo}: ${req.file.originalname}`
      });

      return success(res, adjunto, 'Adjunto cargado correctamente', 201);
    } catch (err) {
      logger.error('Error subiendo adjunto:', err);
      return error(res, err.message || 'Error al subir adjunto', 500);
    }
  };
}

export default new SolicitudAsignacionController();
