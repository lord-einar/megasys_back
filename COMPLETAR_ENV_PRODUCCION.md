# Guía para Completar Variables de Entorno con Datos de Producción

## Variables que necesitan valores reales de Railway/Producción

### 🔐 **1. Cloudflare R2 (Almacenamiento de PDFs)**

**Obtener desde:** Cloudflare Dashboard → R2 → Settings

```bash
R2_ACCESS_KEY_ID=     # Obtener de Cloudflare R2 → API Tokens
R2_SECRET_ACCESS_KEY= # Obtener de Cloudflare R2 → API Tokens
```

**Comando para obtener desde Railway (si están configuradas allí):**
```bash
railway variables --service <backend-service-name> | grep R2
```

---

### 🔑 **2. JWT Secret (Seguridad)**

**Generar un secret seguro:**
```bash
openssl rand -base64 48
```

O usar un generador online: https://www.grc.com/passwords.htm

```bash
JWT_SECRET=<secret-generado-de-48-caracteres>
```

---

### 🔵 **3. Azure AD / Microsoft Entra ID**

**Obtener desde:** Azure Portal → App Registrations → Tu App

```bash
AZURE_CLIENT_ID=       # Application (client) ID
AZURE_CLIENT_SECRET=   # Client secret value (Certificates & secrets)
AZURE_TENANT_ID=       # Directory (tenant) ID
```

**IMPORTANTE:** Si no tienes estos valores, necesitas:
1. Ir a https://portal.azure.com
2. Azure Active Directory → App registrations
3. Seleccionar tu aplicación (o crear una nueva)
4. Copiar los IDs y crear un nuevo Client Secret

---

### 📧 **4. SMTP / Email (Office 365)**

**Credenciales de correo:**
```bash
SMTP_PASSWORD=  # Contraseña de remitos@megatlon.com.ar
```

**Nota:** Si usas autenticación moderna de Office 365, necesitas:
- App Password (no la contraseña regular)
- Ir a: https://account.microsoft.com/security → App passwords

---

### 🌐 **5. URLs del Frontend (Producción)**

Ya tienes la URL correcta del frontend. Actualizar:

```bash
# CORS
CORS_ORIGIN=https://megasys-front.vercel.app

# Frontend URLs
FRONTEND_URL=https://megasys-front.vercel.app
FRONTEND_LOGIN_URL=https://megasys-front.vercel.app/login
```

**Cuando migres al nuevo dominio:**
```bash
CORS_ORIGIN=https://megasys-front.vercel.app,https://portalit.grupomegatlon.com.ar
FRONTEND_URL=https://portalit.grupomegatlon.com.ar
FRONTEND_LOGIN_URL=https://portalit.grupomegatlon.com.ar/login
```

---

## 📋 CÓMO OBTENER TODAS LAS VARIABLES DE RAILWAY

### Opción 1: Desde Railway Dashboard (Web)

1. Ve a https://railway.app
2. Selecciona el proyecto "adequate-elegance"
3. Click en el servicio del **Backend** (NO Postgres)
4. Ir a la pestaña `Variables`
5. Copiar todas las variables y valores

### Opción 2: Desde Railway CLI (Requiere terminal interactiva)

```bash
# Listar servicios
railway service list

# Seleccionar el servicio del backend
railway service <nombre-servicio-backend>

# Ver variables
railway variables
```

### Opción 3: Descargar variables a archivo

```bash
# Conectarse al servicio correcto primero (interactivo)
railway service

# Luego exportar variables
railway variables --json > railway-prod-vars.json
```

---

## 🛠️ SCRIPT AUTOMATIZADO PARA ACTUALIZAR .ENV

Crea este script `update-env-from-railway.sh`:

```bash
#!/bin/bash

echo "Obteniendo variables de Railway..."

# Asegúrate de estar en el servicio correcto
railway service

# Exportar variables importantes
R2_ACCESS_KEY=$(railway variables --json | jq -r '.R2_ACCESS_KEY_ID // empty')
R2_SECRET=$(railway variables --json | jq -r '.R2_SECRET_ACCESS_KEY // empty')
JWT_SECRET=$(railway variables --json | jq -r '.JWT_SECRET // empty')
AZURE_CLIENT_ID=$(railway variables --json | jq -r '.AZURE_CLIENT_ID // empty')
AZURE_CLIENT_SECRET=$(railway variables --json | jq -r '.AZURE_CLIENT_SECRET // empty')
AZURE_TENANT_ID=$(railway variables --json | jq -r '.AZURE_TENANT_ID // empty')
SMTP_PASSWORD=$(railway variables --json | jq -r '.SMTP_PASSWORD // empty')

echo "Variables obtenidas. Actualizando .env..."

# Nota: Este script necesita ser completado con los comandos sed para actualizar .env
```

---

## ✅ CHECKLIST DE VARIABLES COMPLETADAS

- [ ] R2_ACCESS_KEY_ID
- [ ] R2_SECRET_ACCESS_KEY
- [ ] JWT_SECRET (generado nuevo, no usar el de desarrollo)
- [ ] AZURE_CLIENT_ID
- [ ] AZURE_CLIENT_SECRET
- [ ] AZURE_TENANT_ID
- [ ] AZURE_REDIRECT_URI (actualizar a producción)
- [ ] SMTP_PASSWORD
- [ ] CORS_ORIGIN (actualizar a URLs de producción)
- [ ] FRONTEND_URL (actualizar a URL de producción)
- [ ] FRONTEND_LOGIN_URL (actualizar a URL de producción)

---

## 🚨 SEGURIDAD

**IMPORTANTE:**
- ⛔ **NUNCA** commitear el archivo `.env` a git
- ⛔ **NUNCA** compartir las credenciales en mensajes o documentos
- ✅ Usar diferentes secrets para desarrollo y producción
- ✅ Rotar los secrets periódicamente (cada 90 días)
- ✅ Usar variables de entorno en Railway para producción

---

## 📞 NECESITAS AYUDA?

Si no tienes acceso a:
- **Azure AD**: Contactar al administrador de Azure de Megatlon
- **Cloudflare R2**: Contactar al administrador de Cloudflare
- **Email Office 365**: Contactar al administrador de Office 365
- **Railway**: Debes tener acceso al proyecto en Railway

---

**Fecha:** 2026-01-23
**Proyecto:** MegaSys Backend
**Entorno:** Production
