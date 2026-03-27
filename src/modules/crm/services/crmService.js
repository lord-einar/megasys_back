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

/**
 * Ejecuta una petición PATCH a la Dataverse API.
 * @param {string} path - Ruta relativa, ej: '/tasks(guid)'
 * @param {object} body - Datos a enviar
 * @returns {Promise<void>}
 */
const dataversePatch = async (path, body) => {
    const baseUrl = `${DYNAMICS_URL}/api/data/${API_VERSION}`;

    const doRequest = async () => {
        const token = await crmAuthService.getAccessToken();
        const res = await fetch(`${baseUrl}${path}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Content-Type': 'application/json',
                'If-Match': '*',
            },
            body: JSON.stringify(body),
        });

        if (res.status === 401) {
            crmAuthService.invalidateToken();
            return null;
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Dataverse API error ${res.status}: ${text}`);
        }

        return true;
    };

    let result = await doRequest();
    if (result === null) {
        result = await doRequest();
        if (result === null) throw new Error('No se pudo autenticar con Dynamics 365 (401)');
    }
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
    estadoCierre: incident['new_estadodecierre@OData.Community.Display.V1.FormattedValue'] ?? incident.new_estadodecierre ?? null,
    estadoCierreCodigo: incident.new_estadodecierre,
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
    'new_estadodecierre',
].join(',');

/**
 * Lista casos con filtros opcionales y paginación.
 * @param {object} filtros - { estado, prioridad, accountId, busqueda }
 * @param {object} paginacion - { page, limit }
 */
const listarCasos = async (filtros = {}, paginacion = {}) => {
    const { estado, prioridad, accountId, busqueda, diasMinimos } = filtros;
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

    // Filtro por antigüedad mínima (casos creados hace más de X días)
    if (diasMinimos && Number(diasMinimos) > 0) {
        const fecha = new Date(Date.now() - Number(diasMinimos) * 24 * 60 * 60 * 1000);
        const fechaISO = fecha.toISOString().split('T')[0];
        filters.push(`createdon le ${fechaISO}`);
    }

    if (accountId) filters.push(`_customerid_value eq '${accountId}'`);
    if (busqueda) {
        const escaped = busqueda.replace(/'/g, "''");
        // Si parece un número de ticket (CAS-XXXXXX-...), buscar por ticketnumber exacto
        if (/^CAS-/i.test(busqueda)) {
            filters.push(`ticketnumber eq '${escaped}'`);
        } else {
            filters.push(`contains(title,'${escaped}')`);
        }
    }

    // Si se pide solo casos con tareas abiertas, usamos enfoque diferente
    if (filtros.soloConTareasAbiertas === 'true') {
        return listarCasosConTareasAbiertas(filters, limit);
    }

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
 * Obtiene el detalle completo de un caso por ID, incluyendo sus tareas.
 * @param {string} incidentId - GUID del incident
 */
const obtenerCaso = async (incidentId) => {
    const path = `/incidents(${incidentId})?$select=${INCIDENT_SELECT}`;
    logger.info(`[CRM] obtenerCaso → ${incidentId}`);
    const data = await dataverseGet(path);
    const caso = mapCaso(data);

    // Obtener tareas asociadas al caso
    try {
        caso.tareas = await listarTareasPorCaso(incidentId);
    } catch (err) {
        logger.warn(`[CRM] No se pudieron cargar tareas del caso ${incidentId}:`, err.message);
        caso.tareas = [];
    }

    return caso;
};

// ─── TAREAS (tasks) ──────────────────────────────────────────────────────────

const TASK_SELECT = [
    'activityid', 'subject', 'description', 'statecode', 'statuscode',
    'scheduledend', 'createdon', 'modifiedon',
    '_ownerid_value', '_regardingobjectid_value',
].join(',');

/**
 * Convierte una task de Dataverse al formato de la app.
 */
const mapTarea = (task) => ({
    id: task.activityid,
    asunto: task.subject,
    descripcion: task.description,
    estadoCodigo: task.statecode, // 0=Abierta, 1=Completada, 2=Cancelada
    estado: task['statecode@OData.Community.Display.V1.FormattedValue'] ?? task.statecode,
    statusCode: task.statuscode,
    statusLabel: task['statuscode@OData.Community.Display.V1.FormattedValue'] ?? task.statuscode,
    vencimiento: task.scheduledend,
    creadoEn: task.createdon,
    modificadoEn: task.modifiedon,
    asignadoA: task['_ownerid_value@OData.Community.Display.V1.FormattedValue'],
    asignadoAId: task._ownerid_value,
});

/**
 * Lista las tareas asociadas a un caso (incident).
 * @param {string} incidentId - GUID del incident
 */
const listarTareasPorCaso = async (incidentId) => {
    const path = `/tasks?$select=${TASK_SELECT}&$filter=_regardingobjectid_value eq '${incidentId}'&$orderby=createdon desc&$top=50`;
    logger.info(`[CRM] listarTareasPorCaso → ${incidentId}`);
    const data = await dataverseGet(path);
    return (data.value ?? []).map(mapTarea);
};

/**
 * Lista casos que tienen al menos una tarea abierta (statecode=0).
 * Trae todos los casos y luego filtra los que tienen tareas abiertas.
 */
const listarCasosConTareasAbiertas = async (incidentFilters, limit) => {
    // 1. Traer los casos normalmente
    let path = `/incidents?$select=${INCIDENT_SELECT}&$orderby=createdon desc&$top=${limit}`;
    if (incidentFilters.length > 0) path += `&$filter=${incidentFilters.join(' and ')}`;

    logger.info(`[CRM] listarCasosConTareasAbiertas`);
    const data = await dataverseGet(path);
    const todosCasos = (data.value ?? []).map(mapCaso);

    if (todosCasos.length === 0) {
        return { casos: [], pagination: { total: 0, page: 1, limit: Number(limit), totalPages: 1 } };
    }

    // 2. Traer tareas abiertas de esos casos (en lotes para no exceder URL)
    const casoIds = todosCasos.map(c => c.id);
    const tareasAbiertas = new Set();

    // Procesar en lotes de 15 IDs
    for (let i = 0; i < casoIds.length; i += 15) {
        const lote = casoIds.slice(i, i + 15);
        const idFilter = lote.map(id => `_regardingobjectid_value eq '${id}'`).join(' or ');
        const taskPath = `/tasks?$select=activityid,_regardingobjectid_value&$filter=statecode eq 0 and (${idFilter})&$top=500`;
        const taskData = await dataverseGet(taskPath);
        (taskData.value ?? []).forEach(t => tareasAbiertas.add(t._regardingobjectid_value));
    }

    // 3. Filtrar solo casos que tienen tareas abiertas
    const casos = todosCasos.filter(c => tareasAbiertas.has(c.id));

    return {
        casos,
        pagination: { total: casos.length, page: 1, limit: Number(limit), totalPages: 1 },
    };
};

/**
 * DEBUG: Busca tareas de un caso probando distintas formas.
 */
const debugTareasPorCaso = async (incidentId) => {
    // 1. Buscar tareas con regardingobjectid
    const path1 = `/tasks?$select=activityid,subject,_regardingobjectid_value&$filter=_regardingobjectid_value eq '${incidentId}'&$top=5`;
    const r1 = await dataverseGet(path1);

    // 2. Buscar CUALQUIER tarea reciente para ver la estructura
    const path2 = `/tasks?$select=activityid,subject,_regardingobjectid_value&$top=3&$orderby=createdon desc`;
    const r2 = await dataverseGet(path2);

    // 3. Buscar actividades del caso vía navigation property
    let r3 = null;
    try {
        const path3 = `/incidents(${incidentId})/Incident_Tasks?$select=activityid,subject&$top=5`;
        r3 = await dataverseGet(path3);
    } catch (e) {
        r3 = { error: e.message };
    }

    return {
        filtroRegarding: { count: (r1.value ?? []).length, data: r1.value ?? [] },
        tareasRecientes: { count: (r2.value ?? []).length, data: r2.value ?? [] },
        navigationProperty: r3?.value ?? r3,
    };
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

// ─── OPERACIONES DE ESCRITURA ────────────────────────────────────────────────

/**
 * Ejecuta una petición POST a la Dataverse API.
 * @param {string} path - Ruta relativa, ej: '/annotations'
 * @param {object} body - Datos a enviar
 * @returns {Promise<object|null>} Respuesta parseada o null si 204
 */
const dataversePost = async (path, body) => {
    const baseUrl = `${DYNAMICS_URL}/api/data/${API_VERSION}`;

    const doRequest = async () => {
        const token = await crmAuthService.getAccessToken();
        const res = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (res.status === 401) {
            crmAuthService.invalidateToken();
            return null;
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Dataverse API error ${res.status}: ${text}`);
        }

        if (res.status === 204) return {};
        return res.json();
    };

    let result = await doRequest();
    if (result === null) {
        result = await doRequest();
        if (result === null) throw new Error('No se pudo autenticar con Dynamics 365 (401)');
    }
    return result;
};

/**
 * Completa una tarea en Dynamics 365 (statecode=1, statuscode=5).
 * @param {string} tareaId - GUID de la tarea (activityid)
 * @returns {Promise<void>}
 */
const completarTarea = async (tareaId) => {
    logger.info(`[CRM] completarTarea → ${tareaId}`);
    await dataversePatch(`/tasks(${tareaId})`, {
        statecode: 1,   // Completed
        statuscode: 5,  // Completed
    });
};

/**
 * Cancela una tarea en Dynamics 365 (statecode=2, statuscode=6).
 * @param {string} tareaId - GUID de la tarea (activityid)
 * @returns {Promise<void>}
 */
const cancelarTarea = async (tareaId) => {
    logger.info(`[CRM] cancelarTarea → ${tareaId}`);
    await dataversePatch(`/tasks(${tareaId})`, {
        statecode: 2,   // Cancelled
        statuscode: 6,  // Cancelled
    });
};

/**
 * Agrega una nota (annotation) a una tarea en Dynamics 365.
 * @param {string} tareaId - GUID de la tarea (activityid)
 * @param {string} texto - Texto de la nota
 * @param {string} [asunto] - Asunto de la nota
 * @returns {Promise<void>}
 */
const agregarNotaTarea = async (tareaId, texto, asunto = 'Observación - MegaSys') => {
    logger.info(`[CRM] agregarNotaTarea → ${tareaId}: ${asunto}`);
    await dataversePost('/annotations', {
        subject: asunto,
        notetext: texto,
        'objectid_task@odata.bind': `/tasks(${tareaId})`,
    });
};

export default {
    listarCasos,
    obtenerCaso,
    listarCasosPorSede,
    obtenerResumen,
    listarAccounts,
    completarTarea,
    cancelarTarea,
    agregarNotaTarea,
    debugTareasPorCaso,
};
