// src/modules/personal/services/personalSedeService.js
const { PersonalSede, Personal, Sede, Rol, Empresa, sequelize } = require('../../../models');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class PersonalSedeService {
  /**
   * Listar asignaciones de personal a sedes
   */
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      personal_id = null,
      sede_id = null,
      rol_id = null,
      activo = true
    } = filters;

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

    if (activo !== null && activo !== undefined) {
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

    return {
      rows,
      count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    };
  }

  /**
   * Obtener asignaciones de una persona específica
   */
  async obtenerPorPersonal(personalId) {
    const persona = await Personal.findByPk(personalId);
    if (!persona) {
      throw new Error('Personal no encontrado');
    }

    const asignaciones = await PersonalSede.findAll({
      where: { personal_id: personalId },
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

    return {
      personal: {
        id: persona.id,
        nombreCompleto: `${persona.nombre} ${persona.apellido}`,
        email: persona.email
      },
      asignaciones
    };
  }

  /**
   * Obtener asignaciones de una sede específica
   */
  async obtenerPorSede(sedeId) {
    const sede = await Sede.findByPk(sedeId);
    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    const asignaciones = await PersonalSede.findAll({
      where: { sede_id: sedeId },
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

    return {
      sede: {
        id: sede.id,
        nombre_sede: sede.nombre_sede,
        localidad: sede.localidad
      },
      asignaciones
    };
  }

  /**
   * Validar que personal, sede y rol existan y estén activos
   */
  async validarAsignacionDatos(personalId, sedeId, rolId) {
    const persona = await Personal.findByPk(personalId);
    if (!persona) {
      throw new Error('Personal no encontrado');
    }

    const sede = await Sede.findOne({
      where: { id: sedeId, activo: true }
    });
    if (!sede) {
      throw new Error('Sede no encontrada o inactiva');
    }

    const rol = await Rol.findOne({
      where: { id: rolId, activo: true }
    });
    if (!rol) {
      throw new Error('Rol no encontrado o inactivo');
    }

    return { persona, sede, rol };
  }

  /**
   * Validar que no exista asignación duplicada
   */
  async validarAsignacionDuplicada(personalId, sedeId) {
    const asignacionExistente = await PersonalSede.findOne({
      where: {
        personal_id: personalId,
        sede_id: sedeId,
        activo: true
      }
    });

    if (asignacionExistente) {
      throw new Error('Este personal ya está asignado a esta sede con el rol especificado. No se pueden duplicar asignaciones activas.');
    }
  }

  /**
   * Crear nueva asignación de personal a sede
   */
  async crear(datosAsignacion, usuarioEmail) {
    const {
      personal_id,
      sede_id,
      rol_id,
      fecha_inicio,
      fecha_fin
    } = datosAsignacion;

    // Validaciones
    const { persona, sede, rol } = await this.validarAsignacionDatos(personal_id, sede_id, rol_id);
    await this.validarAsignacionDuplicada(personal_id, sede_id);

    // Crear asignación
    const asignacion = await PersonalSede.create({
      personal_id,
      sede_id,
      rol_id,
      fecha_inicio: fecha_inicio || new Date(),
      fecha_fin: fecha_fin || null,
      activo: true
    });

    // Obtener asignación completa con relaciones
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
      creadoPor: usuarioEmail
    });

    return asignacionCompleta;
  }

  /**
   * Actualizar asignación de personal a sede
   */
  async actualizar(asignacionId, datosActualizacion, usuarioEmail) {
    const asignacion = await PersonalSede.findByPk(asignacionId);
    if (!asignacion) {
      throw new Error('Asignación no encontrada');
    }

    // Si se cambia el rol, validar que existe
    if (datosActualizacion.rol_id && datosActualizacion.rol_id !== asignacion.rol_id) {
      const rol = await Rol.findOne({
        where: { id: datosActualizacion.rol_id, activo: true }
      });
      if (!rol) {
        throw new Error('Rol no encontrado o inactivo');
      }
    }

    const cambios = {};
    if (datosActualizacion.rol_id && datosActualizacion.rol_id !== asignacion.rol_id) {
      cambios.rol_id = datosActualizacion.rol_id;
    }
    if (datosActualizacion.fecha_fin !== undefined) {
      cambios.fecha_fin = datosActualizacion.fecha_fin;
    }
    if (datosActualizacion.activo !== undefined) {
      cambios.activo = datosActualizacion.activo;
    }

    await asignacion.update(cambios);

    logger.info('Asignación de personal actualizada:', {
      asignacionId: asignacion.id,
      cambios: Object.keys(cambios),
      actualizadoPor: usuarioEmail
    });

    const asignacionActualizada = await PersonalSede.findByPk(asignacionId, {
      include: [
        { model: Personal, as: 'personal' },
        { model: Sede, as: 'sede' },
        { model: Rol, as: 'rol' }
      ]
    });

    return asignacionActualizada;
  }

  /**
   * Dar de baja una asignación (soft delete)
   */
  async eliminar(asignacionId, usuarioEmail) {
    const asignacion = await PersonalSede.findByPk(asignacionId);
    if (!asignacion) {
      throw new Error('Asignación no encontrada');
    }

    await asignacion.update({
      activo: false,
      fecha_fin: new Date()
    });

    logger.info('Asignación de personal eliminada:', {
      asignacionId: asignacion.id,
      eliminadoPor: usuarioEmail
    });

    return true;
  }

  /**
   * Obtener estadísticas de asignaciones
   */
  async obtenerEstadisticas() {
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
        having: sequelize.where(sequelize.fn('COUNT', sequelize.col('sedesAsignadas.id')), Op.eq, 0),
        raw: true
      })
    };

    return estadisticas;
  }
}

module.exports = new PersonalSedeService();
