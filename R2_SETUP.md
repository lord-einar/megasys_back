# Configuración de Cloudflare R2 para Megasys

## Resumen

El proyecto ha sido migrado de almacenamiento local de PDFs a **Cloudflare R2** para permitir el deployment en plataformas como Railway/Vercel donde el filesystem no es persistente.

---

## Cambios Realizados

### 1. Código Modificado

- ✅ **storageService.js** - Migrado de Azure Blob Storage a Cloudflare R2 (S3-compatible)
- ✅ **pdfService.js** - Eliminadas referencias a almacenamiento local
- ✅ **app.js** - Eliminado servicio de archivos estáticos locales
- ✅ **.env.example** - Agregadas variables de R2

### 2. Dependencias Agregadas

```json
{
  "@aws-sdk/client-s3": "^3.x.x"
}
```

Ya instalada con: `npm install @aws-sdk/client-s3`

---

## Configuración Requerida

### Paso 1: Obtener Credenciales de R2

1. Ve a **Cloudflare Dashboard** → **R2**
2. Tu bucket ya está creado: `megasys-remitos`
3. Clic en **Manage R2 API Tokens**
4. Crear nuevo token:
   - **Nombre:** Megasys Backend
   - **Permissions:** Object Read & Write
   - **Apply to specific buckets:** `megasys-remitos`
5. **Guardar:**
   - Access Key ID
   - Secret Access Key

### Paso 2: Configurar Acceso Público

**IMPORTANTE:** Para que los PDFs sean descargables:

1. En R2 → **megasys-remitos** → **Settings**
2. Ir a **Public Access**
3. Habilitar **Allow Access**
4. El bucket será accesible en:
   ```
   https://f6f0056b144919ae1af9805b3239a209.r2.cloudflarestorage.com/megasys-remitos/
   ```

#### Opcional: Configurar Custom Domain

Si quieres usar un dominio custom (ej: `files.megatlon.com`):

1. En R2 → **megasys-remitos** → **Settings** → **Custom Domains**
2. Agregar dominio: `files.megatlon.com`
3. Cloudflare configurará automáticamente el DNS
4. Usar `R2_PUBLIC_URL=https://files.megatlon.com` en .env

### Paso 3: Configurar Variables de Entorno

Copia el `.env.example` a `.env` y configura:

```bash
# Cloudflare R2 Storage
R2_ACCOUNT_ID=f6f0056b144919ae1af9805b3239a209
R2_ACCESS_KEY_ID=<tu-access-key-id>
R2_SECRET_ACCESS_KEY=<tu-secret-access-key>
R2_BUCKET_NAME=megasys-remitos

# Opcional: Si configuraste custom domain
R2_PUBLIC_URL=https://files.megatlon.com
```

**¿Dónde encontrar el Account ID?**
- Ya lo tienes en la URL de tu bucket: `f6f0056b144919ae1af9805b3239a209`
- También en Cloudflare Dashboard → R2 → Overview

---

## Estructura de Archivos en R2

Los PDFs se organizan en dos carpetas:

```
megasys-remitos/
├── remitos/
│   └── YYYYMMDD_REM-2025-001.pdf
│   └── YYYYMMDD_REM-2025-002.pdf
└── confirmaciones/
    └── YYYYMMDD_REM-2025-001_CONFIRMADO.pdf
    └── YYYYMMDD_REM-2025-002_CONFIRMADO.pdf
```

---

## URLs de Acceso

### Sin Custom Domain
```
https://f6f0056b144919ae1af9805b3239a209.r2.cloudflarestorage.com/megasys-remitos/remitos/20251230_REM-2025-001.pdf
```

### Con Custom Domain (files.megatlon.com)
```
https://files.megatlon.com/remitos/20251230_REM-2025-001.pdf
```

---

## Testing Local

Para probar el servicio de R2 localmente:

1. Configurar variables de entorno en `.env`
2. Iniciar el servidor: `npm run dev`
3. Crear un remito de prueba
4. Verificar en Cloudflare Dashboard → R2 → **megasys-remitos** → **Objects**
5. Verificar que el PDF sea accesible en la URL pública

---

## Migración de PDFs Existentes (Opcional)

Si tienes PDFs almacenados localmente en Azure, puedes migrarlos:

### Opción 1: Upload Manual (Cloudflare Dashboard)

1. Ve a R2 → **megasys-remitos** → **Upload**
2. Selecciona archivos de `/storage/remitos/` y `/storage/confirmaciones/`
3. Mantener la estructura de carpetas

### Opción 2: Upload Programático (Wrangler CLI)

```bash
# Instalar Wrangler (CLI de Cloudflare)
npm install -g wrangler

# Autenticar
wrangler login

# Subir directorio completo
wrangler r2 object put megasys-remitos/remitos/archivo.pdf --file=./storage/remitos/archivo.pdf
```

### Opción 3: Script de Node.js

Crear un script temporal:

```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: 'https://f6f0056b144919ae1af9805b3239a209.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadFile(localPath, remotePath) {
  const fileContent = fs.readFileSync(localPath);

  await s3Client.send(new PutObjectCommand({
    Bucket: 'megasys-remitos',
    Key: remotePath,
    Body: fileContent,
    ContentType: 'application/pdf',
  }));

  console.log(`✅ Uploaded: ${remotePath}`);
}

// Ejemplo de uso
uploadFile('./storage/remitos/archivo.pdf', 'remitos/archivo.pdf');
```

---

## Troubleshooting

### Error: "Storage service no está habilitado"

**Causa:** Variables de entorno no configuradas

**Solución:**
```bash
# Verificar que existan:
echo $R2_ACCESS_KEY_ID
echo $R2_SECRET_ACCESS_KEY

# Si están vacías, configurar en .env
```

### Error: "Access Denied" al subir archivo

**Causa:** Permisos del token API incorrectos

**Solución:**
1. Regenerar token en Cloudflare Dashboard
2. Asegurar permisos **Object Read & Write**
3. Actualizar `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`

### Error: "PDF no se descarga" (403 Forbidden)

**Causa:** Bucket no es público

**Solución:**
1. R2 → **megasys-remitos** → **Settings** → **Public Access**
2. Habilitar **Allow Access**

### URLs no funcionan con custom domain

**Causa:** DNS no propagado o mal configurado

**Solución:**
1. Esperar propagación DNS (hasta 24 horas)
2. Verificar en [dnschecker.org](https://dnschecker.org)
3. Verificar configuración en Cloudflare Dashboard

---

## Costos de R2

Cloudflare R2 es **muy económico**:

- **Almacenamiento:** $0.015/GB/mes (primeros 10GB gratis)
- **Operaciones Clase A (write):** $4.50 por millón
- **Operaciones Clase B (read):** $0.36 por millón
- **Egress (transferencia):** **$0** (GRATIS)

### Estimación para Megasys:

Asumiendo:
- 1000 remitos/mes
- 100KB por PDF
- 3000 descargas/mes

**Costos mensuales:**
- Almacenamiento: ~100MB = **$0.00** (dentro de 10GB gratis)
- Writes: 2000 operaciones = **$0.01**
- Reads: 3000 operaciones = **$0.00**
- **Total: < $0.10/mes** (prácticamente gratis)

Comparación con Azure Blob Storage: **~$5-20/mes ahorrados**

---

## Seguridad

### Buenas Prácticas

1. **Rotar credenciales periódicamente:**
   - Crear nuevo token cada 3-6 meses
   - Revocar tokens antiguos

2. **Limitar permisos:**
   - Token solo con permisos en `megasys-remitos`
   - No dar permisos admin innecesarios

3. **No commitear credenciales:**
   - `.env` debe estar en `.gitignore`
   - Usar Railway/Vercel variables de entorno

4. **CORS (si accedes desde frontend):**
   - Configurar CORS en R2 settings si es necesario
   - Por ahora no es necesario (PDFs se descargan vía backend)

---

## Soporte

- **Documentación oficial:** [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2)
- **S3 SDK Docs:** [docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- **Cloudflare Community:** [community.cloudflare.com](https://community.cloudflare.com)

---

**Última actualización:** 2025-12-30
