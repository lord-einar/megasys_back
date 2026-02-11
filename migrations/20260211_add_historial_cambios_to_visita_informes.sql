-- Agregar campo para historial de cambios detallado

ALTER TABLE visita_informes
ADD COLUMN IF NOT EXISTS historial_cambios JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Comentario
COMMENT ON COLUMN visita_informes.historial_cambios IS 'Array de objetos con historial de cambios: [{ fecha, usuario, cambios: { campo: { antes, despues } } }]';

-- Índice para búsquedas en el historial
CREATE INDEX IF NOT EXISTS idx_visita_informes_historial_cambios
ON visita_informes USING gin(historial_cambios);
