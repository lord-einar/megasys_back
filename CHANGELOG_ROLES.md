# Changelog - Sistema de Roles con Categorías y Especializaciones

**Fecha:** 2026-01-26
**Versión:** 1.5.0
**Tipo:** Feature - Sistema de categorización de roles

---

## 📋 Resumen de Cambios

Se implementó un sistema de roles jerárquico que permite organizar roles en **categorías principales** y **especializaciones**, sin implicar jerarquía de poder entre categorías.

### Ejemplo de Estructura:
```
📁 Sistemas (Categoría)
   ↳ Soporte Técnico
   ↳ Mesa de Ayuda
   ↳ Infraestructura

📁 Gerentes (Categoría)
   ↳ Gerente Generalista
   ↳ Gerente Comercial
   ↳ Gerente de Servicio
   ↳ Club Manager

📁 Coordinadores (Categoría)
   ↳ Coordinador Comercial
   ↳ Coordinador de Servicio
```

---

## 🗄️ Migraciones de Base de Datos

### Nueva Migración
**Archivo:** `migrations/20260126160000-add-parent-id-to-roles.cjs`

**Cambios:**
- ✅ Agrega columna `parent_id` (UUID, nullable) a tabla `roles`
- ✅ Agrega foreign key a `roles.id` con CASCADE y SET NULL
- ✅ Crea índice `idx_roles_parent_id` para optimización
- ✅ **Reversible:** Incluye método `down()` completo

**Ejecutar en producción:**
```bash
npx sequelize-cli db:migrate
```

**Verificar estado:**
```bash
npx sequelize-cli db:migrate:status
```

**Rollback (si es necesario):**
```bash
npx sequelize-cli db:migrate:undo
```

---

## 🔧 Cambios en Backend

### 1. Modelo Rol (`src/models/Rol.js`)
- ✅ Agregado campo `parent_id` (UUID, nullable)
- ✅ Cambiado `nivel_jerarquia` de `allowNull: false` a `allowNull: true`
- ✅ Valor por defecto de `nivel_jerarquia` cambiado a 5

### 2. Relaciones de Modelos (`src/models/index.js`)
- ✅ Agregada relación `Rol.hasMany(Rol, as: 'subRoles')`
- ✅ Agregada relación `Rol.belongsTo(Rol, as: 'rolPadre')`

### 3. Nuevo Servicio (`src/modules/personal/services/rolService.js`)
**Métodos implementados:**
- `listar()` - Lista roles con jerarquía incluida
- `obtenerPorId()` - Obtiene rol con padre e hijos
- `crear()` - Crea rol con validación de padre
- `actualizar()` - Actualiza rol con validación anti-ciclos
- `eliminar()` - Soft delete con validación de personal asignado
- `obtenerPersonalPorRol()` - Lista personal por rol
- `asignarRolAPersonal()` - Asigna rol a usuario

**Validaciones:**
- ✅ No permite ciclos en jerarquía
- ✅ No permite eliminar roles con personal asignado
- ✅ Valida que rol padre exista
- ✅ No permite que un rol sea su propio padre

### 4. Nuevo Controlador (`src/modules/personal/controllers/rolController.js`)
- ✅ CRUD completo para roles
- ✅ Integración con auditoría (TransactionWrapper)
- ✅ Manejo de errores robusto

### 5. Rutas Actualizadas (`src/modules/personal/routes/index.js`)
**Nuevos Endpoints:**
```
GET    /api/personal/configuracion/roles              - Listar roles
GET    /api/personal/configuracion/roles/:id          - Obtener rol
GET    /api/personal/configuracion/roles/:id/personal - Personal por rol
POST   /api/personal/configuracion/roles              - Crear rol
PUT    /api/personal/configuracion/roles/:id          - Actualizar rol
DELETE /api/personal/configuracion/roles/:id          - Eliminar rol
POST   /api/personal/configuracion/asignar-rol        - Asignar rol a usuario
```

**Validaciones de entrada:**
- `nombre`: requerido, 2-50 caracteres
- `descripcion`: opcional, texto
- `nivel_jerarquia`: opcional, 1-10 (auto 5)
- `parent_id`: opcional, UUID válido
- `activo`: opcional, boolean

---

## 🎨 Cambios en Frontend

### 1. Nueva Página: Configuración de Roles (`src/pages/ConfiguracionRolesPage.jsx`)
**Funcionalidades:**
- ✅ Vista jerárquica de roles (categorías y especializaciones)
- ✅ Búsqueda y filtros (Todos, Activos, Inactivos)
- ✅ CRUD completo con modales
- ✅ Ver personal asignado por rol
- ✅ Diseño responsive

### 2. Nuevo Componente: FormRol (`src/components/FormRol.jsx`)
**Características:**
- ✅ Crear/editar roles
- ✅ Selector de categoría padre
- ✅ Validación en frontend
- ✅ Manejo de errores

### 3. Actualización de API Client (`src/services/api.js`)
**Nuevo objeto:**
```javascript
rolesAPI = {
  list, getById, getPersonalPorRol,
  create, update, delete, asignarRol
}
```

### 4. Actualizaciones en Formularios de Personal

**NuevoPersonal.jsx y EditPersonal.jsx:**
- ✅ Selector de rol con agrupación por categorías
- ✅ Usa `<optgroup>` para organización visual
- ✅ Formato: `📁 CATEGORIA` > `↳ Especialización`
- ✅ Solo muestra roles activos

**FormVisita.jsx:**
- ✅ Lista técnicos con su rol visible
- ✅ Filtra por categoría "Sistemas"
- ✅ Muestra: "Nombre Apellido • Rol"

### 5. Navegación Actualizada

**Sidebar.jsx:**
- ✅ Nuevo ítem: "Personal > Configuración de Roles"

**App.jsx:**
- ✅ Nueva ruta: `/configuracion/roles`

---

## ⚠️ Instrucciones de Deploy

### Pre-Deploy Checklist
- [ ] Backup de base de datos
- [ ] Verificar que no hay migraciones pendientes
- [ ] Revisar variables de entorno

### Deploy Backend
```bash
# 1. Pull del código
git pull origin master

# 2. Instalar dependencias (si hay cambios)
npm install

# 3. Ejecutar migraciones
npx sequelize-cli db:migrate

# 4. Verificar migración exitosa
npx sequelize-cli db:migrate:status

# 5. Reiniciar servidor
pm2 restart megasys-api
```

### Deploy Frontend
```bash
# 1. Pull del código
git pull origin master

# 2. Instalar dependencias (si hay cambios)
npm install

# 3. Build de producción
npm run build

# 4. Deploy a Vercel/hosting
# (automático si está configurado CI/CD)
```

### Post-Deploy

1. **Crear Categorías Principales** (si no existen):
```sql
-- Conectar a la base de datos de producción
INSERT INTO roles (id, nombre, descripcion, nivel_jerarquia, parent_id, activo, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Sistemas', 'Categoría de roles de sistemas', 5, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), 'Gerentes', 'Categoría de roles de gerencia', 5, NULL, true, NOW(), NOW()),
  (gen_random_uuid(), 'Coordinadores', 'Categoría de roles de coordinación', 5, NULL, true, NOW(), NOW());
```

2. **Verificar en la UI:**
   - [ ] Acceder a Personal > Configuración de Roles
   - [ ] Ver las 3 categorías principales
   - [ ] Crear una especialización de prueba
   - [ ] Verificar formularios de Personal (Crear/Editar)
   - [ ] Verificar formulario de Visitas

---

## 🔄 Rollback (Si es necesario)

### Backend
```bash
# 1. Rollback de migración
npx sequelize-cli db:migrate:undo

# 2. Volver a versión anterior del código
git checkout <commit-anterior>

# 3. Reiniciar servidor
pm2 restart megasys-api
```

### Frontend
```bash
# 1. Volver a versión anterior
git checkout <commit-anterior>

# 2. Rebuild
npm run build

# 3. Redeploy
```

---

## 📊 Impacto y Riesgos

### Impacto en Datos Existentes
- ✅ **Bajo riesgo**: Solo agrega una columna nullable
- ✅ Roles existentes siguen funcionando sin cambios
- ✅ `parent_id = NULL` significa que es un rol principal

### Compatibilidad hacia atrás
- ✅ **Compatible**: APIs existentes siguen funcionando
- ✅ Formularios antiguos seguirán mostrando roles
- ✅ No rompe funcionalidad existente

### Performance
- ✅ Índice agregado para optimización
- ✅ No impacta consultas existentes
- ✅ Mejora queries de roles jerárquicos

---

## 🧪 Tests Sugeridos Post-Deploy

1. **Roles:**
   - [ ] Crear categoría principal
   - [ ] Crear especialización bajo categoría
   - [ ] Editar rol existente
   - [ ] Ver personal por rol
   - [ ] Intentar crear ciclo (debe fallar)

2. **Personal:**
   - [ ] Crear personal con rol de categoría
   - [ ] Crear personal con especialización
   - [ ] Editar rol de personal existente
   - [ ] Verificar que se vea el selector agrupado

3. **Visitas:**
   - [ ] Crear visita y seleccionar técnico
   - [ ] Verificar que solo aparecen roles de Sistemas
   - [ ] Ver que se muestra el rol junto al nombre

---

## 📞 Contacto

Para problemas o dudas durante el deploy:
- **Desarrollador:** [Tu nombre]
- **Documentación:** Este archivo + comentarios en código

---

## 📚 Recursos Adicionales

- **Modelo ER:** Revisar `src/models/index.js` para relaciones
- **API Docs:** Endpoints en `src/modules/personal/routes/index.js`
- **UI Reference:** `src/pages/ConfiguracionRolesPage.jsx`
