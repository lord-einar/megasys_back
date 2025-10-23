// src/modules/sedes/controllers/sedeController.js
const { Sede, Personal, Inventario, Servicio, Empresa, sequelize } = require('../../../models');
const { success, error, paginated } = require('../../../shared/utils/response');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class SedeController {
  /**
   * Listar todas las sedes con paginación y filtros
   */
  listar = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = '',
      activo = null,
      provincia = null,
      pais = null,
      empresa_id = null
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filtro por empresa
    if (empresa_id) {
      whereClause.empresa_id = empresa_id;
    }

    // Filtro de búsqueda
    if (search) {
      whereClause[Op.or] = [
        { nombre_sede: { [Op.iLike]: `%${search}%` } },
        { localidad: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Filtros específicos
    if (activo !== null) {
      whereClause.activo = activo === 'true';
    }

    if (provincia) {
      whereClause.provincia = { [Op.iLike]: `%${provincia}%` };
    }

    if (pais) {
      whereClause.pais = { [Op.iLike]: `%${pais}%` };
    }

    const { count, rows } = await Sede.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['nombre_sede', 'ASC']],
      include: [
        {
          model: Empresa,
          as: 'empresa',
          attributes: ['id', 'nombre', 'rfc']
        },
        {
          model: Personal,
          as: 'personalSede',
          attributes: ['id', 'nombre', 'apellido', 'email'],
          where: { activo: true },
          required: false
        }
      ]
    });

    // Agregar estadísticas básicas a cada sede
    const sedesConEstadisticas = await Promise.all(
      rows.map(async (sede) => {
        const sedeJson = sede.toJSON();
        
        // Contar inventario
        const totalInventario = await Inventario.count({
          where: { sede_id: sede.id, activo: true }
        });
        
        const inventarioDisponible = await Inventario.count({
          where: { 
            sede_id: sede.id, 
            activo: true, 
            estado: 'disponible' 
          }
        });

        return {
          ...sedeJson,
          estadisticas: {
            totalPersonal: sedeJson.personalSede?.length || 0,
            totalInventario,
            inventarioDisponible
          }
        };
      })
    );

    paginated(res, sedesConEstadisticas, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count
    }, 'Sedes obtenidas correctamente');
  });

  /**
   * Obtener una sede específica con detalles completos
   */
  obtener = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const sede = await Sede.findByPk(id, {
      include: [
        {
          model: Personal,
          as: 'personalSede',
          include: ['rol'],
          where: { activo: true },
          required: false
        },
        {
          model: Servicio,
          as: 'servicios',
          through: { 
            attributes: ['fecha_contratacion', 'fecha_vencimiento', 'activo'] 
          },
          include: ['proveedor', 'tipoServicio'],
          required: false
        },
        {
          model: Inventario,
          as: 'inventarioSede',
          include: ['tipoArticulo'],
          where: { activo: true },
          required: false
        }
      ]
    });

    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    // Agregar estadísticas detalladas
    const estadisticas = {
      personal: {
        total: sede.personalSede?.length || 0,
        porRol: {}
      },
      inventario: {
        total: sede.inventarioSede?.length || 0,
        disponible: sede.inventarioSede?.filter(item => item.estado === 'disponible').length || 0,
        enUso: sede.inventarioSede?.filter(item => item.estado === 'en_uso').length || 0,
        mantenimiento: sede.inventarioSede?.filter(item => item.estado === 'mantenimiento').length || 0,
        porTipo: {}
      },
      servicios: {
        total: sede.servicios?.length || 0,
        activos: sede.servicios?.filter(servicio =>
          servicio.SedeServicio?.activo !== false
        ).length || 0
      }
    };

    // Agrupar personal por rol
    if (sede.personalSede) {
      sede.personalSede.forEach(persona => {
        const rolNombre = persona.rol?.nombre || 'Sin rol';
        estadisticas.personal.porRol[rolNombre] =
          (estadisticas.personal.porRol[rolNombre] || 0) + 1;
      });
    }

    // Agrupar inventario por tipo
    if (sede.inventarioSede) {
      sede.inventarioSede.forEach(item => {
        const tipoNombre = item.tipoArticulo?.nombre || 'Sin tipo';
        estadisticas.inventario.porTipo[tipoNombre] =
          (estadisticas.inventario.porTipo[tipoNombre] || 0) + 1;
      });
    }

    const sedeCompleta = {
      ...sede.toJSON(),
      estadisticas
    };

    success(res, sedeCompleta, 'Sede obtenida correctamente');
  });

  /**
   * Crear nueva sede
   */
  crear = asyncHandler(async (req, res) => {
    const {
      empresa_id,
      nombre_sede,
      direccion,
      localidad,
      provincia,
      pais = 'Argentina',
      telefono,
      ip_sede
    } = req.body;

    // Verificar si ya existe la combinación empresa-sede
    const sedeExistente = await Sede.findOne({
      where: {
        empresa_id,
        nombre_sede: nombre_sede.trim()
      }
    });

    if (sedeExistente) {
      return error(res, 'Ya existe una sede con este nombre para esta empresa', 409);
    }

    const nuevaSede = await Sede.create({
      empresa_id,
      nombre_sede: nombre_sede.trim(),
      direccion: direccion.trim(),
      localidad: localidad.trim(),
      provincia: provincia.trim(),
      pais: pais.trim(),
      telefono: telefono?.trim(),
      ip_sede: ip_sede?.trim()
    });

    logger.info('Nueva sede creada:', {
      sedeId: nuevaSede.id,
      empresaId: nuevaSede.empresa_id,
      sede: nuevaSede.nombre_sede,
      creadoPor: req.user.email
    });

    success(res, nuevaSede, 'Sede creada correctamente', 201);
  });

  /**
   * Actualizar sede existente
   */
  actualizar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const datosActualizacion = req.body;

    const sede = await Sede.findByPk(id);

    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    // Si se está cambiando empresa_id o nombre_sede, verificar unicidad
    if (datosActualizacion.empresa_id || datosActualizacion.nombre_sede) {
      const empresaId = datosActualizacion.empresa_id || sede.empresa_id;
      const nombreSede = datosActualizacion.nombre_sede || sede.nombre_sede;

      const sedeExistente = await Sede.findOne({
        where: {
          empresa_id: empresaId,
          nombre_sede: nombreSede.trim(),
          id: { [Op.ne]: id } // Excluir la sede actual
        }
      });

      if (sedeExistente) {
        return error(res, 'Ya existe una sede con este nombre para esta empresa', 409);
      }
    }

    // Limpiar datos de entrada
    Object.keys(datosActualizacion).forEach(key => {
      if (typeof datosActualizacion[key] === 'string') {
        datosActualizacion[key] = datosActualizacion[key].trim();
      }
    });

    await sede.update(datosActualizacion);

    logger.info('Sede actualizada:', {
      sedeId: sede.id,
      cambios: Object.keys(datosActualizacion),
      actualizadoPor: req.user.email
    });

    // Obtener sede actualizada con relaciones
    const sedeActualizada = await Sede.findByPk(id, {
      include: [
        {
          model: Personal,
          as: 'personalSede',
          attributes: ['id', 'nombre', 'apellido', 'email'],
          where: { activo: true },
          required: false
        }
      ]
    });

    success(res, sedeActualizada, 'Sede actualizada correctamente');
  });

  /**
   * Eliminar sede (soft delete)
   */
  eliminar = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const sede = await Sede.findByPk(id);

    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    // Verificar si tiene personal activo
    const personalActivo = await Personal.count({
      where: {
        sede_id: id,
        activo: true
      }
    });

    if (personalActivo > 0) {
      return error(res, 
        `No se puede eliminar la sede. Tiene ${personalActivo} empleado(s) activo(s)`, 
        409
      );
    }

    // Verificar si tiene inventario activo
    const inventarioActivo = await Inventario.count({
      where: {
        sede_id: id,
        activo: true
      }
    });

    if (inventarioActivo > 0) {
      return error(res, 
        `No se puede eliminar la sede. Tiene ${inventarioActivo} item(s) de inventario activo(s)`, 
        409
      );
    }

    await sede.update({ activo: false });

    logger.info('Sede eliminada (soft delete):', {
      sedeId: sede.id,
      empresaId: sede.empresa_id,
      sede: sede.nombre_sede,
      eliminadoPor: req.user.email
    });

    success(res, null, 'Sede eliminada correctamente');
  });

  /**
   * Obtener personal de una sede específica
   */
  obtenerPersonal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activo = true } = req.query;

    const sede = await Sede.findByPk(id);
    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    const wherePersonal = { sede_id: id };
    if (activo !== null) {
      wherePersonal.activo = activo === 'true';
    }

    const personal = await Personal.findAll({
      where: wherePersonal,
      include: ['rol'],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']]
    });

    success(res, {
      sede: {
        id: sede.id,
        nombre: sede.getFullName(),
        direccion: sede.direccion,
        localidad: sede.localidad
      },
      personal
    }, 'Personal de la sede obtenido correctamente');
  });

  /**
   * Obtener inventario de una sede específica
   */
  obtenerInventario = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      estado = null, 
      tipo_articulo = null,
      disponible_solo = false 
    } = req.query;

    const sede = await Sede.findByPk(id);
    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    const whereInventario = { 
      sede_id: id, 
      activo: true 
    };

    if (estado) {
      whereInventario.estado = estado;
    }

    if (disponible_solo === 'true') {
      whereInventario.estado = 'disponible';
    }

    if (tipo_articulo) {
      whereInventario.tipo_articulo_id = tipo_articulo;
    }

    const inventario = await Inventario.findAll({
      where: whereInventario,
      include: ['tipoArticulo'],
      order: [['marca', 'ASC'], ['modelo', 'ASC']]
    });

    // Estadísticas del inventario
    const estadisticas = {
      total: inventario.length,
      disponible: inventario.filter(item => item.estado === 'disponible').length,
      enUso: inventario.filter(item => item.estado === 'en_uso').length,
      mantenimiento: inventario.filter(item => item.estado === 'mantenimiento').length,
      dadoDeBaja: inventario.filter(item => item.estado === 'dado_de_baja').length
    };

    success(res, {
      sede: {
        id: sede.id,
        nombre: sede.getFullName(),
        direccion: sede.direccion
      },
      inventario,
      estadisticas
    }, 'Inventario de la sede obtenido correctamente');
  });

  /**
   * Obtener servicios de una sede específica
   */
  obtenerServicios = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activo = true } = req.query;

    const sede = await Sede.findByPk(id);
    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    const whereServicio = {};
    if (activo !== null) {
      whereServicio['$SedeServicio.activo] = activo === true']
    }

    const servicios = await sede.getServicios({
      where: whereServicio,
      include: [
        'proveedor', 
        'tipoServicio',
        {
          model: require('../../../models').SoporteNivel,
          as: 'nivelessoporte',
          where: { activo: true },
          required: false
        }
      ],
      joinTableAttributes: ['fecha_contratacion', 'fecha_vencimiento', 'activo']
    });

    success(res, {
      sede: {
        id: sede.id,
        nombre: sede.getFullName()
      },
      servicios
    }, 'Servicios de la sede obtenidos correctamente');
  });

  /**
   * Asignar servicio a una sede
   */
  asignarServicio = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { servicio_id, fecha_contratacion, fecha_vencimiento } = req.body;

    const sede = await Sede.findByPk(id);
    if (!sede) {
      return error(res, 'Sede no encontrada', 404);
    }

    const servicio = await Servicio.findByPk(servicio_id);
    if (!servicio) {
      return error(res, 'Servicio no encontrado', 404);
    }

    // Verificar si ya está asignado
    const asignacionExistente = await sede.hasServicio(servicio);
    if (asignacionExistente) {
      return error(res, 'El servicio ya está asignado a esta sede', 409);
    }

    await sede.addServicio(servicio, {
      through: {
        fecha_contratacion,
        fecha_vencimiento,
        activo: true
      }
    });

    logger.info('Servicio asignado a sede:', {
      sedeId: sede.id,
      servicioId: servicio.id,
      asignadoPor: req.user.email
    });

    success(res, null, 'Servicio asignado correctamente a la sede');
  });

  /**
   * Obtener estadísticas generales de sedes
   */
  obtenerEstadisticas = asyncHandler(async (req, res) => {
    const estadisticas = {
      sedes: {
        total: await Sede.count(),
        activas: await Sede.count({ where: { activo: true } }),
        inactivas: await Sede.count({ where: { activo: false } })
      },
      personal: {
        total: await Personal.count({ where: { activo: true } })
      },
      inventario: {
        total: await Inventario.count({ where: { activo: true } }),
        disponible: await Inventario.count({ 
          where: { activo: true, estado: 'disponible' } 
        })
      }
    };

    // Top 5 sedes con más personal
    const sedesConMasPersonal = await Sede.findAll({
      attributes: [
        'id', 'empresa_id', 'nombre_sede',
        [sequelize.fn('COUNT', sequelize.col('personalSede.id')), 'total_personal']
      ],
      include: [
        {
          model: Personal,
          as: 'personalSede',
          attributes: [],
          where: { activo: true },
          required: false
        }
      ],
      where: { activo: true },
      group: ['Sede.id', 'Sede.empresa_id', 'Sede.nombre_sede'],
      order: [[sequelize.literal('total_personal'), 'DESC']],
      limit: 5,
      raw: true,
      subQuery: false
    });

    // Top 5 sedes con más inventario
    const sedesConMasInventario = await Sede.findAll({
      attributes: [
        'id', 'empresa_id', 'nombre_sede',
        [sequelize.fn('COUNT', sequelize.col('inventarioSede.id')), 'total_inventario']
      ],
      include: [
        {
          model: Inventario,
          as: 'inventarioSede',
          attributes: [],
          where: { activo: true },
          required: false
        }
      ],
      where: { activo: true },
      group: ['Sede.id', 'Sede.empresa_id', 'Sede.nombre_sede'],
      order: [[sequelize.literal('total_inventario'), 'DESC']],
      limit: 5,
      raw: true,
      subQuery: false
    });

    estadisticas.rankings = {
      sedesConMasPersonal,
      sedesConMasInventario
    };

    success(res, estadisticas, 'Estadísticas obtenidas correctamente');
  });
}

module.exports = new SedeController();