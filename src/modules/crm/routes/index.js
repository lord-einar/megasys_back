// src/modules/crm/routes/index.js
import { Router } from 'express';
import crmController from '../controllers/crmController.js';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, requireLegacyAccess } from '../../auth/middleware/roleMiddleware.js';
import { error } from '../../../shared/utils/response.js';

const router = Router();

// Todas las rutas requieren autenticación y permiso de lectura en crm
router.use(authenticate);
router.use(requireLegacyAccess);
router.use(requirePermission('crm', 'read'));

// Los IDs se insertan en rutas y filtros OData de Dynamics: solo se aceptan GUID
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
for (const param of ['id', 'tareaId', 'accountId', 'sedeId']) {
    router.param(param, (req, res, next, valor) => (
        GUID.test(valor) ? next() : error(res, `${param} inválido`, 400)
    ));
}

// Las escrituras (en Dynamics o en el vínculo de sedes) requieren crm.write
const escritura = requirePermission('crm', 'write');

// Resumen del dashboard
router.get('/resumen', crmController.obtenerResumen.bind(crmController));

// Cuentas (sedes/clientes en Dynamics)
router.get('/cuentas', crmController.listarAccounts.bind(crmController));
router.get('/cuentas/:accountId/casos', crmController.listarCasosPorSede.bind(crmController));

// Casos de soporte
router.get('/casos', crmController.listarCasos.bind(crmController));
router.get('/casos/:id', crmController.obtenerCaso.bind(crmController));

// Tareas - operaciones de escritura
router.patch('/tareas/:tareaId/completar', escritura, crmController.completarTarea.bind(crmController));
router.patch('/tareas/:tareaId/cancelar', escritura, crmController.cancelarTarea.bind(crmController));
router.post('/tareas/:tareaId/nota', escritura, crmController.agregarNotaTarea.bind(crmController));
router.post('/tareas/:tareaId/resolver', escritura, crmController.resolverTarea.bind(crmController));

// Vincular/desvincular sede con cuenta CRM
router.patch('/sedes/:sedeId/vincular', escritura, crmController.vincularSede.bind(crmController));
router.delete('/sedes/:sedeId/vincular', escritura, crmController.desvincularSede.bind(crmController));

export default router;
