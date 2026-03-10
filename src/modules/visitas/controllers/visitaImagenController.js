// src/modules/visitas/controllers/visitaImagenController.js
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { VisitaImagen, VisitaInforme, Visita } from '../../../models/index.js';
import storageService from '../../../shared/services/storageService.js';
import { success, error } from '../../../shared/utils/response.js';
import logger from '../../../shared/utils/logger.js';

const MAX_SIZE_MB = 5;
const MAX_IMAGES = 10;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Multer: memoria (el buffer va directo a R2)
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

class VisitaImagenController {

  async subir(req, res) {
    // multer ya procesó el archivo en req.file
    try {
      const { id: visitaId } = req.params;
      const usuarioId = req.user?.id || null;

      if (!req.file) {
        return error(res, 'No se recibió ninguna imagen', 400);
      }

      // Buscar informe de la visita
      const informe = await VisitaInforme.findOne({ where: { visita_id: visitaId } });
      if (!informe) {
        return error(res, 'Esta visita no tiene informe. Completá el informe antes de subir imágenes.', 400);
      }

      // Verificar límite
      const totalActual = await VisitaImagen.count({ where: { informe_id: informe.id } });
      if (totalActual >= MAX_IMAGES) {
        return error(res, `Se alcanzó el límite de ${MAX_IMAGES} imágenes por visita.`, 400);
      }

      // Generar nombre único
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const filename = `${randomUUID()}${ext}`;
      const folder = `visitas/imagenes/${visitaId}`;

      // Subir a R2
      const url = await storageService.uploadImage(
        req.file.buffer,
        filename,
        folder,
        req.file.mimetype
      );

      // Guardar en DB
      const imagen = await VisitaImagen.create({
        informe_id: informe.id,
        filename,
        url,
        nombre_original: req.file.originalname,
        tamanio: req.file.size,
        mime_type: req.file.mimetype,
        subido_por_id: usuarioId
      });

      logger.info('Imagen de visita subida:', { visitaId, imagenId: imagen.id, filename });
      return success(res, imagen, 201);

    } catch (err) {
      logger.error('Error subiendo imagen de visita:', err);
      return error(res, err.message || 'Error al subir la imagen', 500);
    }
  }

  async eliminar(req, res) {
    try {
      const { imagenId } = req.params;
      const visitaId = req.params.id;

      const imagen = await VisitaImagen.findByPk(imagenId, {
        include: [{ model: VisitaInforme, as: 'informe', include: [{ model: Visita, as: 'visita' }] }]
      });

      if (!imagen) return error(res, 'Imagen no encontrada', 404);

      // Verificar que la imagen pertenece a la visita solicitada
      if (imagen.informe?.visita?.id !== visitaId) {
        return error(res, 'No autorizado', 403);
      }

      // Eliminar de R2
      await storageService.deleteImage(imagen.filename, `visitas/imagenes/${visitaId}`);

      // Eliminar de DB
      await imagen.destroy();

      return success(res, { mensaje: 'Imagen eliminada correctamente' });
    } catch (err) {
      logger.error('Error eliminando imagen:', err);
      return error(res, err.message || 'Error al eliminar la imagen', 500);
    }
  }
}

export default new VisitaImagenController();
