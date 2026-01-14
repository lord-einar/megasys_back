/**
 * PDF Service - Generación de PDFs para remitos con diseño profesional
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const storageService = require('./storageService');

class PDFService {
  constructor() {
    // Los PDFs ahora se almacenan en Cloudflare R2, no localmente
    this.logoPath = path.join(__dirname, '../assets/image17.png');
  }

  generarNombreArchivo(numeroRemito, confirmado = false) {
    const fecha = new Date();
    const yyyymmdd = fecha.toISOString().split('T')[0].replace(/-/g, '');
    const sufijo = confirmado ? '_CONFIRMADO' : '';
    return `${yyyymmdd}_${numeroRemito}${sufijo}.pdf`;
  }

  async generarPDF(remito, options = {}) {
    try {
      const nombreArchivo = this.generarNombreArchivo(remito.numero_remito, options.confirmado);
      const folder = options.confirmado ? 'confirmaciones' : 'remitos';

      const doc = new PDFDocument({
        size: 'A4',
        margin: 20
      });

      // Generar PDF en memoria (buffer)
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {});

      await this.dibujarPDF(doc, remito, options);

      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);

            // Subir a Azure Blob Storage
            const url = await storageService.uploadPDF(pdfBuffer, nombreArchivo, folder);

            logger.info('PDF generado y subido exitosamente:', {
              remito: remito.numero_remito,
              archivo: nombreArchivo,
              tamaño: pdfBuffer.length,
              url: url
            });

            resolve({
              success: true,
              url: url,
              filename: nombreArchivo,
              size: pdfBuffer.length
            });
          } catch (error) {
            reject(error);
          }
        });

        doc.on('error', reject);
      });
    } catch (error) {
      logger.error('Error generando PDF:', { error: error.message, remito: remito.numero_remito });
      throw error;
    }
  }

  async dibujarPDF(doc, remito, options = {}) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 30;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // Encabezado con logo
    if (fs.existsSync(this.logoPath)) {
      try {
        doc.image(this.logoPath, margin, y, { width: 60, height: 60 });
      } catch (err) {
        logger.warn('No se pudo cargar el logo:', err.message);
      }
    }

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('GRUPO MEGATLON', margin + 70, y, { width: contentWidth - 70 })
      .fontSize(9)
      .font('Helvetica')
      .text('Sistema de Gestión de Remitos', margin + 70, y + 16);

    // Línea divisoria
    doc.moveTo(margin, y + 60).lineTo(pageWidth - margin, y + 60).strokeColor('#2c3e50').lineWidth(1.5).stroke();

    y += 75;

    // Título
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('REMITO DE ' + (remito.es_prestamo ? 'PRÉSTAMO' : 'TRANSFERENCIA'), margin, y, {
        width: contentWidth,
        align: 'center'
      });

    y += 22;

    // Información principal (3 columnas)
    const col1 = margin;
    const col2 = margin + contentWidth / 3;
    const col3 = margin + (contentWidth * 2) / 3;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#34495e');
    doc.text('NÚMERO DE REMITO:', col1, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.numero_remito, col1, y + 12);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#34495e');
    doc.text('FECHA:', col2, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50');
    const fecha = new Date(remito.fecha).toLocaleDateString('es-AR');
    doc.text(fecha, col2, y + 12);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#34495e');
    doc.text('ESTADO:', col3, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#e74c3c');
    doc.text(remito.estado.toUpperCase(), col3, y + 12);

    y += 35;

    // Línea divisoria
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor('#bdc3c7').lineWidth(1).stroke();

    y += 10;

    // Solicitante
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50').text('INFORMACIÓN DEL SOLICITANTE', margin, y);
    y += 12;

    doc.fontSize(8).font('Helvetica').fillColor('#34495e');
    doc.text('Nombre:', margin, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.solicitante ? `${remito.solicitante.nombre} ${remito.solicitante.apellido}` : 'N/A', margin + 50, y);

    y += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#34495e');
    doc.text('Email:', margin, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.solicitante?.email || 'N/A', margin + 50, y);

    y += 15;

    // Técnico Asignado
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50').text('TÉCNICO ASIGNADO', margin, y);
    y += 12;

    doc.fontSize(8).font('Helvetica').fillColor('#34495e');
    doc.text('Nombre:', margin, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.tecnicoAsignado ? `${remito.tecnicoAsignado.nombre} ${remito.tecnicoAsignado.apellido}` : 'N/A', margin + 50, y);

    y += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#34495e');
    doc.text('Email:', margin, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.tecnicoAsignado?.email || 'N/A', margin + 50, y);

    y += 15;

    // Receptor (si es diferente al solicitante)
    if (remito.receptor_nombre) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#27ae60').text('RECIBIDO POR', margin, y);
      y += 12;

      doc.fontSize(8).font('Helvetica').fillColor('#34495e');
      doc.text('Nombre:', margin, y);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#27ae60');
      doc.text(remito.receptor_nombre, margin + 50, y);

      y += 12;
      doc.fontSize(8).font('Helvetica').fillColor('#34495e');
      doc.text('Email:', margin, y);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#27ae60');
      doc.text(remito.receptor_email || 'N/A', margin + 50, y);

      y += 15;
    }

    // Sedes
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50').text('SEDES', margin, y);
    y += 12;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#34495e').text('ORIGEN:', col1, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.sedeOrigen?.nombre_sede || 'N/A', col1, y + 10);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#34495e').text('DESTINO:', col2, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text(remito.sedeDestino?.nombre_sede || 'N/A', col2, y + 10);

    y += 25;

    // Tabla de artículos
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50').text('ARTÍCULOS', margin, y);
    y += 15;

    if (remito.detalles && remito.detalles.length > 0) {
      const tableTop = y;
      const rowHeight = 16;
      const colWidths = {
        num: 30,
        tipo: 80,
        marca: 70,
        modelo: 70,
        serie: 70,
        prestamo: 50
      };

      // Headers
      doc.fillColor('#34495e');
      doc.rect(margin, tableTop, contentWidth, rowHeight).fill();

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#ecf0f1');
      doc.text('#', margin + 5, tableTop + 4);
      doc.text('Tipo', margin + colWidths.num + 5, tableTop + 4, { width: colWidths.tipo });
      doc.text('Marca', margin + colWidths.num + colWidths.tipo + 5, tableTop + 4, { width: colWidths.marca });
      doc.text('Modelo', margin + colWidths.num + colWidths.tipo + colWidths.marca + 5, tableTop + 4, { width: colWidths.modelo });
      doc.text('N° Serie', margin + colWidths.num + colWidths.tipo + colWidths.marca + colWidths.modelo + 5, tableTop + 4, { width: colWidths.serie });
      doc.text('¿Préstamo?', margin + contentWidth - colWidths.prestamo - 5, tableTop + 4);

      y += rowHeight;

      // Filas
      remito.detalles.forEach((detalle, index) => {
        const articulo = detalle.inventarioDetalle || {};
        const tipo = articulo.tipoArticulo?.nombre || 'N/A';
        const marca = articulo.marca || 'N/A';
        const modelo = articulo.modelo || 'N/A';
        const serie = articulo.numero_serie || 'N/A';
        const prestamo = detalle.es_prestamo ? 'SÍ' : 'NO';

        if (index % 2 === 0) {
          doc.fillColor('#ecf0f1');
          doc.rect(margin, y, contentWidth, rowHeight).fill();
        }

        doc.fontSize(8).font('Helvetica').fillColor('#2c3e50');
        doc.text(String(index + 1), margin + 5, y + 4);
        doc.text(tipo, margin + colWidths.num + 5, y + 4, { width: colWidths.tipo });
        doc.text(marca, margin + colWidths.num + colWidths.tipo + 5, y + 4, { width: colWidths.marca });
        doc.text(modelo, margin + colWidths.num + colWidths.tipo + colWidths.marca + 5, y + 4, { width: colWidths.modelo });
        doc.text(serie, margin + colWidths.num + colWidths.tipo + colWidths.marca + colWidths.modelo + 5, y + 4, { width: colWidths.serie });
        doc.text(prestamo, margin + contentWidth - colWidths.prestamo - 5, y + 4);

        y += rowHeight;
      });

      doc.strokeColor('#bdc3c7').lineWidth(1);
      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    }

    // Pie de página
    const footerY = pageHeight - 60;
    doc.fontSize(8).font('Helvetica').fillColor('#7f8c8d');
    doc.text('Generado por: Sistema de Gestión de Megatlon', margin, footerY);
    doc.text(`Fecha y hora: ${new Date().toLocaleString('es-AR')}`, margin, footerY + 15);
    doc.text('Documento válido sin firma digital', margin, footerY + 30);

    // Watermark si está confirmado
    if (options.confirmado && options.fechaConfirmacion) {
      this.dibujarWatermark(doc, options.fechaConfirmacion, pageWidth, pageHeight);
    }
  }

  dibujarWatermark(doc, fechaConfirmacion, pageWidth, pageHeight) {
    const centerY = pageHeight / 2;

    doc.save();
    doc.opacity(0.35);

    doc
      .fontSize(48)
      .font('Helvetica-Bold')
      .fillColor('#27ae60')
      .text('RECEPCIÓN CONFIRMADA', 0, centerY - 35, {
        width: pageWidth,
        align: 'center'
      });

    const fechaFormato = new Date(fechaConfirmacion).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#27ae60')
      .text(fechaFormato, 0, centerY + 60, {
        width: pageWidth,
        align: 'center'
      });

    doc.restore();
  }

  async obtenerArchivoPDF(numeroRemito, confirmado = false) {
    try {
      const nombreArchivo = this.generarNombreArchivo(numeroRemito, confirmado);
      const folder = confirmado ? 'confirmaciones' : 'remitos';

      // Verificar si existe en Azure Blob
      const exists = await storageService.existsPDF(nombreArchivo, folder);

      if (!exists) {
        throw new Error(`Archivo PDF no encontrado: ${nombreArchivo}`);
      }

      const url = storageService.getPDFUrl(nombreArchivo, folder);

      return {
        success: true,
        url: url,
        filename: nombreArchivo
      };
    } catch (error) {
      logger.error('Error obteniendo PDF:', { error: error.message });
      throw error;
    }
  }
}

module.exports = new PDFService();
