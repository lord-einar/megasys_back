// src/modules/solicitudesCompra/controllers/solicitudCompraController.js
import solicitudCompraService from '../services/solicitudCompraService.js';
import roleService from '../../auth/services/roleService.js';
import { success, error, paginated } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { SolicitudCompraAdjunto, SolicitudCompraHistorial } from '../../../models/index.js';
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

class SolicitudCompraController {
  lookupPersonal = async (req, res) => {
    try {
      const items = await solicitudCompraService.lookupPersonal(req.query);
      return success(res, items);
    } catch (err) {
      logger.error('Error en lookup de personal para solicitudes de compra:', err);
      return error(res, err.message || 'Error al obtener personal', 500);
    }
  };

  lookupSedes = async (req, res) => {
    try {
      const items = await solicitudCompraService.lookupSedes(req.query);
      return success(res, items);
    } catch (err) {
      logger.error('Error en lookup de sedes para solicitudes de compra:', err);
      return error(res, err.message || 'Error al obtener sedes', 500);
    }
  };

  lookupInventarioAsignado = async (req, res) => {
    try {
      const items = await solicitudCompraService.lookupInventarioAsignado(req.query);
      return success(res, items);
    } catch (err) {
      logger.error('Error en lookup de inventario asignado para solicitudes de compra:', err);
      return error(res, err.message || 'Error al obtener inventario asignado', 400);
    }
  };

  listar = async (req, res) => {
    try {
      const {
        estado, tipo_equipo, motivo,
        beneficiario_personal_id,
        desde, hasta, q,
        page, limit
      } = req.query;

      const filtros = { estado, tipo_equipo, motivo, beneficiario_personal_id, desde, hasta, q };
      const { rows, count, page: p, limit: l } = await solicitudCompraService.listar(
        filtros,
        { page, limit }
      );
      return paginated(res, rows, { page: p, limit: l, total: count });
    } catch (err) {
      logger.error('Error listando solicitudes de compra:', err);
      return error(res, err.message || 'Error al listar solicitudes', 500);
    }
  };

  obtener = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.obtener(req.params.id);
      if (!solicitud) return error(res, 'Solicitud no encontrada', 404);
      return success(res, solicitud);
    } catch (err) {
      logger.error('Error obteniendo solicitud:', err);
      return error(res, err.message, 500);
    }
  };

  crear = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.crear(req.body, buildContexto(req));
      // Devolver con relaciones cargadas para que el front no haga otro fetch
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud creada correctamente', 201);
    } catch (err) {
      logger.error('Error creando solicitud:', err);
      return error(res, err.message || 'Error al crear solicitud', 400);
    }
  };

  actualizar = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.actualizar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud actualizada correctamente');
    } catch (err) {
      logger.error('Error actualizando solicitud:', err);
      return error(res, err.message, 400);
    }
  };

  aprobarInfra = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.aprobarInfra(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud aprobada por Infraestructura');
    } catch (err) {
      logger.error('Error aprobando como Infraestructura:', err);
      return error(res, err.message, 400);
    }
  };

  aprobarRrhh = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.aprobarRrhh(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud aprobada por RRHH');
    } catch (err) {
      logger.error('Error aprobando como RRHH:', err);
      return error(res, err.message, 400);
    }
  };

  registrarCompra = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.registrarCompra(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Compra registrada correctamente');
    } catch (err) {
      logger.error('Error registrando compra:', err);
      return error(res, err.message, 400);
    }
  };

  actualizarEstadoCompra = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.actualizarEstadoCompra(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Estado de compra actualizado');
    } catch (err) {
      logger.error('Error actualizando estado de compra:', err);
      return error(res, err.message, 400);
    }
  };

  finalizarSistemas = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.finalizarSistemas(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud finalizada por Sistemas');
    } catch (err) {
      logger.error('Error finalizando solicitud por Sistemas:', err);
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
      if (!req.file) {
        return error(res, 'No se recibió ningún archivo', 400);
      }

      const solicitud = await solicitudCompraService.obtener(id);
      if (!solicitud) return error(res, 'Solicitud no encontrada', 404);

      const actor = await solicitudCompraService.resolverPersonal(req.user?.email);
      const ext = path.extname(req.file.originalname).toLowerCase()
        || (req.file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
      const filename = `${randomUUID()}${ext}`;
      const folder = `solicitudes-compra/${id}`;
      const url = await storageService.uploadImage(req.file.buffer, filename, folder, req.file.mimetype);

      const adjunto = await SolicitudCompraAdjunto.create({
        solicitud_id: id,
        tipo,
        filename,
        url,
        nombre_original: req.file.originalname,
        tamanio: req.file.size,
        mime_type: req.file.mimetype,
        subido_por_id: actor.id
      });

      await SolicitudCompraHistorial.create({
        solicitud_id: id,
        accion: 'adjunto_agregado',
        actor_personal_id: actor.id,
        actor_grupo: null,
        comentario: `Adjunto ${tipo}: ${req.file.originalname}`
      });

      return success(res, adjunto, 'Adjunto cargado correctamente', 201);
    } catch (err) {
      logger.error('Error subiendo adjunto de solicitud:', err);
      return error(res, err.message || 'Error al subir adjunto', 500);
    }
  };

  rechazar = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.rechazar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud rechazada');
    } catch (err) {
      logger.error('Error rechazando solicitud:', err);
      return error(res, err.message, 400);
    }
  };

  cancelar = async (req, res) => {
    try {
      const solicitud = await solicitudCompraService.cancelar(
        req.params.id,
        req.body,
        buildContexto(req)
      );
      const completa = await solicitudCompraService.obtener(solicitud.id);
      return success(res, completa, 'Solicitud cancelada');
    } catch (err) {
      logger.error('Error cancelando solicitud:', err);
      return error(res, err.message, 400);
    }
  };
}

export default new SolicitudCompraController();
