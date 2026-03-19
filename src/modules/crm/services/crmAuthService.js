// src/modules/crm/services/crmAuthService.js
/**
 * Maneja la autenticación OAuth 2.0 (client_credentials) con Azure AD
 * para acceder a la Dataverse API de Dynamics 365.
 *
 * El token se cachea en memoria y se renueva automáticamente
 * antes de que expire (con 60s de margen).
 */

import logger from '../../../shared/utils/logger.js';

const TENANT_ID = process.env.DYNAMICS_TENANT_ID;
const CLIENT_ID = process.env.DYNAMICS_CLIENT_ID;
const CLIENT_SECRET = process.env.DYNAMICS_CLIENT_SECRET;
const DYNAMICS_URL = process.env.DYNAMICS_URL; // ej: https://tuempresa.crm2.dynamics.com

// Cache en memoria del token
let _cache = {
    token: null,
    expiresAt: 0, // epoch ms
};

/**
 * Solicita un nuevo token a Azure AD usando client_credentials.
 * @returns {Promise<{accessToken: string, expiresAt: number}>}
 */
const fetchNewToken = async () => {
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !DYNAMICS_URL) {
        throw new Error(
            'Faltan variables de entorno para CRM: DYNAMICS_TENANT_ID, DYNAMICS_CLIENT_ID, DYNAMICS_CLIENT_SECRET, DYNAMICS_URL'
        );
    }

    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    const scope = `${DYNAMICS_URL}/.default`;

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope,
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error obteniendo token de Azure AD: ${response.status} ${text}`);
    }

    const data = await response.json();

    // expires_in viene en segundos; guardamos epoch ms con 60s de margen
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;

    logger.info('[CRM] Nuevo token OAuth obtenido (expira en ~' + Math.round(data.expires_in / 60) + ' min)');

    return { accessToken: data.access_token, expiresAt };
};

/**
 * Retorna un access token válido (del cache o uno nuevo).
 * @returns {Promise<string>}
 */
const getAccessToken = async () => {
    if (_cache.token && Date.now() < _cache.expiresAt) {
        return _cache.token;
    }

    const { accessToken, expiresAt } = await fetchNewToken();
    _cache = { token: accessToken, expiresAt };
    return accessToken;
};

/**
 * Fuerza la renovación del token (útil si Dataverse devuelve 401).
 */
const invalidateToken = () => {
    _cache = { token: null, expiresAt: 0 };
};

export default { getAccessToken, invalidateToken };
