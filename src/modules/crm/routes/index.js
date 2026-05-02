// src/modules/crm/routes/index.js
import { Router } from 'express';
import crmController from '../controllers/crmController.js';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, requireLegacyAccess } from '../../auth/middleware/roleMiddleware.js';

const router = Router();

// Todas las rutas requieren autenticación y permiso de lectura en crm
router.use(authenticate);
router.use(requireLegacyAccess);
router.use(requirePermission('crm', 'read'));

// Resumen del dashboard
router.get('/resumen', crmController.obtenerResumen.bind(crmController));

// Cuentas (sedes/clientes en Dynamics)
router.get('/cuentas', crmController.listarAccounts.bind(crmController));
router.get('/cuentas/:accountId/casos', crmController.listarCasosPorSede.bind(crmController));

// Casos de soporte
router.get('/casos', crmController.listarCasos.bind(crmController));
router.get('/casos/:id', crmController.obtenerCaso.bind(crmController));

// Tareas - operaciones de escritura
router.patch('/tareas/:tareaId/completar', crmController.completarTarea.bind(crmController));
router.patch('/tareas/:tareaId/cancelar', crmController.cancelarTarea.bind(crmController));
router.post('/tareas/:tareaId/nota', crmController.agregarNotaTarea.bind(crmController));

// Vincular/desvincular sede con cuenta CRM
router.patch('/sedes/:sedeId/vincular', crmController.vincularSede.bind(crmController));
router.delete('/sedes/:sedeId/vincular', crmController.desvincularSede.bind(crmController));

export default router;
