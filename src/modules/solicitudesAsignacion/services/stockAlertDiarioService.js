import jwt from 'jsonwebtoken';
import { Op, Sequelize } from 'sequelize';
import { Personal, Inventario, CategoriaEquipo, TipoArticulo, sequelize } from '../../../models/index.js';
import emailService from '../../../shared/services/emailService.js';
import logger from '../../../shared/utils/logger.js';
import { tipoArticuloCoincide } from '../../../shared/constants/tipoEquipo.js';

// Tipo de equipo (lógico) -> tipo de categoría, para cada TipoArticulo alertable
const TIPOS_ALERTABLES = [
  { tipoEquipo: 'celular', tipoCategoria: 'celular' },
  { tipoEquipo: 'notebook', tipoCategoria: 'notebook' },
  { tipoEquipo: 'pc_escritorio', tipoCategoria: 'pc' }
];

const ETIQUETA_TIPO_CATEGORIA = {
  celular: 'Celular',
  notebook: 'Notebook',
  pc: 'PC de escritorio',
  ambos: 'Todos los tipos'
};

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
    // Tipos de artículo alertables: celular, notebook y PC (mismo criterio que
    // las solicitudes de asignación; antes las PCs quedaban afuera)
    const tiposActivos = await TipoArticulo.findAll({ where: { activo: true }, attributes: ['id', 'nombre'] });
    const tipoMap = {};
    for (const t of tiposActivos) {
      const alertable = TIPOS_ALERTABLES.find(a => tipoArticuloCoincide(a.tipoEquipo, t.nombre));
      if (alertable) tipoMap[t.id] = alertable.tipoCategoria;
    }
    const tipoIds = Object.keys(tipoMap);
    if (!tipoIds.length) return [];

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

    const disponiblesPorCategoria = {};
    for (const row of rows) {
      disponiblesPorCategoria[row.categoria_id] = (disponiblesPorCategoria[row.categoria_id] || 0) + parseInt(row.count, 10);
    }

    // Se parte de las categorías activas que alguna vez tuvieron equipos de
    // estos tipos (no solo de las que hoy tienen stock): así una categoría que
    // llegó a 0 disponibles también alerta. Antes quedaba afuera justo ese caso.
    const usadas = await Inventario.findAll({
      where: { tipo_articulo_id: { [Op.in]: tipoIds }, categoria_id: { [Op.ne]: null } },
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('categoria_id')), 'categoria_id']],
      raw: true
    });
    const categoriaIds = usadas.map(u => u.categoria_id);
    if (!categoriaIds.length) return [];

    const categorias = await CategoriaEquipo.findAll({
      where: { id: { [Op.in]: categoriaIds }, activo: true },
      attributes: ['id', 'nombre', 'tipo']
    });

    return categorias.map(cat => ({
      categoria_id: cat.id,
      count: disponiblesPorCategoria[cat.id] || 0,
      categoria_nombre: cat.nombre,
      // Solo se muestra (mails y página de alerta): va la etiqueta legible
      tipo: ETIQUETA_TIPO_CATEGORIA[cat.tipo] || cat.tipo
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
