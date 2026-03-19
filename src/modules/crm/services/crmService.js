// src/modules/crm/services/crmService.js
/**
 * Capa de acceso a la Dataverse Web API de Dynamics 365.
 * Usa OData v4 ($select, $filter, $expand, $orderby, $top, $skip).
 *
 * Documentación de referencia:
 * https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api
 */

import crmAuthService from './crmAuthService.js';
import logger from '../../../shared/utils/logger.js';

const DYNAMICS_URL = process.env.DYNAMICS_URL;
const API_VERSION = 'v9.2';

// ─── Helper: petición a Dataverse ────────────────────────────────────────────

/**
 * Ejecuta una petición GET a la Dataverse API.
 * Maneja renovación de token en caso de 401.
 * @param {string} path - Ruta relativa, ej: '/incidents?$select=title'
 * @returns {Promise<object>}
 */
const dataverseGet = async (path) => {
    const baseUrl = `${DYNAMICS_URL}/api/data/${API_VERSION}`;

    const doRequest = async () => {
        const token = await crmAuthService.getAccessToken();
        const res = await fetch(`${baseUrl}${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                Accept: 'application/json',
                Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
            },
        });

        if (res.status === 401) {
            // Token expirado: invalidar y reintentar una vez
            crmAuthService.invalidateToken();
            return null; // señal para reintentar
        }

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Dataverse API error ${res.status}: ${body}`);
        }

        return res.json();
    };

    let data = await doRequest();
    if (data === null) {
        // Reintento tras invalidar token
        data = await doRequest();
        if (data === null) throw new Error('No se pudo autenticar con Dynamics 365 (401)');
    }

    return data;
};

// ─── Mapeo de datos ───────────────────────────────────────────────────────────

/**
 * Convierte un incident de Dataverse al formato que usa la app.
 */
const mapCaso = (incident) => ({
    id: incident.incidentid,
    titulo: incident.title,
    descripcion: incident.description,
    estado: incident['statuscode@OData.Community.Display.V1.FormattedValue'] ?? incident.statuscode,
    estadoCodigo: incident.statecode, // 0=Activo, 1=Resuelto, 2=Cancelado
    statusCode: incident.statuscode,
    prioridad: incident['prioritycode@OData.Community.Display.V1.FormattedValue'] ?? incident.prioritycode,
    prioridadCodigo: incident.prioritycode,
    tipo: incident['casetypecode@OData.Community.Display.V1.FormattedValue'] ?? incident.casetypecode,
    numeroCaso: incident.ticketnumber,
    cuentaId: incident._customerid_value,
    cuentaNombre: incident['_customerid_value@OData.Community.Display.V1.FormattedValue'],
    asignadoA: incident['_ownerid_value@OData.Community.Display.V1.FormattedValue'],
    area: incident['_new_areaaescalar_value@OData.Community.Display.V1.FormattedValue'] ?? null,
    creadoEn: incident.createdon,
    modificadoEn: incident.modifiedon,
    resueltoEn: null,
    origen: incident['caseorigincode@OData.Community.Display.V1.FormattedValue'] ?? null,
});

/**
 * Convierte un account de Dataverse al formato de la app.
 */
const mapAccount = (account) => ({
    id: account.accountid,
    nombre: account.name,
    email: account.emailaddress1,
    telefono: account.telephone1,
    ciudad: account.address1_city,
    pais: account.address1_country,
});

// ─── CASOS (incidents) ────────────────────────────────────────────────────────

// GUIDs de áreas a escalar (coincide con vista "Tareas derivadas a Soporte Sedes" del CRM)
const AREA_SOPORTE_GUID = 'D55B61B9-40C9-E211-9416-000C292B51BA';       // SOPORTE
const AREA_SOPORTE_SEDES_GUID = '63CD91C9-31DA-ED11-A7C6-0022483638ED'; // SOPORTE SEDES

const INCIDENT_SELECT = [
    'incidentid', 'title', 'description', 'statecode', 'statuscode', 'prioritycode',
    'casetypecode', 'ticketnumber', '_customerid_value', '_ownerid_value',
    '_new_areaaescalar_value', 'createdon', 'modifiedon', 'caseorigincode',
].join(',');

/**
 * Lista casos con filtros opcionales y paginación.
 * @param {object} filtros - { estado, prioridad, accountId, busqueda }
 * @param {object} paginacion - { page, limit }
 */
const listarCasos = async (filtros = {}, paginacion = {}) => {
    const { estado, prioridad, accountId, busqueda } = filtros;
    const { limit = 50 } = paginacion;

    const filters = [];

    // Filtrar solo casos de Soporte y Soporte Sedes (misma lógica que vista CRM)
    filters.push(`(_new_areaaescalar_value eq '${AREA_SOPORTE_GUID}' or _new_areaaescalar_value eq '${AREA_SOPORTE_SEDES_GUID}')`);

    // statecode: 0=Active, 1=Resolved, 2=Cancelled
    if (estado === 'active') filters.push('statecode eq 0');
    if (estado === 'resolved') filters.push('statecode eq 1');
    if (estado === 'cancelled') filters.push('statecode eq 2');

    // prioritycode: 1=High, 2=Normal, 3=Low
    if (prioridad === 'high') filters.push('prioritycode eq 1');
    if (prioridad === 'normal') filters.push('prioritycode eq 2');
    if (prioridad === 'low') filters.push('prioritycode eq 3');

    if (accountId) filters.push(`_customerid_value eq '${accountId}'`);
    if (busqueda) filters.push(`contains(title,'${busqueda.replace(/'/g, "''")}')`);

    let path = `/incidents?$select=${INCIDENT_SELECT}&$orderby=createdon desc&$top=${limit}`;
    if (filters.length > 0) path += `&$filter=${filters.join(' and ')}`;

    logger.info(`[CRM] listarCasos → ${path}`);
    const data = await dataverseGet(path);


    const casos = (data.value ?? []).map(mapCaso);

    return {
        casos,
        pagination: {
            total: casos.length,
            page: 1,
            limit: Number(limit),
            totalPages: 1,
        },
    };
};

/**
 * Obtiene el detalle completo de un caso por ID.
 * @param {string} incidentId - GUID del incident
 */
const obtenerCaso = async (incidentId) => {
    const path = `/incidents(${incidentId})?$select=${INCIDENT_SELECT}`;
    logger.info(`[CRM] obtenerCaso → ${incidentId}`);
    const data = await dataverseGet(path);
    return mapCaso(data);
};

/**
 * Lista los casos de una account/sede específica.
 */
const listarCasosPorSede = async (accountId, filtros = {}, paginacion = {}) => {
    return listarCasos({ ...filtros, accountId }, paginacion);
};

/**
 * Resumen de casos por estado y prioridad (para dashboard).
 */
const obtenerResumen = async () => {
    logger.info('[CRM] obtenerResumen');

    // Traemos hasta 500 por estado para contar
    const [activos, resueltos, cancelados] = await Promise.all([
        dataverseGet('/incidents?$filter=statuscode eq 1&$top=500&$select=incidentid'),
        dataverseGet('/incidents?$filter=statuscode eq 2&$top=500&$select=incidentid'),
        dataverseGet('/incidents?$filter=statuscode eq 3&$top=500&$select=incidentid'),
    ]);

    const activosList = activos.value ?? [];
    const [alta, normal, baja] = await Promise.all([
        dataverseGet('/incidents?$filter=statuscode eq 1 and prioritycode eq 1&$top=500&$select=incidentid'),
        dataverseGet('/incidents?$filter=statuscode eq 1 and prioritycode eq 2&$top=500&$select=incidentid'),
        dataverseGet('/incidents?$filter=statuscode eq 1 and prioritycode eq 3&$top=500&$select=incidentid'),
    ]);

    return {
        porEstado: {
            activos: activosList.length,
            resueltos: (resueltos.value ?? []).length,
            cancelados: (cancelados.value ?? []).length,
        },
        activosPorPrioridad: {
            alta: (alta.value ?? []).length,
            normal: (normal.value ?? []).length,
            baja: (baja.value ?? []).length,
        },
    };
};

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────

const ACCOUNT_SELECT = ['accountid', 'name', 'emailaddress1', 'telephone1', 'address1_city', 'address1_country'].join(',');

/**
 * Lista accounts (sedes/clientes) del CRM.
 * @param {string} query - Texto para buscar por nombre
 */
const listarAccounts = async (query = '') => {
    let path = `/accounts?$select=${ACCOUNT_SELECT}&$orderby=name asc&$top=100`;
    if (query) path += `&$filter=contains(name,'${query.replace(/'/g, "''")}')`;

    logger.info('[CRM] listarAccounts');
    const data = await dataverseGet(path);
    return (data.value ?? []).map(mapAccount);
};

export default {
    listarCasos,
    obtenerCaso,
    listarCasosPorSede,
    obtenerResumen,
    listarAccounts,
};
