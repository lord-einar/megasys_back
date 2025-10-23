// src/modules/personal/controllers/personalSedeController.js
const { PersonalSede, Personal, Sede, Rol, Empresa, sequelize } = require('../../../models');
const { success, error, paginated } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class PersonalSedeController {
  /**
   * Listar asignaciones de personal a sedes
   */
  listar = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      personal_id = null,
      sede_id = null,
      rol_id = null,
      activo = true
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (personal_id) {
      whereClause.personal_id = personal_id;
    }

    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    if (rol_id) {
      whereClause.rol_id = rol_id;
    }

    if (activo !== null) {
      whereClause.activo = activo === 'true' || activo === true;
    }

    const { count, rows } = await PersonalSede.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['fecha_inicio', 'DESC']],
      include: [
        {
          model: Personal,
          as: 'personal',
          attributes: ['id', 'nombre', 'apellido', 'email']
        },
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia'],
          include: [
            {
              model: Empresa,
              as: 'empresa',
              attributes: ['id', 'nombre']
            }
          ]
        },
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre']
        }
      ]
    });

    paginated(res, rows, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count
    }, 'Asignaciones de personal obtenidas correctamente');
  });

  /**
   * Obtener asignaciones de una persona específica
   */
  obtenerPorPersonal = asyncHandler(async (req, res) => {
    const { personal_id } = req.params;

    const persona = await Personal.findByPk(personal_id);
    if (!persona) {
      return error(res, 'Personal no encontrado', 404);
    }

    const asignaciones = await PersonalSede.findAll({
      where: { personal_id },
      include: [
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede', 'direccion', 'localidad', 'provincia'],
          include: [
            {
              model: Empresa,
              as: 'empresa',
              attributes: ['id', 'nombre']
            }
          ]
        },
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre', 'descripcion']
        }
      ],
      order: [['fecha_inicio', 'DESC']]
    });

    success(res, {
      personal: {
        id: persona.id,
        nombreCompleto: `${persona.nombre} ${persona.apellido}`,
        email: persona.email
      },
      asignaciones
    }, 'Asignaciones del personal obtenidas correctamente');
  });

  /**
   * Obtener asignaciones de una sede específica
   */
  obtenerPorSede = asyncHandler(async (req, res) => {
    const { sede_id } = req.params;

    const sede = await Sede.findByPk(sede_id);
    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    const asignaciones = await PersonalSede.findAll({
      where: { sede_id },
      include: [
        {
          model: Personal,
          as: 'personal',
          attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
        },
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre', 'descripcion']
        }
      ],
      order: [['fecha_inicio', 'DESC']]
    });

    success(res, {
      sede: {
        id: sede.id,
        nombre_sede: sede.nombre_sede,
        localidad: sede.localidad
      },
      asignaciones
    }, 'Personal de la sede obtenido correctamente');
  });

  /**
   * Crear nueva asignación de personal a sede
   */
  crear = asyncHandler(async (req, res) => {
    const {
      personal_id,
      sede_id,
      rol_id,
      fecha_inicio,
      fecha_fin
    } = req.body;

    // Validar que exista el personal
    const persona = await Personal.findByPk(personal_id);
    if (!persona) {
      return error(res, 'Personal no encontrado', 404);
    }

    // Validar que exista la sede
    const sede = await Sede.findOne({
      where: { id: sede_id, activo: true }
    });
    if (!sede) {
      return error(res, 'Sede no encontrada o inactiva', 404);
    }

    // Validar que exista el rol
    const rol = await Rol.findOne({
      where: { id: rol_id, activo: true }
    });
    if (!rol) {
      return error(res, 'Rol no encontrado o inactivo', 404);
    }

    // Verificar que no exista una asignación activa con los mismos datos
    const asignacionExistente = await PersonalSede.findOne({
      where: {
        personal_id,
        sede_id,
        activo: true
      }
    });

    if (asignacionExistente) {
      return error(res, 'El personal ya está asignado a esta sede', 409);
    }

    // Crear la asignación
    const asignacion = await PersonalSede.create({
      personal_id,
      sede_id,
      rol_id,
      fecha_inicio: fecha_inicio || new Date(),
      fecha_fin: fecha_fin || null,
      activo: true
    });

    // Obtener la asignación creada con sus relaciones
    const asignacionCompleta = await PersonalSede.findByPk(asignacion.id, {
      include: [
        { model: Personal, as: 'personal' },
        { model: Sede, as: 'sede' },
        { model: Rol, as: 'rol' }
      ]
    });

    logger.info('Nueva asignación de personal creada:', {
      asignacionId: asignacion.id,
      personal: `${persona.nombre} ${persona.apellido}`,
      sede: sede.nombre_sede,
      rol: rol.nombre,
      creadoPor: req.user.email
    });

    success(res, asignacionCompleta, 'Asignación de personal creada correctamente', 201);
  });

  /**
   * Actualizar asignación de personal a sede
   */
  actualizar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rol_id, fecha_fin, activo } = req.body;

    const asignacion = await PersonalSede.findByPk(id);
    if (!asignacion) {
      return error(res, 'Asignación no encontrada', 404);
    }

    // Si se cambia el rol, verificar que existe
    if (rol_id && rol_id !== asignacion.rol_id) {
      const rol = await Rol.findOne({
        where: { id: rol_id, activo: true }
      });
      if (!rol) {
        return error(res, 'Rol no encontrado o inactivo', 404);
      }
    }

    const cambios = {};
    if (rol_id && rol_id !== asignacion.rol_id) cambios.rol_id = rol_id;
    if (fecha_fin !== undefined) cambios.fecha_fin = fecha_fin;
    if (activo !== undefined) cambios.activo = activo;

    await asignacion.update(cambios);

    logger.info('Asignación de personal actualizada:', {
      asignacionId: asignacion.id,
      cambios: Object.keys(cambios),
      actualizadoPor: req.user.email
    });

    const asignacionActualizada = await PersonalSede.findByPk(id, {
      include: [
        { model: Personal, as: 'personal' },
        { model: Sede, as: 'sede' },
        { model: Rol, as: 'rol' }
      ]
    });

    success(res, asignacionActualizada, 'Asignación actualizada correctamente');
  });

  /**
   * Dar de baja una asignación (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const asignacion = await PersonalSede.findByPk(id);
    if (!asignacion) {
      return error(res, 'Asignación no encontrada', 404);
    }

    await asignacion.update({
      activo: false,
      fecha_fin: new Date()
    });

    logger.info('Asignación de personal eliminada:', {
      asignacionId: asignacion.id,
      eliminadoPor: req.user.email
    });

    success(res, null, 'Asignación eliminada correctamente');
  });

  /**
   * Obtener estadísticas de asignaciones
   */
  obtenerEstadisticas = asyncHandler(async (req, res) => {
    const estadisticas = {
      totalAsignaciones: await PersonalSede.count({ where: { activo: true } }),
      asignacionesPorSede: await sequelize.query(`
        SELECT
          s.id,
          s.nombre_sede,
          COUNT(ps.id) as total_personal
        FROM sedes s
        LEFT JOIN personal_sedes ps ON s.id = ps.sede_id AND ps.activo = true
        WHERE s.activo = true
        GROUP BY s.id, s.nombre_sede
        ORDER BY total_personal DESC
        LIMIT 10
      `, { type: sequelize.QueryTypes.SELECT }),
      asignacionesPorRol: await sequelize.query(`
        SELECT
          r.id,
          r.nombre,
          COUNT(ps.id) as total_personal
        FROM roles r
        LEFT JOIN personal_sedes ps ON r.id = ps.rol_id AND ps.activo = true
        GROUP BY r.id, r.nombre
        ORDER BY total_personal DESC
      `, { type: sequelize.QueryTypes.SELECT }),
      personalSinAsignaciones: await Personal.count({
        where: {
          activo: true
        },
        include: [{
          model: PersonalSede,
          as: 'sedesAsignadas',
          where: { activo: true },
          required: false
        }],
        group: ['Personal.id'],
        having: sequelize.where(sequelize.fn('COUNT', sequelize.col('sedesAsignadas.id')), Op.eq, 0)
      })
    };

    success(res, estadisticas, 'Estadísticas de asignaciones obtenidas correctamente');
  });
}

module.exports = new PersonalSedeController();
