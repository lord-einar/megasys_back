import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../../auth/middleware/authMiddleware.js';
import { requirePermission, enrichUserWithRole } from '../../auth/middleware/roleMiddleware.js';
import validate from '../../../shared/middleware/validation.js';
import categoriaEquipoController from '../controllers/categoriaEquipoController.js';
import { CATEGORIA_TIPOS, TIPO_EQUIPO_TO_CATEGORIA_TIPO } from '../../../shared/constants/tipoEquipo.js';

// Al listar se admiten también los tipo_equipo de la solicitud ('pc_escritorio'),
// que el servicio normaliza. Crear/editar sólo aceptan los tipos de la categoría.
const TIPOS_FILTRO = [...new Set([...CATEGORIA_TIPOS, ...Object.keys(TIPO_EQUIPO_TO_CATEGORIA_TIPO)])];

const router = express.Router();

router.use(authenticate);
router.use(enrichUserWithRole);

const validarId = [param('id').isUUID().withMessage('ID debe ser un UUID válido')];

const validarCrear = [
  body('nombre').trim().isLength({ min: 1, max: 80 }).withMessage('nombre es requerido (1-80 caracteres)'),
  body('descripcion').optional({ nullable: true }).isString(),
  body('tipo').isIn(CATEGORIA_TIPOS).withMessage('tipo debe ser notebook, celular, pc o ambos')
];

const validarActualizar = [
  body('nombre').optional().trim().isLength({ min: 1, max: 80 }),
  body('descripcion').optional({ nullable: true }).isString(),
  body('tipo').optional().isIn(CATEGORIA_TIPOS),
  body('activo').optional().isBoolean()
];

router.get('/',
  requirePermission('solicitudes_asignacion', 'read'),
  [
    query('tipo').optional().isIn(TIPOS_FILTRO),
    query('activo').optional().isBoolean()
  ],
  validate,
  categoriaEquipoController.listar
);

router.get('/:id',
  requirePermission('solicitudes_asignacion', 'read'),
  validarId, validate,
  categoriaEquipoController.obtener
);

router.post('/',
  requirePermission('catalogo_equipos', 'create'),
  validarCrear, validate,
  categoriaEquipoController.crear
);

router.put('/:id',
  requirePermission('catalogo_equipos', 'update'),
  [...validarId, ...validarActualizar], validate,
  categoriaEquipoController.actualizar
);

router.delete('/:id',
  requirePermission('catalogo_equipos', 'delete'),
  validarId, validate,
  categoriaEquipoController.eliminar
);

export default router;
