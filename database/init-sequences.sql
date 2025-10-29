-- database/init-sequences.sql
-- Script para inicializar secuencias de la base de datos

-- Crear secuencia para número de remito
-- Formato: REM-2025-001, REM-2025-002, etc.
-- La secuencia genera solo el número: 1, 2, 3, etc.
-- El año se agrega en la aplicación

CREATE SEQUENCE IF NOT EXISTS remito_numero_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- Asignar permisos (si es necesario)
-- GRANT USAGE, SELECT ON SEQUENCE remito_numero_seq TO [usuario_db];

-- Para usar en la aplicación:
-- SELECT NEXTVAL('remito_numero_seq') AS numero;
-- Resultado esperado: 1, 2, 3, ..., 999
-- Formato final: 'REM-2025-001', 'REM-2025-002', ..., 'REM-2025-999'
