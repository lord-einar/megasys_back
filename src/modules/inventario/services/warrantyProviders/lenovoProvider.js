// Lenovo warranty provider
// Step 1: GET product ID from serial number
// Step 2: GET warranty page HTML and extract ds_warranties JSON
import logger from '../../../../shared/utils/logger.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        ...options.headers
      }
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function obtenerProductId(serial) {
  const url = `https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId=${encodeURIComponent(serial)}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Lenovo getproducts respondió ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0 || !data[0].Id) {
    throw new Error(`No se encontró producto Lenovo para serial: ${serial}`);
  }

  return data[0].Id;
}

async function obtenerWarrantyHtml(productId) {
  const url = `https://pcsupport.lenovo.com/us/en/products/${encodeURIComponent(productId)}/warranty`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Lenovo warranty page respondió ${response.status}`);
  }

  return await response.text();
}

function extraerDsWarranties(html) {
  // Format real: var ds_warranties = window.ds_warranties || {...};
  const regex = /var\s+ds_warranties\s*=\s*(?:window\.ds_warranties\s*\|\|\s*)(\{[\s\S]*?\});\s*(?:var|<\/script>)/;
  const match = html.match(regex);

  if (match && match[1]) {
    return JSON.parse(match[1]);
  }

  // Fallback: brace counting desde el JSON literal
  const idx = html.indexOf('ds_warranties');
  if (idx === -1) {
    throw new Error('No se encontró ds_warranties en la página de Lenovo');
  }

  const startBrace = html.indexOf('{', html.indexOf('||', idx));
  if (startBrace === -1) {
    throw new Error('No se pudo extraer JSON de ds_warranties');
  }

  let depth = 0;
  let end = startBrace;
  for (let i = startBrace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') depth--;
    if (depth === 0) { end = i; break; }
  }

  return JSON.parse(html.substring(startBrace, end + 1));
}

function mapearEstado(status, statusV2) {
  if (statusV2 === 'Active' || status === 1) return 'activa';
  return 'expirada';
}

function normalizarEntrega(deliveryType) {
  if (!deliveryType) return null;
  const lower = deliveryType.toLowerCase();
  if (lower.includes('on-site') || lower.includes('onsite')) return 'on_site';
  if (lower.includes('depot')) return 'depot';
  if (lower.includes('mail')) return 'mail_in';
  return deliveryType.toLowerCase().replace(/\s+/g, '_');
}

function parsearWarranties(dsWarranties) {
  const arrays = [
    'BaseWarranties',
    'UpmaWarranties',
    'ContractWarranties',
    'AodWarranties',
    'InstantWarranties',
    'SaeWarranties'
  ];

  const warranties = [];

  for (const arrayName of arrays) {
    const entries = dsWarranties[arrayName];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      warranties.push({
        tipo: entry.Type || arrayName.replace('Warranties', '').toUpperCase(),
        nombre: entry.Name || entry.Description || null,
        descripcion: entry.Description || null,
        estado: mapearEstado(entry.Status, entry.StatusV2),
        estado_original: entry.StatusV2 || String(entry.Status),
        fecha_inicio: entry.Start ? entry.Start.split('T')[0] : null,
        fecha_fin: entry.End ? entry.End.split('T')[0] : null,
        duracion_meses: entry.Duration || null,
        tipo_entrega: normalizarEntrega(entry.DeliveryType),
        codigo_tipo: entry.WarrentyType || null,
        pais: entry.CountryName || null,
        origen: entry.Origin || null,
        datos_originales: entry
      });
    }
  }

  return warranties;
}

const lenovoProvider = {
  marca: 'lenovo',
  campoIdentificador: 'numero_serie',

  async consultarGarantia(serial) {
    try {
      logger.info('Lenovo warranty: consultando serial', { serial });

      const productId = await obtenerProductId(serial);
      const html = await obtenerWarrantyHtml(productId);
      const dsWarranties = extraerDsWarranties(html);
      const warranties = parsearWarranties(dsWarranties);

      logger.info('Lenovo warranty: consulta exitosa', {
        serial,
        producto: dsWarranties.ProductName,
        totalGarantias: warranties.length
      });

      return {
        success: true,
        producto: dsWarranties.ProductName || null,
        serial: dsWarranties.Serial || serial,
        warranties
      };
    } catch (err) {
      logger.error('Lenovo warranty: error en consulta', {
        serial,
        error: err.message
      });

      return {
        success: false,
        error: err.message
      };
    }
  }
};

export default lenovoProvider;
