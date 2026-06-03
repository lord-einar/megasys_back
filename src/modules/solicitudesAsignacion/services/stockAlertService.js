import { Personal, Inventario } from '../../../models/index.js';
import emailService from '../../../shared/services/emailService.js';
import logger from '../../../shared/utils/logger.js';

const UMBRAL = 3;

class StockAlertService {
  async checkYNotificar(marca, modelo, tipoArticuloId) {
    try {
      const disponibles = await Inventario.count({
        where: { marca, modelo, tipo_articulo_id: tipoArticuloId, estado: 'disponible', activo: true }
      });
      if (disponibles < UMBRAL) {
        await this.enviarAlerta(marca, modelo, disponibles);
      }
    } catch (err) {
      logger.error('StockAlert: error verificando stock bajo', { marca, modelo, error: err.message });
    }
  }

  async enviarAlerta(marca, modelo, disponibles) {
    try {
      const [comprasPersonal, infraPersonal] = await Promise.all([
        Personal.findAll({ where: { activo: true, privilegio_app: 'compras' }, attributes: ['email'] }),
        Personal.findAll({ where: { activo: true, privilegio_app: 'super_admin' }, attributes: ['email'] })
      ]);

      const to = [...new Set(comprasPersonal.map(p => p.email).filter(Boolean))];
      const cc = [...new Set(infraPersonal.map(p => p.email).filter(Boolean))];

      if (!to.length) {
        logger.warn('StockAlert: sin destinatarios de Compras para la alerta', { marca, modelo });
        return;
      }

      const asunto = `⚠️ Stock bajo: ${marca} ${modelo} (${disponibles} disponible${disponibles !== 1 ? 's' : ''})`;
      const html = `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
          <h2 style="color: #dc2626;">⚠️ Alerta de stock bajo</h2>
          <p>El inventario de <strong>${marca} ${modelo}</strong> cayó por debajo del umbral mínimo.</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 4px 16px 4px 0; font-weight: bold;">Equipo</td>
              <td>${marca} ${modelo}</td>
            </tr>
            <tr>
              <td style="padding: 4px 16px 4px 0; font-weight: bold;">Unidades disponibles</td>
              <td style="color: #dc2626; font-weight: bold;">${disponibles}</td>
            </tr>
            <tr>
              <td style="padding: 4px 16px 4px 0; font-weight: bold;">Umbral mínimo</td>
              <td>${UMBRAL}</td>
            </tr>
          </table>
          <p>Se recomienda gestionar un pedido de reposición a la brevedad para mantener el stock operativo.</p>
        </div>
      `;

      await emailService.enviarEmail(to, asunto, html, cc.length ? cc : undefined);
      logger.info('StockAlert: alerta enviada', { marca, modelo, disponibles, to, cc });
    } catch (err) {
      logger.error('StockAlert: error enviando alerta de stock', { marca, modelo, error: err.message });
    }
  }
}

export default new StockAlertService();
