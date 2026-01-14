# Eliminar config.json y Usar Variables de Entorno

## ✅ Cambios Ya Aplicados

He realizado los siguientes cambios:

1. ✅ **Creado `config/config.js`** → Usa variables de entorno del `.env`
2. ✅ **Actualizado `.sequelizerc`** → Ahora apunta a `config.js` en lugar de `config.json`
3. ✅ **Actualizado `.gitignore`** → Ya ignora `config/config.json`

---

## 🔥 Pasos para Eliminar config.json de Forma Segura

### PASO 1: Verificar que el .env tiene las credenciales

Asegúrate de que tu archivo `.env` (LOCAL, NO SUBIR A GIT) tenga estas variables:

```bash
# Base de datos
DB_HOST=megasysdb62438.postgres.database.azure.com
DB_PORT=5432
DB_NAME=megasys
DB_USER=postgres
DB_PASSWORD=Italia0454!  # O la password actual de tu BD
DB_DIALECT=postgres
```

**Verifica el archivo**:
```bash
cat .env | grep DB_
```

Si no están, agrégalas manualmente al `.env`:
```bash
echo "" >> .env
echo "# Base de datos (de config.json)" >> .env
echo "DB_HOST=megasysdb62438.postgres.database.azure.com" >> .env
echo "DB_PORT=5432" >> .env
echo "DB_NAME=megasys" >> .env
echo "DB_USER=postgres" >> .env
echo "DB_PASSWORD=Italia0454!" >> .env
echo "DB_DIALECT=postgres" >> .env
```

---

### PASO 2: Probar que Sequelize CLI funciona con config.js

```bash
# Test: Listar migraciones pendientes
npx sequelize-cli db:migrate:status

# Debe funcionar sin errores y mostrar las migraciones
```

Si ves un error como `Cannot find module 'config/config.json'`, significa que algo falló. Verifica que `.sequelizerc` tenga:
```javascript
'config': path.resolve('config', 'config.js'),  // NO .json
```

---

### PASO 3: Probar que la aplicación funciona

```bash
# Iniciar el servidor
npm run dev

# Debe conectar a la BD sin errores
# Busca en los logs: "Conexión a la base de datos establecida correctamente"
```

Si hay errores de conexión, verifica que las variables en `.env` son correctas.

---

### PASO 4: Eliminar config.json del filesystem

**IMPORTANTE**: Solo hacer esto DESPUÉS de verificar que todo funciona con config.js.

```bash
# Backup por si acaso
cp config/config.json config/config.json.backup

# Eliminar el archivo
rm config/config.json

# Verificar que se eliminó
ls -la config/
# NO debe aparecer config.json, solo config.js
```

---

### PASO 5: Remover config.json del Git

```bash
# Verificar si está trackeado en Git
git status config/config.json

# Si aparece, removerlo del índice de Git (pero no del filesystem, ya lo borramos)
git rm config/config.json

# Si Git dice "does not match any files", es porque ya no existe - perfecto!
```

---

### PASO 6: Verificar el historial de Git (CRÍTICO)

⚠️ **PROBLEMA**: Si `config.json` estuvo en Git antes, la password "Italia0454!" está en el historial.

**Verificar**:
```bash
# Ver si config.json está en la historia
git log --all --full-history -- config/config.json

# Si muestra commits, la password ESTÁ en el historial
```

**Si está en el historial, tienes 2 opciones**:

#### Opción A: Rotar la password (MÁS FÁCIL, RECOMENDADO)

1. Cambiar la password en Azure PostgreSQL:
   - Ir a Azure Portal
   - PostgreSQL Database → Settings → Reset password
   - Generar nueva password segura
   - Actualizar `.env` con la nueva password

2. Actualizar Railway con la nueva password (cuando hagas deployment)

#### Opción B: Reescribir historial de Git (AVANZADO, PELIGROSO)

```bash
# Usar git-filter-repo (requiere instalación)
# SOLO si eres el único desarrollador y NO hay trabajo sin pushear

# NO EJECUTAR ESTE COMANDO SIN BACKUP
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch config/config.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (reescribe la historia remota)
git push origin --force --all
```

⚠️ **ADVERTENCIA**: La Opción B es destructiva. Úsala solo si:
- Eres el único desarrollador
- No hay otros clones del repositorio activos
- Tienes backup del proyecto

**Recomendación**: Usa Opción A (rotar password).

---

### PASO 7: Commit de los cambios

```bash
# Ver qué cambió
git status

# Debe mostrar:
# modified: .sequelizerc
# modified: .gitignore
# new file: config/config.js
# deleted: config/config.json

# Agregar cambios
git add .sequelizerc .gitignore config/config.js

# Si config.json fue eliminado del repo
git add config/config.json

# Commit
git commit -m "Migrar de config.json a config.js con variables de entorno"

# Push
git push
```

---

## 📋 Verificación Final

### ✅ Checklist

- [ ] `.env` contiene todas las variables de BD
- [ ] `config/config.js` existe y usa `process.env`
- [ ] `.sequelizerc` apunta a `config.js` (NO .json)
- [ ] `npx sequelize-cli db:migrate:status` funciona
- [ ] `npm run dev` conecta a la BD sin errores
- [ ] `config/config.json` NO existe en el filesystem
- [ ] `config/config.json` NO está en Git (git status)
- [ ] Password de BD rotada (si estuvo en historial Git)

---

## 🔒 Archivos con Credenciales - Estado Final

| Archivo | Estado | ¿En Git? | Contiene Credenciales |
|---------|--------|----------|----------------------|
| `config/config.json` | ❌ ELIMINADO | ❌ NO | N/A |
| `config/config.js` | ✅ EXISTE | ✅ SÍ | ❌ NO (usa env vars) |
| `.env` | ✅ EXISTE | ❌ NO (ignorado) | ✅ SÍ (seguro) |
| `.env.example` | ✅ EXISTE | ✅ SÍ | ❌ NO (solo ejemplos) |

---

## 🎯 Beneficios de este Cambio

✅ **Seguridad**: Credenciales NUNCA en Git
✅ **Flexibilidad**: Diferentes credenciales por ambiente (dev/staging/prod)
✅ **Railway**: Variables de entorno nativas
✅ **12-Factor App**: Buenas prácticas de deployment
✅ **Sin hardcoding**: Cero credenciales en código

---

## 🚀 Para Railway

Cuando hagas deployment en Railway, las variables de entorno se configuran en el dashboard:

```
Railway → Tu Proyecto → Variables tab
```

**NO necesitas** archivo `.env` en Railway, todo se configura desde el dashboard.

---

## ⚠️ IMPORTANTE: .env NO Va a Git

**NUNCA** hagas commit del archivo `.env`:

```bash
# Verificar que .env está ignorado
git check-ignore .env
# Debe retornar: .env

# Si NO está ignorado, agrégalo:
echo ".env" >> .gitignore
```

---

## 🔥 Troubleshooting

### Error: "Cannot find module 'config/config.json'"

**Causa**: `.sequelizerc` todavía apunta a `.json`

**Solución**:
```bash
# Verificar contenido
cat .sequelizerc | grep config

# Debe decir: config.js NO config.json
```

---

### Error: "password authentication failed"

**Causa**: Variables en `.env` incorrectas

**Solución**:
```bash
# Verificar variables
cat .env | grep DB_

# Comparar con credenciales reales
# Verificar que DB_PASSWORD es correcta
```

---

### Sequelize CLI no lee las variables del .env

**Causa**: `config.js` no tiene `require('dotenv').config()`

**Solución**: Ya está incluido en el `config.js` que creé (línea 1).

---

**¿Listo?** Comienza con el PASO 1 y sigue en orden.
