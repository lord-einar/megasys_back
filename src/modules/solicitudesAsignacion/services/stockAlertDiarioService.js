import jwt from 'jsonwebtoken';
import { Op, Sequelize } from 'sequelize';
import { Personal, Inventario, CategoriaEquipo, TipoArticulo, sequelize } from '../../../models/index.js';
import emailService from '../../../shared/services/emailService.js';
import logger from '../../../shared/utils/logger.js';

const UMBRAL = 3;
const TOKEN_TTL = '48h';

class StockAlertDiarioService {

  // ── Genera un token firmado con la info de la alerta ──────────────────────
  generarToken(payload) {
    return jwt.sign(
      { type: 'stock_alert', ...payload },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );
  }

  verificarToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'stock_alert') throw new Error('Token inválido');
    return decoded;
  }

  // ── Consulta stock disponible agrupado por categoría ─────────────────────
  async stockPorCategoria() {
    // Obtener IDs de tipos notebook y celular
    const tipos = await TipoArticulo.findAll({
      where: {
        nombre: { [Op.or]: [{ [Op.iLike]: '%notebook%' }, { [Op.iLike]: '%celular%' }] },
        activo: true
      },
      attributes: ['id', 'nombre']
    });
    if (!tipos.length) return [];

    const tipoIds = tipos.map(t => t.id);
    const tipoMap = Object.fromEntries(tipos.map(t => [t.id, t.nombre.toLowerCase().includes('celular') ? 'celular' : 'notebook']));

    // Contar disponibles por categoría
    const rows = await Inventario.findAll({
      where: {
        tipo_articulo_id: { [Op.in]: tipoIds },
        estado: 'disponible',
        activo: true,
        categoria_id: { [Op.ne]: null }
      },
      attributes: [
        'categoria_id',
        'tipo_articulo_id',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['categoria_id', 'tipo_articulo_id'],
      raw: true
    });

    const categoriasMap = {};
    for (const row of rows) {
      const key = row.categoria_id;
      if (!categoriasMap[key]) {
        categoriasMap[key] = { categoria_id: key, count: 0, tipo: tipoMap[row.tipo_articulo_id] || 'notebook' };
      }
      categoriasMap[key].count += parseInt(row.count, 10);
    }

    // Enriquecer con nombre de categoría
    const categoriaIds = Object.keys(categoriasMap);
    if (!categoriaIds.length) return [];

    const categorias = await CategoriaEquipo.findAll({
      where: { id: { [Op.in]: categoriaIds } },
      attributes: ['id', 'nombre', 'tipo']
    });

    return categorias.map(cat => ({
      ...categoriasMap[cat.id],
      categoria_nombre: cat.nombre,
      tipo: cat.tipo
    })).filter(c => c.count < UMBRAL);
  }

  // ── Job principal — correr una vez al día ─────────────────────────────────
  async ejecutar() {
    logger.info('📊 StockAlertDiario: iniciando verificación diaria de stock por categoría');
    try {
      const bajas = await this.stockPorCategoria();
      if (!bajas.length) {
        logger.info('StockAlertDiario: todas las categorías tienen stock suficiente');
        return;
      }

      logger.info(`StockAlertDiario: ${bajas.length} categoría(s) con stock bajo`, bajas.map(b => `${b.categoria_nombre}: ${b.count}`));

      for (const alerta of bajas) {
        await this.enviarAlertaInfra(alerta);
      }
    } catch (err) {
      logger.error('StockAlertDiario: error en verificación', { error: err.message });
    }
  }

  // ── Envía mail a Infra con link de confirmación ───────────────────────────
  async enviarAlertaInfra(alerta) {
    const infraPersonal = await Personal.findAll({
      where: { activo: true, privilegio_app: 'super_admin' },
      attributes: ['email']
    });
    const to = [...new Set(infraPersonal.map(p => p.email).filter(Boolean))];
    if (!to.length) { logger.warn('StockAlertDiario: sin destinatarios Infra'); return; }

    const token = this.generarToken({
      categoria_id: alerta.categoria_id,
      categoria_nombre: alerta.categoria_nombre,
      tipo: alerta.tipo,
      count: alerta.count
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/alerta-stock?token=${token}`;

    const asunto = `⚠️ Stock bajo: ${alerta.categoria_nombre} (${alerta.count} disponible${alerta.count !== 1 ? 's' : ''})`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:600px">
        <h2 style="color:#d97706;margin-bottom:8px">⚠️ Alerta de stock bajo</h2>
        <p>El stock de la categoría <strong>${alerta.categoria_nombre}</strong> (${alerta.tipo}) está por debajo del mínimo.</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%">
          <tr style="background:#fef3c7">
            <td style="padding:10px 16px;font-weight:bold;border:1px solid #fde68a">Categoría</td>
            <td style="padding:10px 16px;border:1px solid #fde68a">${alerta.categoria_nombre}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-weight:bold;border:1px solid #e5e7eb">Tipo</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;text-transform:capitalize">${alerta.tipo}</td>
          </tr>
          <tr style="background:#fef2f2">
            <td style="padding:10px 16px;font-weight:bold;border:1px solid #fecaca">Unidades disponibles</td>
            <td style="padding:10px 16px;border:1px solid #fecaca;color:#dc2626;font-weight:bold">${alerta.count} (mínimo: ${UMBRAL})</td>
          </tr>
        </table>
        <p>Si considerás que se debe avisar a Compras para gestionar un pedido de reposición, hacé clic en el siguiente enlace:</p>
        <p style="margin:24px 0">
          <a href="${link}"
             style="background:#d97706;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Ver alerta y notificar a Compras →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px">Este enlace expira en 48 horas.</p>
      </div>
    `;

    await emailService.enviarEmail(to, asunto, html);
    logger.info('StockAlertDiario: alerta enviada a Infra', { categoria: alerta.categoria_nombre, count: alerta.count, to });
  }

  // ── Notifica a Compras (llamado cuando Infra acepta) ──────────────────────
  async notificarCompras(token) {
    const alerta = this.verificarToken(token);

    const comprasPersonal = await Personal.findAll({
      where: { activo: true, privilegio_app: 'compras' },
      attributes: ['email', 'nombre', 'apellido']
    });
    const to = [...new Set(comprasPersonal.map(p => p.email).filter(Boolean))];
    if (!to.length) throw new Error('No hay personas con perfil Compras para notificar');

    const asunto = `📦 Solicitud de reposición: ${alerta.categoria_nombre} (${alerta.tipo})`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:600px">
        <h2 style="color:#1d4ed8;margin-bottom:8px">📦 Solicitud de reposición de equipos</h2>
        <p>Infraestructura ha detectado stock bajo y solicita la compra de equipos para la siguiente categoría:</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%">
          <tr style="background:#eff6ff">
            <td style="padding:10px 16px;font-weight:bold;border:1px solid #bfdbfe">Categoría</td>
            <td style="padding:10px 16px;border:1px solid #bfdbfe">${alerta.categoria_nombre}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-weight:bold;border:1px solid #e5e7eb">Tipo de equipo</td>
            <td style="padding:10px 16px;border:1px solid #e5e7eb;text-transform:capitalize">${alerta.tipo}</td>
          </tr>
          <tr style="background:#fef2f2">
            <td style="padding:10px 16px;font-weight:bold;border:1px solid #fecaca">Stock actual disponible</td>
            <td style="padding:10px 16px;border:1px solid #fecaca;color:#dc2626;font-weight:bold">${alerta.count} unidades</td>
          </tr>
        </table>
        <p>Por favor, gestioná el pedido de reposición a la brevedad para mantener el stock operativo.</p>
        <p style="color:#6b7280;font-size:12px">Mensaje generado automáticamente por el Portal IT — Megatlon</p>
      </div>
    `;

    await emailService.enviarEmail(to, asunto, html);
    logger.info('StockAlertDiario: Compras notificado', { categoria: alerta.categoria_nombre, to });
    return { categoria: alerta.categoria_nombre, tipo: alerta.tipo, count: alerta.count, notificados: to };
  }
}

export default new StockAlertDiarioService();
