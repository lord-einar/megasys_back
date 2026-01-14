const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

class StorageService {
  constructor() {
    // Configuración de Cloudflare R2
    this.accountId = process.env.R2_ACCOUNT_ID;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'megasys-remitos';
    this.publicUrl = process.env.R2_PUBLIC_URL;

    // Validar configuración
    if (!this.accessKeyId || !this.secretAccessKey) {
      logger.warn('Configuración de R2 incompleta. El servicio de storage no estará disponible.');
      this.enabled = false;
      return;
    }

    // Construir endpoint de R2
    // Formato: https://<account-id>.r2.cloudflarestorage.com
    const endpoint = this.accountId
      ? `https://${this.accountId}.r2.cloudflarestorage.com`
      : process.env.R2_ENDPOINT;

    if (!endpoint) {
      logger.error('No se pudo determinar el endpoint de R2. Configura R2_ACCOUNT_ID o R2_ENDPOINT');
      this.enabled = false;
      return;
    }

    // Configurar cliente S3 para Cloudflare R2
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    this.enabled = true;
    logger.info('Cloudflare R2 Storage inicializado correctamente', {
      bucket: this.bucketName,
      endpoint: endpoint,
      publicUrl: this.publicUrl || 'No configurada (usando endpoint R2)'
    });
  }

  /**
   * Sube un archivo PDF a Cloudflare R2
   * @param {Buffer} buffer - Buffer del PDF
   * @param {string} filename - Nombre del archivo (ej: 'REM-2025-001.pdf')
   * @param {string} folder - Carpeta (ej: 'remitos', 'confirmaciones')
   * @returns {Promise<string>} URL pública del archivo
   */
  async uploadPDF(buffer, filename, folder = 'remitos') {
    if (!this.enabled) {
      throw new Error('Storage service no está habilitado. Verifica la configuración de R2.');
    }

    try {
      const key = `${folder}/${filename}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        CacheControl: 'public, max-age=31536000', // Cache 1 año
      });

      await this.s3Client.send(command);

      // Construir URL pública
      const url = this.getPDFUrl(filename, folder);

      logger.info(`PDF subido exitosamente a R2: ${key}`, {
        size: buffer.length,
        url: url
      });

      return url;
    } catch (error) {
      logger.error('Error subiendo PDF a R2:', {
        error: error.message,
        filename,
        folder
      });
      throw error;
    }
  }

  /**
   * Obtiene la URL de un PDF
   * @param {string} filename - Nombre del archivo
   * @param {string} folder - Carpeta
   * @returns {string} URL pública del archivo
   */
  getPDFUrl(filename, folder = 'remitos') {
    const key = `${folder}/${filename}`;

    // Si hay URL pública configurada (custom domain), usarla
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    // Caso contrario, usar el endpoint de R2
    // Formato: https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>
    const endpoint = this.accountId
      ? `https://${this.accountId}.r2.cloudflarestorage.com`
      : process.env.R2_ENDPOINT;

    return `${endpoint}/${this.bucketName}/${key}`;
  }

  /**
   * Elimina un PDF
   * @param {string} filename - Nombre del archivo
   * @param {string} folder - Carpeta
   * @returns {Promise<boolean>} true si se eliminó
   */
  async deletePDF(filename, folder = 'remitos') {
    if (!this.enabled) {
      throw new Error('Storage service no está habilitado. Verifica la configuración de R2.');
    }

    try {
      const key = `${folder}/${filename}`;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      logger.info(`PDF eliminado de R2: ${key}`);
      return true;
    } catch (error) {
      logger.error('Error eliminando PDF de R2:', {
        error: error.message,
        filename,
        folder
      });
      throw error;
    }
  }

  /**
   * Verifica si un PDF existe
   * @param {string} filename - Nombre del archivo
   * @param {string} folder - Carpeta
   * @returns {Promise<boolean>} true si existe
   */
  async existsPDF(filename, folder = 'remitos') {
    if (!this.enabled) {
      return false;
    }

    try {
      const key = `${folder}/${filename}`;

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      // Error 404 significa que no existe
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }

      logger.error('Error verificando existencia de PDF en R2:', {
        error: error.message,
        filename,
        folder
      });
      return false;
    }
  }
}

module.exports = new StorageService();
