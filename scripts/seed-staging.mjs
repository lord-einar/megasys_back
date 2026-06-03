/**
 * Seed script para el entorno de staging.
 * Ejecutar con: railway run node scripts/seed-staging.mjs
 *
 * Inserta: empresas, sedes, personal (de prod local), tipos_articulo,
 * 100 artículos de inventario, 20 remitos y 10 solicitudes de compra.
 */

import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado a la DB de staging');

// ─── helpers ──────────────────────────────────────────────────────────────────

const upsert = async (table, rows, conflictCol = 'id') => {
  if (!rows?.length) return;
  let ok = 0;
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const updates = cols.filter(c => c !== conflictCol).map(c => `${c} = EXCLUDED.${c}`).join(', ');
    try {
      await client.query(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (${conflictCol}) DO UPDATE SET ${updates}`,
        vals
      );
      ok++;
    } catch (e) {
      console.warn(`  ⚠️  ${table} skip (${e.message.slice(0, 80)})`);
    }
  }
  console.log(`  ✅ ${table}: ${ok}/${rows.length} insertados/actualizados`);
};

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── 1. datos maestros de producción ──────────────────────────────────────────

const DATA_FILE = path.join(__dirname, '../data/staging-seed-data.json');
const { empresas, sedes, personal, tipos, tipos_all } = JSON.parse(readFileSync(DATA_FILE, 'utf8'));

console.log('\n📦 Insertando datos maestros...');

// Empresas
await upsert('empresas', empresas.map(e => ({
  id: e.id,
  nombre_empresa: e.nombre_empresa,
  cuit: e.cuit,
  rason_social: e.rason_social,
  email: e.email,
  telefono: e.telefono,
  direccion: e.direccion,
  activo: e.activo ?? true,
  created_at: new Date(),
  updated_at: new Date()
})));

// Sedes (sin empresa_id si no existe la FK en staging)
await upsert('sedes', sedes.map(s => ({
  id: s.id,
  nombre_sede: s.nombre_sede,
  direccion: s.direccion,
  localidad: s.localidad,
  provincia: s.provincia,
  activo: s.activo ?? true,
  created_at: new Date(),
  updated_at: new Date()
})));

// Personal
await upsert('personal', personal.map(p => ({
  id: p.id,
  nombre: p.nombre,
  apellido: p.apellido,
  email: p.email,
  telefono: p.telefono ?? null,
  sede_id: p.sede_id ?? null,
  privilegio_app: p.privilegio_app ?? 'user',
  activo: p.activo ?? true,
  fecha_ingreso: p.fecha_ingreso ?? new Date().toISOString().slice(0, 10),
  created_at: new Date(),
  updated_at: new Date()
})));

// Insertar todos los tipos de artículo del local (tabla staging: tipo_articulo)
console.log('\n🗂️  Insertando tipos de artículo...');
for (const t of tipos_all) {
  try {
    await client.query(
      `INSERT INTO tipo_articulo (id, nombre, descripcion, activo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT (nombre) DO UPDATE SET descripcion=EXCLUDED.descripcion, activo=EXCLUDED.activo`,
      [t.id, t.nombre, t.descripcion ?? null, t.activo ?? true]
    );
  } catch (e) { console.warn('  tipo skip:', e.message.slice(0, 60)); }
}
console.log(`  ✅ tipo_articulo: ${tipos_all.length} procesados`);

// Obtener mapa nombre→id de staging (puede haber diferencia de IDs)
const { rows: tiposExistentes } = await client.query("SELECT id, nombre FROM tipo_articulo");
const tipoMap = Object.fromEntries(tiposExistentes.map(t => [t.nombre, t.id]));
const tipoNbStaging = tipoMap['Notebook'];
const tipoCelStaging = tipoMap['Celular'];

console.log(`  ℹ️  tipos disponibles: ${tiposExistentes.map(t=>t.nombre).join(', ')}`);

// ─── 2. Categorías de equipo ───────────────────────────────────────────────────

console.log('\n🏷️  Insertando categorías de equipo...');
const categorias = [
  { id: randomUUID(), nombre: 'Gerente / Director', descripcion: 'Equipos premium para dirección', tipo: 'notebook', activo: true },
  { id: randomUUID(), nombre: 'Ejecutivo de área', descripcion: 'Equipos estándar ejecutivos', tipo: 'notebook', activo: true },
  { id: randomUUID(), nombre: 'Operativo oficina', descripcion: 'Equipos básicos de oficina', tipo: 'notebook', activo: true },
  { id: randomUUID(), nombre: 'Celular ejecutivo', descripcion: 'Smartphones gama alta', tipo: 'celular', activo: true },
  { id: randomUUID(), nombre: 'Celular operativo', descripcion: 'Smartphones estándar', tipo: 'celular', activo: true },
];

for (const cat of categorias) {
  try {
    await client.query(
      `INSERT INTO categoria_equipos (id, nombre, descripcion, tipo, activo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      [cat.id, cat.nombre, cat.descripcion, cat.tipo, cat.activo]
    );
  } catch (e) { console.warn('  cat skip:', e.message.slice(0, 60)); }
}
console.log(`  ✅ categoria_equipos: ${categorias.length} insertadas`);

// ─── 3. 100 artículos de inventario ───────────────────────────────────────────

console.log('\n💻 Generando 100 artículos de inventario...');

const sedeIds = sedes.slice(0, 15).map(s => s.id);
const catNbIds = categorias.filter(c => c.tipo === 'notebook').map(c => c.id);
const catCelIds = categorias.filter(c => c.tipo === 'celular').map(c => c.id);

const modelosPorTipo = {
  'Notebook':   [['Lenovo','ThinkPad X1 Carbon'],['Lenovo','ThinkPad E14'],['HP','EliteBook 840 G9'],['HP','ProBook 450 G10'],['Dell','Latitude 5540'],['Dell','Inspiron 15'],['Apple','MacBook Air M2'],['Asus','ZenBook 14'],['Asus','ExpertBook B2']],
  'Notebooks':  [['Lenovo','ThinkPad T14'],['HP','EliteBook 650'],['Dell','Latitude 3540']],
  'Celular':    [['Samsung','Galaxy S24'],['Samsung','Galaxy A54'],['iPhone','iPhone 15 Pro'],['iPhone','iPhone 14'],['Motorola','Edge 40'],['Motorola','Moto G84'],['Xiaomi','Redmi Note 13']],
  'PC':         [['HP','EliteDesk 800 G6'],['Dell','OptiPlex 7000'],['Lenovo','ThinkCentre M75q'],['Asus','ExpertCenter D500']],
  'Monitor':    [['LG','27BN65Q'],['Samsung','S27A600'],['Dell','P2722H'],['HP','M27f'],['Philips','272B7']],
  'Impresora':  [['HP','LaserJet Pro M404n'],['Canon','imageRUNNER 2425'],['Epson','EcoTank L3250'],['Brother','HL-L2375DW']],
  'Periféricos':[['Logitech','MX Keys Combo'],['Microsoft','Sculpt Ergonomic'],['HP','USB 800dpi Mouse'],['Logitech','K120 Keyboard']],
  'Cámara':     [['Hikvision','DS-2CD2143'],['Dahua','IPC-HFW2849S'],['Axis','P3245-V'],['Reolink','RLC-810A']],
  'NVR':        [['Hikvision','DS-7608NI-K2'],['Dahua','NVR4108HS-8P-4KS2'],['Uniview','NVR301-08S3']],
};

const estados = ['disponible', 'disponible', 'disponible', 'en_uso', 'en_uso', 'mantenimiento'];

// Distribución de 100 artículos: 30 NB, 20 Cel, 10 PC, 10 Mon, 10 Imp, 8 Per, 6 Cam, 4 NVR, 2 Cel-extra
const distribucion = [
  { tipo: 'Notebook', qty: 30, cat: 'nb' },
  { tipo: 'Celular',  qty: 20, cat: 'cel' },
  { tipo: 'PC',       qty: 12, cat: null },
  { tipo: 'Monitor',  qty: 12, cat: null },
  { tipo: 'Impresora',qty: 10, cat: null },
  { tipo: 'Periféricos',qty: 8,cat: null },
  { tipo: 'Cámara',   qty: 5, cat: null },
  { tipo: 'NVR',      qty: 3, cat: null },
];

let okInv = 0;
let idxGlobal = 0;

for (const { tipo, qty, cat } of distribucion) {
  const tipoId = tipoMap[tipo];
  if (!tipoId) { console.warn(`  ⚠️  Tipo "${tipo}" no encontrado en staging`); continue; }
  const modelos = modelosPorTipo[tipo] || [['Genérico', tipo]];

  for (let q = 0; q < qty; q++) {
    idxGlobal++;
    const [marca, modelo] = rand(modelos);
    const estado = rand(estados);
    const sedeId = rand(sedeIds);
    const prefix = tipo.slice(0, 3).toUpperCase().replace(' ', '');
    const serie = `STG-${prefix}-${String(idxGlobal).padStart(4, '0')}`;
    const catId = cat === 'nb' ? rand(catNbIds) : cat === 'cel' ? rand(catCelIds) : null;

    try {
      await client.query(
        `INSERT INTO inventario (id, tipo_articulo_id, marca, modelo, numero_serie, sede_id, estado, activo, categoria_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,NOW(),NOW())
         ON CONFLICT (numero_serie) DO NOTHING`,
        [randomUUID(), tipoId, marca, modelo, serie, sedeId, estado, catId]
      );
      okInv++;
    } catch (e) {
      console.warn(`  inv[${idxGlobal}] skip:`, e.message.slice(0, 60));
    }
  }
}
console.log(`  ✅ inventario: ${okInv}/100 insertados`);

// ─── 4. 20 remitos ────────────────────────────────────────────────────────────

console.log('\n📋 Generando 20 remitos...');

// Obtener IDs de personal e inventario insertados
const { rows: personalRows } = await client.query("SELECT id, sede_id FROM personal WHERE activo=true AND sede_id IS NOT NULL LIMIT 50");
const { rows: invRows } = await client.query("SELECT id, sede_id FROM inventario WHERE activo=true LIMIT 80");

const estadosRemito = ['preparado', 'en_transito', 'entregado', 'completado'];

let { rows: [{ nextval: remitoSeq }] } = await client.query("SELECT NEXTVAL('remito_numero_seq')");
let seqNum = parseInt(remitoSeq);

let okRemitos = 0;
for (let i = 0; i < 20; i++) {
  const solicitante = rand(personalRows);
  const destItem = rand(invRows.filter(inv => inv.sede_id !== solicitante.sede_id) || invRows);
  const estadoRemito = rand(estadosRemito);
  const year = 2026;
  const numero = `REM-${year}-${String(seqNum++).padStart(3, '0')}`;
  const remitoId = randomUUID();
  const fecha = new Date(Date.now() - randInt(0, 30) * 86400000);

  try {
    await client.query(
      `INSERT INTO remitos (id, numero_remito, fecha, sede_origen_id, sede_destino_id, solicitante_id, estado, observaciones, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
      [
        remitoId, numero, fecha,
        solicitante.sede_id, rand(sedeIds),
        solicitante.id, estadoRemito,
        `Remito de prueba staging #${i + 1}`
      ]
    );

    // 1-3 detalles por remito
    const nDet = randInt(1, 3);
    for (let d = 0; d < nDet; d++) {
      const inv = invRows[randInt(0, invRows.length - 1)];
      try {
        await client.query(
          `INSERT INTO remito_detalles (id, remito_id, inventario_id, cantidad, es_prestamo, created_at, updated_at)
           VALUES ($1,$2,$3,1,false,NOW(),NOW())`,
          [randomUUID(), remitoId, inv.id]
        );
      } catch (_) {}
    }
    okRemitos++;
  } catch (e) {
    console.warn(`  remito[${i}] skip:`, e.message.slice(0, 60));
  }
}
console.log(`  ✅ remitos: ${okRemitos}/20 insertados`);

// ─── 5. 10 solicitudes de compra ──────────────────────────────────────────────

console.log('\n🛒 Generando 10 solicitudes de compra...');

// Obtener catálogo de equipos
const { rows: catalogoRows } = await client.query("SELECT id FROM catalogo_equipos LIMIT 10");

const motivosSC = ['nuevo_ingreso', 'nuevo_puesto', 'reposicion', 'cambio_equipo'];
const estadosSC = ['pendiente_infra', 'pendiente_rrhh', 'aprobada_rrhh', 'registrando_compra', 'completada', 'rechazada'];
const tiposEquipo = ['celular', 'notebook'];

let okSC = 0;
for (let i = 0; i < 10; i++) {
  const solicitante = rand(personalRows);
  const beneficiario = rand(personalRows);
  const motivo = rand(motivosSC);
  const tipoEq = rand(tiposEquipo);
  const estado = rand(estadosSC);
  const scId = randomUUID();
  const catalogo = catalogoRows.length ? rand(catalogoRows) : null;

  try {
    await client.query(
      `INSERT INTO solicitudes_compra (
        id, tipo_equipo, motivo, estado,
        solicitante_personal_id, beneficiario_personal_id,
        catalogo_equipo_id,
        observacion_solicitante, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        scId, tipoEq, motivo, estado,
        solicitante.id, beneficiario.id,
        catalogo?.id ?? null,
        `Solicitud de prueba staging #${i + 1} — ${motivo.replace('_', ' ')}`
      ]
    );
    okSC++;
  } catch (e) {
    console.warn(`  sc[${i}] skip:`, e.message.slice(0, 80));
  }
}
console.log(`  ✅ solicitudes_compra: ${okSC}/10 insertadas`);

// ─── resumen ──────────────────────────────────────────────────────────────────

const { rows: counts } = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM empresas) AS empresas,
    (SELECT COUNT(*) FROM sedes) AS sedes,
    (SELECT COUNT(*) FROM personal) AS personal,
    (SELECT COUNT(*) FROM inventario) AS inventario,
    (SELECT COUNT(*) FROM remitos) AS remitos,
    (SELECT COUNT(*) FROM solicitudes_compra) AS solicitudes_compra,
    (SELECT COUNT(*) FROM categoria_equipos) AS categorias
`);

console.log('\n🎉 STAGING SEED COMPLETO');
console.log('─'.repeat(40));
console.table(counts[0]);

await client.end();
