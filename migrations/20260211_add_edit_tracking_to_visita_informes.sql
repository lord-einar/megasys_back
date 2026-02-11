-- Agregar campos para trackear ediciones de informes de visitas

ALTER TABLE visita_informes
ADD COLUMN IF NOT EXISTS editado_por_id UUID REFERENCES personal(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fecha_ultima_edicion TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS veces_editado INTEGER NOT NULL DEFAULT 0;

-- Crear índice para búsquedas por editor
CREATE INDEX IF NOT EXISTS idx_visita_informes_editado_por
ON visita_informes(editado_por_id);

-- Comentarios
COMMENT ON COLUMN visita_informes.editado_por_id IS 'ID del usuario que editó el informe (null si nunca fue editado)';
COMMENT ON COLUMN visita_informes.fecha_ultima_edicion IS 'Fecha y hora de la última edición del informe';
COMMENT ON COLUMN visita_informes.veces_editado IS 'Contador de veces que se editó el informe';
