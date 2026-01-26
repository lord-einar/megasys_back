# Guía de Cambio de Dominio del Frontend

## Situación Actual
- **Frontend actual**: https://megasys-front.vercel.app
- **Frontend nuevo**: https://portalit.grupomegatlon.com.ar
- **Backend**: https://independent-perfection-production-bbe2.up.railway.app

---

## CAMBIOS NECESARIOS

### 1. VERCEL (Configurar dominio personalizado)

**Pasos:**
1. Ir a https://vercel.com/dashboard
2. Seleccionar el proyecto `megasys-front`
3. Ir a `Settings` → `Domains`
4. Click en `Add Domain`
5. Ingresar: `portalit.grupomegatlon.com.ar`
6. Vercel te mostrará los registros DNS necesarios

**Registros DNS a configurar en tu proveedor de dominio:**

```
Opción 1 - Registro A (recomendado):
Tipo: A
Nombre: portalit
Valor: 76.76.21.21

Opción 2 - Registro CNAME:
Tipo: CNAME
Nombre: portalit
Valor: cname.vercel-dns.com
```

**IMPORTANTE:** Mantén el dominio `megasys-front.vercel.app` activo hasta verificar que el nuevo funciona.

---

### 2. RAILWAY (Actualizar variables de entorno del backend)

**Ir a:** Railway Dashboard → Proyecto `adequate-elegance` → Backend Service → Variables

**Variables a actualizar:**

```bash
# 1. CORS - Permitir AMBOS dominios temporalmente
CORS_ORIGIN=https://megasys-front.vercel.app,https://portalit.grupomegatlon.com.ar

# 2. Frontend URL (para links en emails)
FRONTEND_URL=https://portalit.grupomegatlon.com.ar

# 3. Frontend Login URL (para redirects)
FRONTEND_LOGIN_URL=https://portalit.grupomegatlon.com.ar/login

# 4. Azure AD Redirect URI (si usas auth de Microsoft)
AZURE_REDIRECT_URI=https://independent-perfection-production-bbe2.up.railway.app/auth/callback
```

**Después del cambio:** Railway reiniciará automáticamente el backend.

---

### 3. AZURE AD (Actualizar URIs de redirección)

**Pasos:**
1. Ir a https://portal.azure.com
2. Azure Active Directory → App registrations
3. Seleccionar tu aplicación de MegaSys
4. Click en `Authentication`
5. En `Redirect URIs`, agregar:
   - `https://portalit.grupomegatlon.com.ar/auth/callback`
6. Click `Save`

**IMPORTANTE:** Mantén el redirect URI actual hasta confirmar que el nuevo funciona.

---

### 4. FRONTEND (Verificar configuración)

**Archivo:** `megasys_front/.env.prod`

**Verificar que tenga:**
```bash
VITE_BACKEND_HOST=independent-perfection-production-bbe2.up.railway.app
```

Si no está configurado así, actualizar y hacer deploy en Vercel.

---

## PLAN DE MIGRACIÓN (SIN DOWNTIME)

### Fase 1: Preparación (15 minutos)
1. ✅ Configurar dominio en Vercel
2. ✅ Configurar DNS
3. ✅ Actualizar CORS en Railway para incluir AMBOS dominios
4. ✅ Actualizar Azure AD para incluir AMBOS redirect URIs
5. ⏳ Esperar propagación DNS (5-30 minutos)

### Fase 2: Pruebas (10 minutos)
1. ✅ Acceder a `https://portalit.grupomegatlon.com.ar`
2. ✅ Verificar que carga correctamente
3. ✅ Probar login de Azure AD
4. ✅ Verificar que las llamadas API funcionan
5. ✅ Probar funcionalidades críticas

### Fase 3: Activación (5 minutos)
1. ✅ Actualizar `FRONTEND_URL` y `FRONTEND_LOGIN_URL` en Railway al nuevo dominio
2. ✅ Comunicar el cambio a usuarios

### Fase 4: Limpieza (Después de 1 semana)
1. ✅ Remover dominio antiguo de `CORS_ORIGIN` en Railway
2. ✅ Remover redirect URI antiguo de Azure AD (opcional)
3. ✅ Mantener `megasys-front.vercel.app` como backup

---

## COMANDOS ÚTILES

### Verificar backend desde nuevo dominio:
```bash
curl https://independent-perfection-production-bbe2.up.railway.app/health
```

### Verificar CORS:
```bash
curl -H "Origin: https://portalit.grupomegatlon.com.ar" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://independent-perfection-production-bbe2.up.railway.app/api/auth/login
```

---

## ROLLBACK (Si algo falla)

1. En Vercel: Remover el dominio personalizado
2. En Railway: Restaurar variables antiguas:
   ```bash
   CORS_ORIGIN=https://megasys-front.vercel.app
   FRONTEND_URL=https://megasys-front.vercel.app
   FRONTEND_LOGIN_URL=https://megasys-front.vercel.app/login
   ```
3. El sistema volverá a funcionar con el dominio original

---

## VERIFICACIÓN POST-CAMBIO

✅ **Checklist:**
- [ ] `https://portalit.grupomegatlon.com.ar` carga correctamente
- [ ] Login de Azure AD funciona
- [ ] APIs responden correctamente
- [ ] No hay errores de CORS en la consola del navegador
- [ ] Emails enviados tienen el link correcto
- [ ] Redirects funcionan correctamente

---

## CONTACTOS DE SOPORTE

- **Vercel Support**: https://vercel.com/support
- **Railway Support**: https://railway.app/help
- **DNS Provider**: Contactar a tu proveedor de dominio

---

**Fecha de creación:** 2026-01-19
**Última actualización:** 2026-01-19
