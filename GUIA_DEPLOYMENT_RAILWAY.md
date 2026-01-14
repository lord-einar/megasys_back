# Guía de Deployment en Railway - Sin Perder Remitos

## ✅ Cambios Ya Aplicados

He realizado los siguientes cambios en el código:

1. ✅ **Storage de PDFs → Azure Blob Storage**
   - Creado `src/shared/services/storageService.js`
   - Actualizado `src/shared/services/pdfService.js` para usar Azure Blob
   - Los PDFs ahora se guardan en la nube, NO en filesystem local

2. ✅ **Logger para Railway**
   - Actualizado `src/shared/utils/logger.js`
   - Ahora siempre escribe a console (Railway captura stdout/stderr)

3. ✅ **CORS Multi-Origen**
   - Actualizado `src/app.js`
   - Ahora acepta múltiples dominios separados por coma

4. ✅ **Procfile creado** para Railway

5. ✅ **Actualizado .gitignore** para ignorar `config/config.json`

---

## 🚀 Pasos para Deployar (En Orden)

### PASO 1: Instalar Dependencia de Azure Blob

```bash
cd /home/einar/Documentos/Megatlon/megasys_back

npm install @azure/storage-blob
```

---

### PASO 2: Remover config.json del Git (CRÍTICO)

```bash
# Verificar si config.json está en Git
git status config/config.json

# Si aparece, removerlo del tracking
git rm --cached config/config.json

# Commit del cambio
git add .gitignore
git commit -m "Remover config.json del repositorio por seguridad"
```

⚠️ **IMPORTANTE**: Si `config/config.json` ya estuvo en Git antes, la password "Italia0454!" está en el historial. Debes:
1. Cambiar la password de PostgreSQL INMEDIATAMENTE
2. Considerar reescribir el historial de Git (avanzado)

---

### PASO 3: Crear Azure Storage Account

Si aún no tienes un Storage Account en Azure:

1. Ir a Azure Portal: https://portal.azure.com
2. Crear nuevo "Storage Account"
3. Nombre: `megasysstorage` (o el que prefieras)
4. Region: La misma de tu PostgreSQL
5. Performance: Standard
6. Redundancia: LRS (suficiente para archivos PDF)

Una vez creado:

7. Ir a "Access keys" en el menú lateral
8. Copiar "Connection string" del key1
9. Guardar para usar en Railway

---

### PASO 4: Crear Proyecto en Railway

1. Ir a https://railway.app
2. Click "New Project"
3. Seleccionar "Deploy from GitHub repo"
4. Conectar tu repositorio `megasys_back`
5. Railway detectará automáticamente Node.js y el Procfile

---

### PASO 5: Agregar PostgreSQL a Railway

1. En tu proyecto Railway, click "+ New"
2. Seleccionar "Database" → "PostgreSQL"
3. Railway creará automáticamente la variable `DATABASE_URL`

**IMPORTANTE**: Railway provee `DATABASE_URL` completa, pero tu app usa variables individuales. Necesitas agregar las variables manualmente O modificar el código para usar `DATABASE_URL`.

**Opción 1 - Usar las variables individuales** (recomendado):

En Railway, agregar estas variables manualmente desde la URL de PostgreSQL:

```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway

Extraer:
DB_HOST=postgres.railway.internal
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=PASSWORD
DB_DIALECT=postgres
```

---

### PASO 6: Configurar Variables de Entorno en Railway

En tu proyecto Railway, ir a "Variables" y agregar:

```bash
# Ambiente
NODE_ENV=production
PORT=4000

# Database (extraídas de DATABASE_URL o agregadas manualmente)
DB_HOST=postgres.railway.internal
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=<PASSWORD_DE_RAILWAY>
DB_DIALECT=postgres

# Database Pool
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_POOL_IDLE=30000

# JWT (GENERAR NUEVO - NUNCA usar el del .env local)
JWT_SECRET=<EJECUTAR: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=24h
CONFIRMATION_TOKEN_EXPIRES=30d

# Azure AD (tus credenciales actuales)
AZURE_CLIENT_ID=<TU_CLIENT_ID>
AZURE_CLIENT_SECRET=<TU_CLIENT_SECRET>
AZURE_TENANT_ID=<TU_TENANT_ID>
AZURE_REDIRECT_URI=https://tu-app.up.railway.app/api/auth/callback

# CORS - MÚLTIPLES DOMINIOS (separados por coma, SIN espacios extras)
CORS_ORIGIN=https://megasys.azurewebsites.net,https://megasys-staging.azurewebsites.net

# Frontend URLs
FRONTEND_URL=https://megasys.azurewebsites.net
FRONTEND_LOGIN_URL=https://megasys.azurewebsites.net/login

# SMTP (tus credenciales actuales)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=remitos@megatlon.com.ar
SMTP_PASSWORD=<TU_PASSWORD_SMTP>
SMTP_FROM=remitos@megatlon.com.ar
EMAIL_INFRAESTRUCTURA=infraestructura@megatlon.com.ar

# Azure Blob Storage (del PASO 3)
AZURE_STORAGE_CONNECTION_STRING=<TU_CONNECTION_STRING>
AZURE_STORAGE_CONTAINER=megasys-files

# Logging
LOG_LEVEL=info

# Sequelize
FORCE_SYNC=false
```

---

### PASO 7: Deploy

1. Railway hará deploy automáticamente al hacer push a main/master
2. O click "Deploy" en el dashboard de Railway

**Monitorear logs**:
- En Railway dashboard → "Deployments" → Ver logs en tiempo real
- Buscar: "Servidor iniciado en puerto"
- Verificar: "Azure Blob Storage container inicializado correctamente"

---

### PASO 8: Verificar Funcionamiento

#### A. Health Check

```bash
curl https://tu-app.up.railway.app/health
```

Esperado:
```json
{
  "status": "OK",
  "timestamp": "2025-12-26T...",
  "environment": "production",
  "version": "1.0.0"
}
```

#### B. Test de CORS

```bash
curl -H "Origin: https://megasys.azurewebsites.net" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://tu-app.up.railway.app/api/auth/login
```

Debe retornar headers CORS correctos, NO error.

#### C. Test de Remitos (CRÍTICO)

1. Login en el frontend conectado al backend de Railway
2. Crear un remito nuevo
3. Verificar que se genera el PDF
4. **Verificar en Azure Portal → Storage Account → Containers → megasys-files**:
   - Debe aparecer carpeta `remitos/`
   - Debe aparecer el PDF generado
5. Hacer click en el PDF desde la aplicación
6. El PDF debe abrirse correctamente desde la URL de Azure Blob

**URL esperada del PDF**:
```
https://megasysstorage.blob.core.windows.net/megasys-files/remitos/20251226_REM-2025-001.pdf
```

---

## 🔥 Troubleshooting

### Error: "AZURE_STORAGE_CONNECTION_STRING no está configurada"

**Causa**: Falta la variable de entorno.

**Solución**:
1. Ir a Railway → Variables
2. Agregar `AZURE_STORAGE_CONNECTION_STRING` con el valor del PASO 3

---

### Error: "Not allowed by CORS"

**Causa**: El origen del frontend no está en la lista de CORS_ORIGIN.

**Solución**:
1. Verificar la variable `CORS_ORIGIN` en Railway
2. Debe incluir EXACTAMENTE el dominio del frontend (con https://)
3. Múltiples dominios separados por coma SIN espacios:
   ```
   CORS_ORIGIN=https://megasys.azurewebsites.net,https://megasys-staging.azurewebsites.net
   ```

---

### Error: "Archivo PDF no encontrado"

**Causa**: Probablemente buscando en filesystem local en lugar de Azure Blob.

**Solución**:
1. Verificar que el código actualizado está deployado
2. Verificar logs de Railway: debe decir "PDF subido exitosamente"
3. Verificar en Azure Portal que el container `megasys-files` existe

---

### PDFs no se guardan en Azure Blob

**Causa**: Error en la conexión a Azure Storage.

**Solución**:
1. Verificar logs de Railway: `logger.error('Error subiendo PDF a Azure Blob')`
2. Verificar que `AZURE_STORAGE_CONNECTION_STRING` es correcta
3. Verificar que el Storage Account tiene acceso público para blobs (Container → Access level: "Blob")

---

### No veo logs en Railway

**Causa**: Logger no configurado correctamente.

**Solución**:
1. Verificar que el archivo `src/shared/utils/logger.js` tiene los cambios aplicados
2. Los logs deben aparecer en Railway Dashboard → Logs
3. Buscar logs en formato JSON (porque NODE_ENV=production)

---

## ✅ Checklist Post-Deployment

- [ ] Health check responde OK
- [ ] Logs visibles en Railway Dashboard
- [ ] CORS funciona (frontend puede conectar)
- [ ] Login funciona
- [ ] Crear remito funciona
- [ ] PDF se genera y se guarda en Azure Blob
- [ ] PDF se puede descargar desde el frontend
- [ ] Emails de notificación se envían
- [ ] No hay errores en logs de Railway

---

## 📊 Diferencias entre Local y Railway

| Característica | Local (Desarrollo) | Railway (Producción) |
|----------------|-------------------|----------------------|
| PDFs guardados | Filesystem local (`storage/`) | Azure Blob Storage |
| Logs | Archivos + Console coloreada | Console JSON (Railway captura) |
| Base de datos | PostgreSQL local/Azure | PostgreSQL de Railway |
| CORS | Solo localhost | Múltiples dominios frontend |
| Variables env | `.env` local | Variables de Railway |

---

## 🔒 Seguridad Post-Deployment

1. ✅ **Rotar credenciales**:
   - Cambiar password de PostgreSQL (está en historial Git)
   - Generar nuevo JWT_SECRET (no usar el de desarrollo)
   - Verificar que SMTP_PASSWORD no está hardcodeado

2. ✅ **Verificar .gitignore**:
   ```bash
   git status
   # NO debe aparecer: config/config.json, .env
   ```

3. ✅ **Azure Blob Security**:
   - Container access level: "Blob" (lectura pública de PDFs)
   - Connection string: NUNCA commitear en Git
   - Considerar SAS tokens para mayor seguridad (futuro)

---

## 🎯 Siguiente Paso: Frontend

Una vez que el backend esté funcionando en Railway:

1. Actualizar frontend en Azure Static Web Apps:
   - Variable `VITE_BACKEND_HOST` → `tu-app.up.railway.app`
   - Re-deployar frontend

2. Probar flujo completo:
   - Login → Crear Remito → Ver PDF → Email notificación

---

**¿Dudas?** Revisar logs de Railway en tiempo real para diagnosticar errores.
