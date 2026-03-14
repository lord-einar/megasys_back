// src/modules/sedes/controllers/sedeImagenController.js
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { SedeImagen, Sede } from '../../../models/index.js';
import storageService from '../../../shared/services/storageService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

const MAX_SIZE_MB = 10;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP, GIF)'));
    }
  }
}).single('imagen');

class SedeImagenController {

  async listar(req, res) {
    try {
      const { id: sedeId } = req.params;

      const sede = await Sede.findByPk(sedeId);
      if (!sede) return error(res, 'Sede no encontrada', 404);

      const imagenes = await SedeImagen.findAll({
        where: { sede_id: sedeId },
        order: [['created_at', 'ASC']]
      });

      const imagenesConUrl = await Promise.all(
        imagenes.map(async img => {
          const plain = img.toJSON();
          try {
            plain.signed_url = await storageService.getSignedImageUrl(
              img.filename,
              `sedes/imagenes/${sedeId}`
            );
          } catch {
            plain.signed_url = null;
          }
          return plain;
        })
      );

      return success(res, imagenesConUrl);
    } catch (err) {
      logger.error('Error listando imágenes de sede:', err);
      return error(res, err.message || 'Error al obtener las imágenes', 500);
    }
  }

  async subir(req, res) {
    try {
      const { id: sedeId } = req.params;
      const usuarioId = req.user?.id || null;
      const { titulo } = req.body;

      if (!req.file) {
        return error(res, 'No se recibió ninguna imagen', 400);
      }

      const sede = await Sede.findByPk(sedeId);
      if (!sede) return error(res, 'Sede no encontrada', 404);

      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const filename = `${randomUUID()}${ext}`;
      const folder = `sedes/imagenes/${sedeId}`;

      const url = await storageService.uploadImage(
        req.file.buffer,
        filename,
        folder,
        req.file.mimetype
      );

      const imagen = await SedeImagen.create({
        sede_id: sedeId,
        titulo: titulo?.trim() || null,
        filename,
        url,
        nombre_original: req.file.originalname,
        tamanio: req.file.size,
        mime_type: req.file.mimetype,
        subido_por_id: usuarioId
      });

      let signed_url = null;
      try {
        signed_url = await storageService.getSignedImageUrl(filename, folder);
      } catch { /* no bloquear si falla la firma */ }

      logger.info('Imagen de sede subida:', { sedeId, imagenId: imagen.id, filename });
      return success(res, { ...imagen.toJSON(), signed_url }, 201);

    } catch (err) {
      logger.error('Error subiendo imagen de sede:', err);
      return error(res, err.message || 'Error al subir la imagen', 500);
    }
  }

  async eliminar(req, res) {
    try {
      const { id: sedeId, imagenId } = req.params;

      const imagen = await SedeImagen.findOne({
        where: { id: imagenId, sede_id: sedeId }
      });

      if (!imagen) return error(res, 'Imagen no encontrada', 404);

      await storageService.deleteImage(imagen.filename, `sedes/imagenes/${sedeId}`);
      await imagen.destroy();

      return success(res, { mensaje: 'Imagen eliminada correctamente' });
    } catch (err) {
      logger.error('Error eliminando imagen de sede:', err);
      return error(res, err.message || 'Error al eliminar la imagen', 500);
    }
  }
}

export default new SedeImagenController();
