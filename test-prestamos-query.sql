-- Test query para verificar préstamos en Alcorta
-- ID de Alcorta: 281dc7d6-6f34-45ff-9549-ed9df44d966b

-- 1. Ver todos los remitos con destino a Alcorta
SELECT
    r.id,
    r.numero_remito,
    r.estado,
    r.sede_destino_id,
    r.created_at
FROM remitos r
WHERE r.sede_destino_id = '281dc7d6-6f34-45ff-9549-ed9df44d966b'
ORDER BY r.created_at DESC
LIMIT 10;

-- 2. Ver detalles de remitos con préstamos
SELECT
    rd.id as detalle_id,
    rd.remito_id,
    r.numero_remito,
    r.estado as remito_estado,
    r.sede_destino_id,
    rd.es_prestamo,
    rd.devuelto,
    rd.inventario_id
FROM remito_detalles rd
JOIN remitos r ON rd.remito_id = r.id
WHERE r.sede_destino_id = '281dc7d6-6f34-45ff-9549-ed9df44d966b'
  AND rd.es_prestamo = true
ORDER BY rd.created_at DESC
LIMIT 10;

-- 3. Buscar específicamente REM-2025-003
SELECT
    r.id,
    r.numero_remito,
    r.estado,
    r.sede_destino_id,
    rd.es_prestamo,
    rd.devuelto
FROM remitos r
LEFT JOIN remito_detalles rd ON r.id = rd.remito_id
WHERE r.numero_remito = 'REM-2025-003';

-- 4. Ver qué estados tienen los remitos con préstamos
SELECT
    r.estado,
    COUNT(*) as cantidad
FROM remitos r
JOIN remito_detalles rd ON r.id = rd.remito_id
WHERE rd.es_prestamo = true
  AND rd.devuelto = false
GROUP BY r.estado;
