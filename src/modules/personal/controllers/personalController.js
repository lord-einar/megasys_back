// src/modules/personal/controllers/personalController.js
const { Personal, Sede, Rol, Remito, sequelize } = require('../../../models');
const { success, error, paginated } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class PersonalController {
  /**
   * Listar todo el personal con paginación y filtros
   */
  listar = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      sede_id = null,
      rol_id = null,
      activo = null 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filtro de búsqueda
    if (search) {
      whereClause[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { apellido: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Filtros específicos
    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    if (rol_id) {
      whereClause.rol_id = rol_id;
    }

    if (activo !== null) {
      whereClause.activo = activo === 'true';
    }

    const { count, rows } = await Personal.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['apellido', 'ASC'], ['nombre', 'ASC']],
      include: [
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
        },
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia']
        }
      ]
    });

    // Agregar estadísticas a cada persona
    const personalConEstadisticas = await Promise.all(
      rows.map(async (persona) => {
        const personaJson = persona.toJSON();
        
        // Contar remitos solicitados
        const remitosSolicitados = await Remito.count({
          where: { 
            solicitante_id: persona.id,
            estado: ['preparado', 'en_transito', 'entregado']
          }
        });
        
        // Contar remitos asignados como técnico
        const remitosAsignados = await Remito.count({
          where: { 
            tecnico_asignado_id: persona.id,
            estado: ['en_transito', 'entregado']
          }
        });

        return {
          ...personaJson,
          estadisticas: {
            remitosSolicitados,
            remitosAsignados
          }
        };
      })
    );

    paginated(res, personalConEstadisticas, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count
    }, 'Personal obtenido correctamente');
  });

  /**
   * Obtener una persona específica con detalles completos
   */
  obtener = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const persona = await Personal.findByPk(id, {
      include: [
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede', 'direccion', 'localidad', 'provincia']
        },
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia']
        },
        {
          model: Remito,
          as: 'remitosSolicitados',
          attributes: ['id', 'numero_remito', 'fecha', 'estado'],
          include: [
            {
              model: Sede,
              as: 'sedeOrigen',
              attributes: ['id', 'nombre_sede']
            },
            {
              model: Sede,
              as: 'sedeDestino',
              attributes: ['id', 'nombre_sede']
            }
          ],
          limit: 10,
          order: [['fecha', 'DESC']]
        },
        {
          model: Remito,
          as: 'remitosAsignados',
          attributes: ['id', 'numero_remito', 'fecha', 'estado'],
          include: [
            {
              model: Sede,
              as: 'sedeOrigen',
              attributes: ['id', 'nombre_sede']
            },
            {
              model: Sede,
              as: 'sedeDestino',
              attributes: ['id', 'nombre_sede']
            }
          ],
          limit: 10,
          order: [['fecha', 'DESC']]
        }
      ]
    });

    if (!persona) {
      return error(res, 'Persona no encontrada', 404);
    }

    // Estadísticas detalladas
    const estadisticas = {
      remitos: {
        solicitados: {
          total: await Remito.count({ where: { solicitante_id: id } }),
          pendientes: await Remito.count({ 
            where: { 
              solicitante_id: id, 
              estado: ['preparado', 'en_transito', 'entregado'] 
            } 
          }),
          confirmados: await Remito.count({ 
            where: { 
              solicitante_id: id, 
              estado: 'confirmado' 
            } 
          })
        },
        asignados: {
          total: await Remito.count({ where: { tecnico_asignado_id: id } }),
          enProceso: await Remito.count({ 
            where: { 
              tecnico_asignado_id: id, 
              estado: ['en_transito', 'entregado'] 
            } 
          }),
          completados: await Remito.count({ 
            where: { 
              tecnico_asignado_id: id, 
              estado: 'confirmado' 
            } 
          })
        }
      }
    };

    const personaCompleta = {
      ...persona.toJSON(),
      estadisticas
    };

    success(res, personaCompleta, 'Persona obtenida correctamente');
  });

  /**
   * Crear nueva persona
   */
  crear = asyncHandler(async (req, res) => {
    const {
      nombre,
      apellido,
      email,
      telefono,
      sedes,
      rol_id,
      fecha_ingreso
    } = req.body;

    // Verificar si el email ya existe
    const emailExistente = await Personal.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (emailExistente) {
      return error(res, 'Este email ya está registrado', 409);
    }

    // Verificar que todas las sedes existen y están activas
    const sedesValidas = await Sede.findAll({
      where: {
        id: sedes,
        activo: true
      }
    });

    if (sedesValidas.length === 0) {
      return error(res, 'Ninguna de las sedes especificadas fue encontrada o está activa', 404);
    }

    if (sedesValidas.length !== sedes.length) {
      return error(res, 'Una o más sedes no fueron encontradas o están inactivas', 404);
    }

    // Verificar que el rol existe y está activo
    const rol = await Rol.findOne({
      where: { id: rol_id, activo: true }
    });

    if (!rol) {
      return error(res, 'Rol no encontrado o inactivo', 404);
    }

    // Usar la primera sede como sede principal
    const sede_id_principal = sedes[0];

    const nuevaPersona = await Personal.create({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.toLowerCase().trim(),
      telefono: telefono?.trim() || null,
      sede_id: sede_id_principal,
      rol_id,
      fecha_ingreso: fecha_ingreso || new Date()
    });

    // Obtener la persona creada con sus relaciones
    const personaCompleta = await Personal.findByPk(nuevaPersona.id, {
      include: ['sede', 'rol']
    });

    logger.info('Nueva persona creada:', {
      personalId: nuevaPersona.id,
      nombre: nuevaPersona.getNombreCompleto(),
      email: nuevaPersona.email,
      sedesPrincipal: sedesValidas[0].nombre_sede,
      sedesAsignadas: sedesValidas.length,
      rol: rol.nombre,
      creadoPor: req.user.email
    });

    success(res, personaCompleta, 'Persona creada correctamente', 201);
  });

  /**
   * Actualizar persona existente
   */
  actualizar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const datosActualizacion = req.body;

    const persona = await Personal.findByPk(id);

    if (!persona) {
      return error(res, 'Persona no encontrada', 404);
    }

    // Si se está cambiando email, verificar unicidad
    if (datosActualizacion.email) {
      const emailExistente = await Personal.findOne({
        where: {
          email: datosActualizacion.email.toLowerCase().trim(),
          id: { [Op.ne]: id }
        }
      });

      if (emailExistente) {
        return error(res, 'Este email ya está registrado', 409);
      }
    }

    // Si se está cambiando sede, verificar que existe y está activa
    if (datosActualizacion.sede_id) {
      const sede = await Sede.findOne({
        where: { id: datosActualizacion.sede_id, activo: true }
      });

      if (!sede) {
        return error(res, 'Sede no encontrada o inactiva', 404);
      }
    }

    // Si se está cambiando rol, verificar que existe y está activo
    if (datosActualizacion.rol_id) {
      const rol = await Rol.findOne({
        where: { id: datosActualizacion.rol_id, activo: true }
      });

      if (!rol) {
        return error(res, 'Rol no encontrado o inactivo', 404);
      }
    }

    // Limpiar datos de entrada
    if (datosActualizacion.nombre) {
      datosActualizacion.nombre = datosActualizacion.nombre.trim();
    }
    if (datosActualizacion.apellido) {
      datosActualizacion.apellido = datosActualizacion.apellido.trim();
    }
    if (datosActualizacion.email) {
      datosActualizacion.email = datosActualizacion.email.toLowerCase().trim();
    }
    if (datosActualizacion.telefono) {
      datosActualizacion.telefono = datosActualizacion.telefono.trim();
    }

    await persona.update(datosActualizacion);

    logger.info('Persona actualizada:', {
      personalId: persona.id,
      cambios: Object.keys(datosActualizacion),
      actualizadoPor: req.user.email
    });

    // Obtener persona actualizada con relaciones
    const personaActualizada = await Personal.findByPk(id, {
      include: ['sede', 'rol']
    });

    success(res, personaActualizada, 'Persona actualizada correctamente');
  });

  /**
   * Eliminar persona (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const persona = await Personal.findByPk(id);

    if (!persona) {
      return error(res, 'Persona no encontrada', 404);
    }

    // Verificar si tiene remitos pendientes como solicitante
    const remitosPendientesSolicitante = await Remito.count({
      where: {
        solicitante_id: id,
        estado: ['preparado', 'en_transito', 'entregado']
      }
    });

    if (remitosPendientesSolicitante > 0) {
      return error(res, 
        `No se puede eliminar la persona. Tiene ${remitosPendientesSolicitante} remito(s) pendiente(s) como solicitante`, 
        409
      );
    }

    // Verificar si tiene remitos asignados como técnico
    const remitosAsignados = await Remito.count({
      where: {
        tecnico_asignado_id: id,
        estado: ['preparado', 'en_transito', 'entregado']
      }
    });

    if (remitosAsignados > 0) {
      return error(res, 
        `No se puede eliminar la persona. Tiene ${remitosAsignados} remito(s) asignado(s) como técnico`, 
        409
      );
    }

    await persona.update({ activo: false });

    logger.info('Persona eliminada (soft delete):', {
      personalId: persona.id,
      nombre: persona.getNombreCompleto(),
      email: persona.email,
      eliminadoPor: req.user.email
    });

    success(res, null, 'Persona eliminada correctamente');
  });

  /**
   * Obtener remitos de una persona específica
   */
  obtenerRemitos = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { tipo = 'todos', estado = null, limite = 20 } = req.query;

    const persona = await Personal.findByPk(id);
    if (!persona) {
      return error(res, 'Persona no encontrada', 404);
    }

    let remitos = [];
    const whereClause = {};

    if (estado) {
      whereClause.estado = estado;
    }

    const includeOptions = [
      {
        model: Sede,
        as: 'sedeOrigen',
        attributes: ['id', 'nombre_empresa', 'nombre_sede']
      },
      {
        model: Sede,
        as: 'sedeDestino',
        attributes: ['id', 'nombre_empresa', 'nombre_sede']
      }
    ];

    if (tipo === 'solicitados' || tipo === 'todos') {
      const remitosSolicitados = await Remito.findAll({
        where: { 
          solicitante_id: id,
          ...whereClause
        },
        include: [
          ...includeOptions,
          {
            model: Personal,
            as: 'tecnicoAsignado',
            attributes: ['id', 'nombre', 'apellido'],
            required: false
          }
        ],
        order: [['fecha', 'DESC']],
        limit: parseInt(limite)
      });

      remitos = remitos.concat(
        remitosSolicitados.map(r => ({ ...r.toJSON(), tipoRelacion: 'solicitante' }))
      );
    }

    if (tipo === 'asignados' || tipo === 'todos') {
      const remitosAsignados = await Remito.findAll({
        where: { 
          tecnico_asignado_id: id,
          ...whereClause
        },
        include: [
          ...includeOptions,
          {
            model: Personal,
            as: 'solicitante',
            attributes: ['id', 'nombre', 'apellido'],
            required: false
          }
        ],
        order: [['fecha', 'DESC']],
        limit: parseInt(limite)
      });

      remitos = remitos.concat(
        remitosAsignados.map(r => ({ ...r.toJSON(), tipoRelacion: 'tecnico' }))
      );
    }

    // Ordenar por fecha descendente si se mezclan tipos
    if (tipo === 'todos') {
      remitos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      remitos = remitos.slice(0, parseInt(limite));
    }

    success(res, {
      persona: {
        id: persona.id,
        nombreCompleto: persona.getNombreCompleto(),
        email: persona.email
      },
      remitos,
      filtros: {
        tipo,
        estado,
        limite: parseInt(limite)
      }
    }, 'Remitos de la persona obtenidos correctamente');
  });

  /**
   * Obtener estadísticas del personal por sede
   */
  obtenerEstadisticasPorSede = asyncHandler(async (req, res) => {
    // Estadísticas por sede usando query raw
    const estadisticas = await sequelize.query(`
      SELECT
        s.id,
        s.nombre_sede,
        s.localidad,
        s.provincia,
        COUNT(p.id) as total_personal
      FROM sedes s
      LEFT JOIN personal p ON s.id = p.sede_id AND p.activo = true
      WHERE s.activo = true
      GROUP BY s.id, s.nombre_sede, s.localidad, s.provincia
      ORDER BY total_personal DESC
    `, { type: sequelize.QueryTypes.SELECT });

    // Estadísticas por rol
    const estadisticasPorRol = await sequelize.query(`
      SELECT
        r.id,
        r.nombre,
        r.descripcion,
        COUNT(p.id) as total_personal
      FROM roles r
      LEFT JOIN personal p ON r.id = p.rol_id AND p.activo = true
      WHERE r.activo = true
      GROUP BY r.id, r.nombre, r.descripcion
      ORDER BY total_personal DESC
    `, { type: sequelize.QueryTypes.SELECT });

    success(res, {
      porSede: estadisticas,
      porRol: estadisticasPorRol,
      resumen: {
        totalPersonal: await Personal.count({ where: { activo: true } }),
        totalSedes: await Sede.count({ where: { activo: true } }),
        totalRoles: await Rol.count({ where: { activo: true } })
      }
    }, 'Estadísticas del personal obtenidas correctamente');
  });

  /**
   * Buscar personal por criterios específicos
   */
  buscar = asyncHandler(async (req, res) => {
    const { 
      termino, 
      sede_id = null, 
      rol_id = null, 
      activo = true,
      limite = 10 
    } = req.query;

    if (!termino || termino.trim().length < 2) {
      return error(res, 'El término de búsqueda debe tener al menos 2 caracteres', 400);
    }

    const whereClause = {
      [Op.or]: [
        { nombre: { [Op.iLike]: `%${termino.trim()}%` } },
        { apellido: { [Op.iLike]: `%${termino.trim()}%` } },
        { email: { [Op.iLike]: `%${termino.trim()}%` } }
      ]
    };

    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    if (rol_id) {
      whereClause.rol_id = rol_id;
    }

    if (activo !== null) {
      whereClause.activo = activo === 'true';
    }

    const resultados = await Personal.findAll({
      where: whereClause,
      include: [
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede']
        },
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']],
      limit: parseInt(limite)
    });

    success(res, {
      resultados: resultados.map(p => ({
        id: p.id,
        nombreCompleto: p.getNombreCompleto(),
        email: p.email,
        telefono: p.telefono,
        sede: p.sede,
        rol: p.rol,
        activo: p.activo
      })),
      criterios: {
        termino,
        sede_id,
        rol_id,
        activo,
        limite: parseInt(limite)
      },
      total: resultados.length
    }, 'Búsqueda de personal completada');
  });
}

module.exports = new PersonalController();