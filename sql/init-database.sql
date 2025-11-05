-- Crear todas las tablas necesarias con UUIDs

-- Tabla: empresas
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_empresa VARCHAR(100) NOT NULL UNIQUE,
  cuit VARCHAR(20) UNIQUE,
  rason_social VARCHAR(200),
  email VARCHAR(100),
  telefono VARCHAR(20),
  direccion VARCHAR(200),
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tabla: sedes
CREATE TABLE IF NOT EXISTS sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  nombre_sede VARCHAR(100) NOT NULL,
  direccion VARCHAR(200) NOT NULL,
  localidad VARCHAR(100) NOT NULL,
  provincia VARCHAR(100) NOT NULL,
  pais VARCHAR(100) DEFAULT 'Argentina',
  telefono VARCHAR(20),
  ip_sede VARCHAR(15),
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(empresa_id, nombre_sede)
);

-- Tabla: roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  nivel_jerarquia INTEGER DEFAULT 1 NOT NULL,
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tabla: personal
CREATE TABLE IF NOT EXISTS personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL,
  apellido VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  sede_id UUID REFERENCES sedes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  rol_id UUID NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  activo BOOLEAN DEFAULT true NOT NULL,
  fecha_ingreso DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tabla: sede_asignaciones (para asignar soportes a sedes)
CREATE TABLE IF NOT EXISTS sede_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES sedes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE ON UPDATE CASCADE,
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  fecha_fin_asignacion TIMESTAMP,
  activo BOOLEAN DEFAULT true NOT NULL,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(sede_id, personal_id) WHERE activo = true
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_empresas_nombre ON empresas(nombre_empresa);
CREATE INDEX IF NOT EXISTS idx_empresas_activo ON empresas(activo);
CREATE INDEX IF NOT EXISTS idx_sedes_empresa_id ON sedes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sedes_nombre ON sedes(nombre_sede);
CREATE INDEX IF NOT EXISTS idx_sedes_activo ON sedes(activo);
CREATE INDEX IF NOT EXISTS idx_roles_nombre ON roles(nombre);
CREATE INDEX IF NOT EXISTS idx_roles_nivel ON roles(nivel_jerarquia);
CREATE INDEX IF NOT EXISTS idx_roles_activo ON roles(activo);
CREATE INDEX IF NOT EXISTS idx_personal_email ON personal(email);
CREATE INDEX IF NOT EXISTS idx_personal_sede_id ON personal(sede_id);
CREATE INDEX IF NOT EXISTS idx_personal_rol_id ON personal(rol_id);
CREATE INDEX IF NOT EXISTS idx_personal_activo ON personal(activo);
CREATE INDEX IF NOT EXISTS idx_personal_nombre_completo ON personal(apellido, nombre);
CREATE INDEX IF NOT EXISTS idx_sede_asignacion_sede_id ON sede_asignaciones(sede_id);
CREATE INDEX IF NOT EXISTS idx_sede_asignacion_personal_id ON sede_asignaciones(personal_id);
CREATE INDEX IF NOT EXISTS idx_sede_asignacion_activo ON sede_asignaciones(activo);
