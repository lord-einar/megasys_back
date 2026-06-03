import express from 'express';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sequelize } from '../../shared/utils/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

const SEED_SECRET = process.env.SEED_SECRET || 'staging-seed-2026';

router.post('/seed-staging', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  if (req.headers['x-seed-secret'] !== SEED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const info = (msg) => { console.log(msg); log.push(msg); };

  try {
    const dataPath = path.resolve(__dirname, '../../../data/staging-seed-data.json');
    const { empresas, sedes, personal, tipos_all } = JSON.parse(readFileSync(dataPath, 'utf8'));

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const upsert = async (table, rows, conflict = 'id') => {
      let ok = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const ph = vals.map((_, i) => `$${i + 1}`).join(',');
        const upd = cols.filter(c => c !== conflict).map(c => `${c}=EXCLUDED.${c}`).join(',');
        try {
          await sequelize.query(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${ph}) ON CONFLICT(${conflict}) DO UPDATE SET ${upd}`, { bind: vals });
          ok++;
        } catch (e) { info(`  skip ${table}: ${e.message.slice(0, 60)}`); }
      }
      info(`✅ ${table}: ${ok}/${rows.length}`);
    };

    // 1. Datos maestros
    await upsert('empresas', empresas.map(e => ({ id: e.id, nombre_empresa: e.nombre_empresa, cuit: e.cuit, rason_social: e.rason_social, email: e.email, telefono: e.telefono, direccion: e.direccion, activo: true, created_at: new Date(), updated_at: new Date() })));
    await upsert('sedes', sedes.map(s => ({ id: s.id, nombre_sede: s.nombre_sede, direccion: s.direccion, localidad: s.localidad, provincia: s.provincia, activo: true, created_at: new Date(), updated_at: new Date() })));
    await upsert('personal', personal.map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, email: p.email, telefono: p.telefono ?? null, sede_id: p.sede_id ?? null, privilegio_app: p.privilegio_app ?? 'user', activo: true, fecha_ingreso: p.fecha_ingreso ?? new Date().toISOString().slice(0, 10), created_at: new Date(), updated_at: new Date() })));

    // 2. Tipos articulo
    for (const t of tipos_all) {
      try {
        await sequelize.query(`INSERT INTO tipo_articulo(id,nombre,descripcion,activo,created_at,updated_at) VALUES($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT(nombre) DO UPDATE SET descripcion=EXCLUDED.descripcion,activo=EXCLUDED.activo`, { bind: [t.id, t.nombre, t.descripcion ?? null, t.activo ?? true] });
      } catch (e) { info(`  tipo skip: ${e.message.slice(0, 50)}`); }
    }
    info(`✅ tipo_articulo: ${tipos_all.length} procesados`);

    // Mapa nombre→id en staging
    const [tiposStaging] = await sequelize.query('SELECT id, nombre FROM tipo_articulo');
    const tipoMap = Object.fromEntries(tiposStaging.map(t => [t.nombre, t.id]));
    info(`ℹ️ tipos: ${Object.keys(tipoMap).join(', ')}`);

    // 3. Categorías
    const categorias = [
      { id: randomUUID(), nombre: 'Gerente / Director', descripcion: 'Equipos premium para dirección', tipo: 'notebook', activo: true },
      { id: randomUUID(), nombre: 'Ejecutivo de área', descripcion: 'Equipos estándar ejecutivos', tipo: 'notebook', activo: true },
      { id: randomUUID(), nombre: 'Operativo oficina', descripcion: 'Equipos básicos de oficina', tipo: 'notebook', activo: true },
      { id: randomUUID(), nombre: 'Celular ejecutivo', descripcion: 'Smartphones gama alta', tipo: 'celular', activo: true },
      { id: randomUUID(), nombre: 'Celular operativo', descripcion: 'Smartphones estándar', tipo: 'celular', activo: true },
    ];
    for (const c of categorias) {
      try { await sequelize.query(`INSERT INTO categoria_equipos(id,nombre,descripcion,tipo,activo,created_at,updated_at) VALUES($1,$2,$3,$4,$5,NOW(),NOW()) ON CONFLICT DO NOTHING`, { bind: [c.id, c.nombre, c.descripcion, c.tipo, c.activo] }); } catch (e) {}
    }
    info(`✅ categoria_equipos: ${categorias.length}`);

    const [sedesDb] = await sequelize.query("SELECT id FROM sedes LIMIT 20");
    const sedeIds = sedesDb.map(s => s.id);
    const catNbIds = categorias.filter(c => c.tipo === 'notebook').map(c => c.id);
    const catCelIds = categorias.filter(c => c.tipo === 'celular').map(c => c.id);

    // 4. 100 artículos
    const modelosPorTipo = {
      'Notebook':    [['Lenovo','ThinkPad X1 Carbon'],['Lenovo','ThinkPad E14'],['HP','EliteBook 840 G9'],['HP','ProBook 450 G10'],['Dell','Latitude 5540'],['Dell','Inspiron 15'],['Apple','MacBook Air M2'],['Asus','ZenBook 14']],
      'Celular':     [['Samsung','Galaxy S24'],['Samsung','Galaxy A54'],['iPhone','iPhone 15 Pro'],['iPhone','iPhone 14'],['Motorola','Edge 40'],['Motorola','Moto G84'],['Xiaomi','Redmi Note 13']],
      'PC':          [['HP','EliteDesk 800 G6'],['Dell','OptiPlex 7000'],['Lenovo','ThinkCentre M75q'],['Asus','ExpertCenter D500']],
      'Monitor':     [['LG','27BN65Q'],['Samsung','S27A600'],['Dell','P2722H'],['HP','M27f'],['Philips','272B7']],
      'Impresora':   [['HP','LaserJet Pro M404n'],['Canon','imageRUNNER 2425'],['Epson','EcoTank L3250'],['Brother','HL-L2375DW']],
      'Periféricos': [['Logitech','MX Keys Combo'],['Microsoft','Sculpt Ergonomic'],['HP','USB 800dpi Mouse']],
      'Cámara':      [['Hikvision','DS-2CD2143'],['Dahua','IPC-HFW2849S'],['Axis','P3245-V']],
      'NVR':         [['Hikvision','DS-7608NI-K2'],['Dahua','NVR4108HS-8P-4KS2']],
    };
    const distribucion = [
      { tipo: 'Notebook', qty: 30, cat: 'nb' },
      { tipo: 'Celular', qty: 20, cat: 'cel' },
      { tipo: 'PC', qty: 12 },
      { tipo: 'Monitor', qty: 12 },
      { tipo: 'Impresora', qty: 10 },
      { tipo: 'Periféricos', qty: 8 },
      { tipo: 'Cámara', qty: 5 },
      { tipo: 'NVR', qty: 3 },
    ];
    const estadosInv = ['disponible','disponible','disponible','en_uso','en_uso','mantenimiento'];
    let okInv = 0, idx = 0;

    for (const { tipo, qty, cat } of distribucion) {
      const tipoId = tipoMap[tipo]; if (!tipoId) { info(`⚠️ tipo "${tipo}" no encontrado`); continue; }
      const modelos = modelosPorTipo[tipo] || [['Genérico', tipo]];
      for (let q = 0; q < qty; q++) {
        idx++;
        const [marca, modelo] = rand(modelos);
        const serie = `STG-${tipo.slice(0,3).toUpperCase().replace(' ','')}-${String(idx).padStart(4,'0')}`;
        const catId = cat === 'nb' ? rand(catNbIds) : cat === 'cel' ? rand(catCelIds) : null;
        try {
          await sequelize.query(`INSERT INTO inventario(id,tipo_articulo_id,marca,modelo,numero_serie,sede_id,estado,activo,categoria_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8,NOW(),NOW()) ON CONFLICT(numero_serie) DO NOTHING`,
            { bind: [randomUUID(), tipoId, marca, modelo, serie, rand(sedeIds), rand(estadosInv), catId] });
          okInv++;
        } catch (e) { info(`  inv skip: ${e.message.slice(0, 50)}`); }
      }
    }
    info(`✅ inventario: ${okInv}/100`);

    // 5. 20 remitos
    const [personalDb] = await sequelize.query("SELECT id, sede_id FROM personal WHERE activo=true AND sede_id IS NOT NULL LIMIT 50");
    const [invDb] = await sequelize.query("SELECT id, sede_id FROM inventario WHERE activo=true LIMIT 80");
    const estadosRem = ['preparado','en_transito','entregado','completado'];
    const [[{ nextval }]] = await sequelize.query("SELECT NEXTVAL('remito_numero_seq')");
    let seqNum = parseInt(nextval), okRem = 0;

    for (let i = 0; i < 20; i++) {
      const sol = rand(personalDb);
      const remitoId = randomUUID();
      const num = `REM-2026-${String(seqNum++).padStart(3,'0')}`;
      const fecha = new Date(Date.now() - randInt(0, 30) * 86400000);
      try {
        await sequelize.query(`INSERT INTO remitos(id,numero_remito,fecha,sede_origen_id,sede_destino_id,solicitante_id,estado,observaciones,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
          { bind: [remitoId, num, fecha, sol.sede_id, rand(sedeIds), sol.id, rand(estadosRem), `Remito de prueba #${i+1}`] });
        for (let d = 0; d < randInt(1, 3); d++) {
          try { await sequelize.query(`INSERT INTO remito_detalles(id,remito_id,inventario_id,cantidad,es_prestamo,created_at,updated_at) VALUES($1,$2,$3,1,false,NOW(),NOW())`,
            { bind: [randomUUID(), remitoId, rand(invDb).id] }); } catch (_) {}
        }
        okRem++;
      } catch (e) { info(`  remito skip: ${e.message.slice(0, 60)}`); }
    }
    info(`✅ remitos: ${okRem}/20`);

    // 6. 10 solicitudes de compra
    const [catalogoDb] = await sequelize.query("SELECT id FROM catalogo_equipos LIMIT 10");
    const motivosSC = ['nuevo_ingreso','nuevo_puesto','reposicion','cambio_equipo'];
    const estadosSC = ['pendiente_infra','pendiente_rrhh','aprobada_rrhh','completada','rechazada'];
    let okSC = 0;

    for (let i = 0; i < 10; i++) {
      const sol = rand(personalDb), ben = rand(personalDb);
      const catItem = catalogoDb.length ? rand(catalogoDb) : null;
      try {
        await sequelize.query(`INSERT INTO solicitudes_compra(id,tipo_equipo,motivo,estado,solicitante_personal_id,beneficiario_personal_id,catalogo_equipo_id,observacion_solicitante,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) ON CONFLICT DO NOTHING`,
          { bind: [randomUUID(), rand(['notebook','celular']), rand(motivosSC), rand(estadosSC), sol.id, ben.id, catItem?.id ?? null, `Solicitud de prueba #${i+1}`] });
        okSC++;
      } catch (e) { info(`  sc skip: ${e.message.slice(0, 60)}`); }
    }
    info(`✅ solicitudes_compra: ${okSC}/10`);

    // Conteos finales
    const [[counts]] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM empresas)::int AS empresas,
        (SELECT COUNT(*) FROM sedes)::int AS sedes,
        (SELECT COUNT(*) FROM personal)::int AS personal,
        (SELECT COUNT(*) FROM inventario)::int AS inventario,
        (SELECT COUNT(*) FROM remitos)::int AS remitos,
        (SELECT COUNT(*) FROM solicitudes_compra)::int AS solicitudes_compra,
        (SELECT COUNT(*) FROM categoria_equipos)::int AS categorias
    `);

    return res.json({ success: true, counts, log });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ success: false, error: err.message, log });
  }
});

export default router;
