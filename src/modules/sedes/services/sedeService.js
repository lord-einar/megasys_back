// src/modules/sedes/services/sedeService.js
const { Sede, Personal, Inventario, Servicio, Empresa, sequelize } = require('../../../models');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');

class SedeService {
  /**
   * Listar sedes con filtros y paginación
   */
  async listar(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      activo = null,
      provincia = null,
      pais = null,
      empresa_id = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (empresa_id) {
      whereClause.empresa_id = empresa_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { nombre_sede: { [Op.iLike]: `%${search}%` } },
        { localidad: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Por defecto, mostrar solo sedes activas (activo = true)
    if (activo !== null) {
      whereClause.activo = activo === 'true' || activo === true;
    } else {
      whereClause.activo = true;
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
          attributes: ['id', 'nombre_empresa', 'cuit']
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
   * Enriquecer sedes con estadísticas
   */
  async enriquecerConEstadisticas(sedes) {
    return Promise.all(
      sedes.map(async (sede) => {
        const sedeJson = sede.toJSON?.() || sede;

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
  }

  /**
   * Obtener sede con detalles completos
   */
  async obtenerConDetalles(sedeId) {
    const sede = await Sede.findByPk(sedeId, {
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

    return sede;
  }

  /**
   * Calcular estadísticas detalladas de una sede
   */
  calcularEstadisticas(sede) {
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
        dadoDeBaja: sede.inventarioSede?.filter(item => item.estado === 'dado_de_baja').length || 0,
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

    return estadisticas;
  }

  /**
   * Crear nueva sede
   */
  async crear(datosNuevaSede) {
    const {
      empresa_id,
      nombre_sede,
      direccion,
      localidad,
      provincia,
      pais = 'Argentina',
      telefono,
      ip_sede
    } = datosNuevaSede;

    // Verificar si ya existe
    const sedeExistente = await Sede.findOne({
      where: {
        empresa_id,
        nombre_sede: nombre_sede.trim()
      }
    });

    if (sedeExistente) {
      throw new Error('Ya existe una sede con este nombre para esta empresa');
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
      sede: nuevaSede.nombre_sede
    });

    return nuevaSede;
  }

  /**
   * Actualizar sede
   */
  async actualizar(sedeId, datosActualizacion, usuarioEmail) {
    const sede = await Sede.findByPk(sedeId);

    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    // Verificar unicidad si se cambia empresa_id o nombre_sede
    if (datosActualizacion.empresa_id || datosActualizacion.nombre_sede) {
      const empresaId = datosActualizacion.empresa_id || sede.empresa_id;
      const nombreSede = datosActualizacion.nombre_sede || sede.nombre_sede;

      const sedeExistente = await Sede.findOne({
        where: {
          empresa_id: empresaId,
          nombre_sede: nombreSede.trim(),
          id: { [Op.ne]: sedeId }
        }
      });

      if (sedeExistente) {
        throw new Error('Ya existe una sede con este nombre para esta empresa');
      }
    }

    // Limpiar datos
    const datosLimpios = {};
    Object.keys(datosActualizacion).forEach(key => {
      if (typeof datosActualizacion[key] === 'string') {
        datosLimpios[key] = datosActualizacion[key].trim();
      } else {
        datosLimpios[key] = datosActualizacion[key];
      }
    });

    await sede.update(datosLimpios);

    logger.info('Sede actualizada:', {
      sedeId: sede.id,
      cambios: Object.keys(datosLimpios),
      actualizadoPor: usuarioEmail
    });

    // Retornar sede actualizada con relaciones
    return Sede.findByPk(sedeId, {
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
  }

  /**
   * Eliminar sede (soft delete)
   */
  async eliminar(sedeId, usuarioEmail) {
    const sede = await Sede.findByPk(sedeId);

    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    // Verificar si tiene personal activo
    const personalActivo = await Personal.count({
      where: {
        sede_id: sedeId,
        activo: true
      }
    });

    if (personalActivo > 0) {
      throw new Error(
        `No se puede eliminar la sede. Tiene ${personalActivo} empleado(s) activo(s)`
      );
    }

    // Verificar si tiene inventario activo
    const inventarioActivo = await Inventario.count({
      where: {
        sede_id: sedeId,
        activo: true
      }
    });

    if (inventarioActivo > 0) {
      throw new Error(
        `No se puede eliminar la sede. Tiene ${inventarioActivo} item(s) de inventario activo(s)`
      );
    }

    await sede.update({ activo: false });

    logger.info('Sede eliminada (soft delete):', {
      sedeId: sede.id,
      empresaId: sede.empresa_id,
      sede: sede.nombre_sede,
      eliminadoPor: usuarioEmail
    });

    return true;
  }

  /**
   * Obtener personal de una sede
   */
  async obtenerPersonal(sedeId, filters = {}) {
    const { activo = true } = filters;

    const sede = await Sede.findByPk(sedeId);
    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    const wherePersonal = { sede_id: sedeId };
    if (activo !== null && activo !== undefined) {
      wherePersonal.activo = activo === 'true' || activo === true;
    } else {
      wherePersonal.activo = true;
    }

    const personal = await Personal.findAll({
      where: wherePersonal,
      include: ['rol'],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']]
    });

    return {
      sede: {
        id: sede.id,
        nombre: sede.getFullName?.() || `${sede.nombre_sede} (${sede.localidad})`,
        direccion: sede.direccion,
        localidad: sede.localidad
      },
      personal
    };
  }

  /**
   * Obtener inventario de una sede
   */
  async obtenerInventario(sedeId, filters = {}) {
    const {
      estado = null,
      tipo_articulo = null,
      disponible_solo = false
    } = filters;

    const sede = await Sede.findByPk(sedeId);
    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    const whereInventario = {
      sede_id: sedeId,
      activo: true
    };

    if (estado) {
      whereInventario.estado = estado;
    }

    if (disponible_solo === 'true' || disponible_solo === true) {
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

    // Buscar artículos en préstamo EN esta sede (aunque no sean parte del inventario propio)
    const { Remito, RemitoDetalle } = require('../../../models');
    const prestamosEnSede = await RemitoDetalle.findAll({
      where: {
        es_prestamo: true,
        devuelto: false
      },
      include: [
        {
          model: Remito,
          as: 'remito',
          where: {
            sede_destino_id: sedeId,
            estado: {
              [Op.in]: ['preparado', 'en_transito', 'entregado']
            }
          },
          include: [
            {
              model: Sede,
              as: 'sedeOrigen',
              attributes: ['id', 'nombre_sede', 'localidad']
            }
          ]
        },
        {
          model: Inventario,
          as: 'inventarioDetalle',
          include: [
            {
              model: require('../../../models').TipoArticulo,
              as: 'tipoArticulo',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ]
    });

    // Estadísticas
    const estadisticas = {
      total: inventario.length,
      disponible: inventario.filter(item => item.estado === 'disponible').length,
      enUso: inventario.filter(item => item.estado === 'en_uso').length,
      enPrestamo: inventario.filter(item => item.estado === 'en_prestamo').length,
      mantenimiento: inventario.filter(item => item.estado === 'mantenimiento').length,
      dadoDeBaja: inventario.filter(item => item.estado === 'dado_de_baja').length,
      prestamosEnEstaSede: prestamosEnSede.length
    };

    return {
      sede: {
        id: sede.id,
        nombre: sede.getFullName?.() || `${sede.nombre_sede} (${sede.localidad})`,
        direccion: sede.direccion
      },
      inventario,
      prestamosEnSede: prestamosEnSede.map(detalle => ({
        inventario: detalle.inventarioDetalle,
        remito: {
          numero_remito: detalle.remito.numero_remito,
          estado: detalle.remito.estado,
          sedeOrigen: detalle.remito.sedeOrigen
        },
        fechaDevolucionEsperada: detalle.fecha_devolucion_esperada,
        observaciones: detalle.observaciones
      })),
      estadisticas
    };
  }

  /**
   * Obtener servicios de una sede
   */
  async obtenerServicios(sedeId, filters = {}) {
    const { activo = true } = filters;

    const sede = await Sede.findByPk(sedeId);
    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    const whereServicio = {};
    if (activo !== null && activo !== undefined) {
      whereServicio['$SedeServicio.activo$'] = activo === 'true' || activo === true;
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

    return {
      sede: {
        id: sede.id,
        nombre: sede.getFullName?.() || `${sede.nombre_sede} (${sede.localidad})`
      },
      servicios
    };
  }

  /**
   * Asignar servicio a una sede
   */
  async asignarServicio(sedeId, servicioId, datosAsignacion, usuarioEmail) {
    const { fecha_contratacion, fecha_vencimiento } = datosAsignacion;

    const sede = await Sede.findByPk(sedeId);
    if (!sede) {
      throw new Error('Sede no encontrada');
    }

    const servicio = await Servicio.findByPk(servicioId);
    if (!servicio) {
      throw new Error('Servicio no encontrado');
    }

    // Verificar si ya está asignado
    const asignacionExistente = await sede.hasServicio(servicio);
    if (asignacionExistente) {
      throw new Error('El servicio ya está asignado a esta sede');
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
      asignadoPor: usuarioEmail
    });

    return true;
  }

  /**
   * Obtener estadísticas generales
   */
  async obtenerEstadisticasGenerales() {
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

    return estadisticas;
  }
}

module.exports = new SedeService();
