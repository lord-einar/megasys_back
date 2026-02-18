// src/modules/inventario/services/garantiaService.js
import { Inventario, sequelize } from '../../../models/index.js';
import Garantia from '../../../models/Garantia.js';
import { getProvider } from './warrantyProviders/index.js';
import logger from '../../../shared/utils/logger.js';
import TransactionWrapper from '../../../shared/utils/transactionWrapper.js';

class GarantiaService {
  /**
   * Consultar garantía del fabricante y guardar en BD
   */
  async consultarYGuardar(inventarioId) {
    const item = await Inventario.findByPk(inventarioId);
    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    const provider = getProvider(item.marca);
    if (!provider) {
      // Marca sin provider: marcar sin_garantia silenciosamente
      await item.update({
        garantia_estado: 'sin_garantia',
        garantia_consultada_en: new Date()
      });
      return;
    }

    // Obtener el valor del campo identificador
    const valorIdentificador = item[provider.campoIdentificador];
    if (!valorIdentificador) {
      // Sin identificador: marcar sin_garantia
      await item.update({
        garantia_estado: 'sin_garantia',
        garantia_consultada_en: new Date()
      });
      return;
    }

    // Marcar como consultando
    await item.update({ garantia_estado: 'consultando' });

    try {
      const resultado = await provider.consultarGarantia(valorIdentificador);

      if (!resultado.success) {
        await item.update({
          garantia_estado: 'error',
          garantia_consultada_en: new Date()
        });
        logger.warn('Consulta de garantía falló', {
          inventarioId,
          marca: item.marca,
          error: resultado.error
        });
        return;
      }

      const ahora = new Date();

      // Guardar garantías dentro de transacción
      await sequelize.transaction(async (transaction) => {
        // Borrar garantías previas
        await Garantia.destroy({
          where: { inventario_id: inventarioId },
          transaction
        });

        // Insertar nuevas
        if (resultado.warranties && resultado.warranties.length > 0) {
          const registros = resultado.warranties.map(w => ({
            inventario_id: inventarioId,
            fabricante: provider.marca,
            tipo: w.tipo,
            nombre: w.nombre,
            descripcion: w.descripcion,
            estado: w.estado,
            estado_original: w.estado_original,
            fecha_inicio: w.fecha_inicio,
            fecha_fin: w.fecha_fin,
            duracion_meses: w.duracion_meses,
            tipo_entrega: w.tipo_entrega,
            codigo_tipo: w.codigo_tipo,
            pais: w.pais,
            origen: w.origen,
            datos_originales: w.datos_originales,
            consultado_en: ahora
          }));

          await Garantia.bulkCreate(registros, { transaction });
        }

        // Calcular mejor fecha de fin entre garantías activas
        const activas = (resultado.warranties || []).filter(w => w.estado === 'activa');
        let mejorFechaFin = null;
        for (const w of activas) {
          if (w.fecha_fin && (!mejorFechaFin || w.fecha_fin > mejorFechaFin)) {
            mejorFechaFin = w.fecha_fin;
          }
        }

        const tieneGarantias = resultado.warranties && resultado.warranties.length > 0;
        await item.update({
          garantia_estado: tieneGarantias ? 'con_garantia' : 'sin_garantia',
          garantia_consultada_en: ahora,
          garantia_fecha_fin: mejorFechaFin
        }, { transaction });
      });

      logger.info('Garantías guardadas correctamente', {
        inventarioId,
        marca: item.marca,
        totalGarantias: resultado.warranties?.length || 0
      });
    } catch (err) {
      await item.update({
        garantia_estado: 'error',
        garantia_consultada_en: new Date()
      });
      logger.error('Error consultando/guardando garantía', {
        inventarioId,
        error: err.message
      });
    }
  }

  /**
   * Obtener garantías de un artículo desde la BD
   */
  async obtenerPorInventario(inventarioId) {
    const garantias = await Garantia.findAll({
      where: { inventario_id: inventarioId },
      order: [['fecha_fin', 'DESC']]
    });

    const item = await Inventario.findByPk(inventarioId, {
      attributes: ['id', 'garantia_estado', 'garantia_consultada_en', 'garantia_fecha_fin']
    });

    const activas = garantias.filter(g => g.estado === 'activa');
    const diasRestantes = item?.garantia_fecha_fin
      ? Math.ceil((new Date(item.garantia_fecha_fin) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      garantias,
      resumen: {
        total: garantias.length,
        activas: activas.length,
        mejorFechaFin: item?.garantia_fecha_fin || null,
        diasRestantes,
        estado: item?.garantia_estado || 'sin_consultar',
        consultadaEn: item?.garantia_consultada_en || null
      }
    };
  }

  /**
   * Refrescar garantías: re-consultar la API y actualizar BD
   */
  async refrescar(inventarioId, usuarioEmail) {
    const resultado = await TransactionWrapper.execute({
      operation: async () => {
        await this.consultarYGuardar(inventarioId);
        return await this.obtenerPorInventario(inventarioId);
      },
      usuarioEmail,
      modulo: 'inventario',
      accion: 'actualizar',
      recurso: 'Garantia',
      recursoId: inventarioId,
      descripcion: `Refrescar garantías del artículo ${inventarioId}`,
      valoresAnteriores: null,
      valoresNuevos: null
    });

    return resultado.data;
  }
}

export default new GarantiaService();
