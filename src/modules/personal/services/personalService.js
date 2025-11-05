// src/modules/personal/services/personalService.js
const { Personal, Sede, Rol, PersonalSede, Remito, sequelize } = require('../../../models');
const logger = require('../../../shared/utils/logger');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { assignSistemasRoleIfAuthorized } = require('../../../shared/utils/sistemasRoleAssignment');

class PersonalService {
  /**
   * Validar que el email sea único
   */
  async validarEmailUnico(email, personalIdExcluir = null) {
    const whereClause = { email: email.toLowerCase() };
    if (personalIdExcluir) {
      whereClause.id = { [Op.ne]: personalIdExcluir };
    }

    const personalExistente = await Personal.findOne({ where: whereClause });
    if (personalExistente) {
      throw new Error(`El email "${email}" ya está registrado en el sistema. Intenta con otro email.`);
    }
  }

  /**
   * Validar que todas las sedes existan y estén activas
   */
  async validarSedesActivas(sedesIds) {
    if (!Array.isArray(sedesIds) || sedesIds.length === 0) {
      throw new Error('Debes seleccionar al menos una sede para asignar el personal');
    }

    const sedesValidas = await Sede.count({
      where: {
        id: sedesIds,
        activo: true
      }
    });

    if (sedesValidas !== sedesIds.length) {
      throw new Error(`${sedesIds.length - sedesValidas} de las sedes seleccionadas no existen o están inactivas. Por favor verifica tu selección.`);
    }
  }

  /**
   * Validar que el rol exista y esté activo
   */
  async validarRolActivo(rolId) {
    const rol = await Rol.findOne({
      where: {
        id: rolId,
        activo: true
      }
    });

    if (!rol) {
      throw new Error('El rol seleccionado no existe o no está disponible. Por favor selecciona un rol válido.');
    }

    return rol;
  }

  /**
   * Listar personal con paginación y filtros
   * Soporta restricción por rol (personal_id)
   */
  async listar(filters = {}, userRole = null, userId = null) {
    const {
      page = 1,
      limit = 10,
      search = '',
      activo = null,
      sede_id = null,
      rol_id = null,
      personal_id = null
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Si se especifica un personal_id, filtrar solo esa persona (para usuarios Soporte)
    if (personal_id) {
      whereClause.id = personal_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { apellido: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Por defecto, mostrar solo personal activo (activo = true)
    if (activo !== null && activo !== undefined) {
      whereClause.activo = activo === 'true' || activo === true;
    } else {
      whereClause.activo = true;
    }

    let include = [
      {
        model: Rol,
        as: 'rol',
        attributes: ['id', 'nombre']
      },
      {
        model: Sede,
        as: 'sede',
        attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
      }
    ];

    if (sede_id) {
      include.push({
        model: PersonalSede,
        as: 'sedesAsignadas',
        where: { sede_id, activo: true },
        attributes: ['id', 'sede_id', 'fecha_inicio'],
        required: true
      });
    } else {
      include.push({
        model: PersonalSede,
        as: 'sedesAsignadas',
        where: { activo: true },
        attributes: ['id', 'sede_id'],
        required: false
      });
    }

    if (rol_id) {
      whereClause.rol_id = rol_id;
    }

    const { count, rows } = await Personal.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset,
      order: [['apellido', 'ASC'], ['nombre', 'ASC']],
      distinct: true
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
   * Obtener personal con detalles completos
   */
  async obtenerConDetalles(personalId) {
    const persona = await Personal.findByPk(personalId, {
      include: [
        {
          model: Rol,
          as: 'rol',
          attributes: ['id', 'nombre', 'descripcion']
        },
        {
          model: Sede,
          as: 'sede',
          attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
        },
        {
          model: PersonalSede,
          as: 'sedesAsignadas',
          where: { activo: true },
          required: false,
          include: [
            {
              model: Sede,
              as: 'sede',
              attributes: ['id', 'nombre_sede', 'localidad', 'provincia']
            },
            {
              model: Rol,
              as: 'rol',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ]
    });

    return persona;
  }

  /**
   * Calcular estadísticas de remitos para una persona
   */
  async calcularEstadisticasRemitos(persona) {
    const remitosSolicitados = await Remito.count({
      where: {
        solicitante_id: persona.id
      }
    });

    const remitosAsignados = await Remito.count({
      where: {
        tecnico_asignado_id: persona.id
      }
    });

    return {
      remitosSolicitados,
      remitosAsignados,
      total: remitosSolicitados + remitosAsignados
    };
  }

  /**
   * Obtener remitos de una persona
   */
  async obtenerRemitos(personalId, filters = {}) {
    const {
      tipo = 'todos', // 'solicitados', 'asignados' o 'todos'
      estado = null,
      limit = 10,
      page = 1
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (estado) {
      whereClause.estado = estado;
    }

    let query = {};

    if (tipo === 'solicitados') {
      query.where = { ...whereClause, solicitante_id: personalId };
    } else if (tipo === 'asignados') {
      query.where = { ...whereClause, tecnico_asignado_id: personalId };
    } else {
      query.where = {
        [Op.or]: [
          { solicitante_id: personalId, ...whereClause },
          { tecnico_asignado_id: personalId, ...whereClause }
        ]
      };
    }

    query.limit = parseInt(limit);
    query.offset = offset;
    query.order = [['fecha_creacion', 'DESC']];

    const { count, rows } = await Remito.findAndCountAll(query);

    return {
      rows,
      count,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count }
    };
  }

  /**
   * Crear nueva persona
   * @param {Object} datosNueva - Datos de la nueva persona
   * @param {string} usuarioEmail - Email del usuario que crea
   * @param {Object} options - Opciones incluyendo transaction
   */
  async crear(datosNueva, usuarioEmail, options = {}) {
    const { transaction } = options;
    const {
      nombre,
      apellido,
      email,
      telefono,
      sedes,
      rol_id
    } = datosNueva;

    // Validaciones (fuera de la transacción - son operaciones de lectura)
    await this.validarEmailUnico(email);
    await this.validarSedesActivas(sedes);
    await this.validarRolActivo(rol_id);

    // TODO: Envolver esto en transacción en el controlador mediante TransactionWrapper
    // CRITICAL: Si se pasa transaction, usarla. Si no, crear una nueva
    let t = transaction;
    let shouldCommit = false;

    if (!t) {
      t = await sequelize.transaction();
      shouldCommit = true;
    }

    try {
      // Crear persona dentro de la transacción
      let personaRolId = rol_id;
      const persona = await Personal.create({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.toLowerCase().trim(),
        telefono: telefono?.trim(),
        rol_id,
        sede_id: sedes[0], // Primera sede como principal
        activo: true
      }, { transaction: t });

      // Asignar automáticamente rol "Sistemas" si el rol actual está autorizado
      const rolAutorizado = await Rol.findByPk(rol_id);
      if (rolAutorizado) {
        const roleAssignmentResult = await assignSistemasRoleIfAuthorized(
          persona.id,
          rol_id,
          t
        );

        if (roleAssignmentResult) {
          // Refrescar el usuario para obtener el nuevo rol_id asignado
          await persona.reload({ transaction: t });
          personaRolId = persona.rol_id;

          logger.info('Rol Sistemas asignado automáticamente al crear personal:', {
            personalId: persona.id,
            nombre: persona.nombre,
            rolAnterior: rol_id,
            rolNuevo: persona.rol_id
          });
        }
      }

      // Crear asignaciones a sedes dentro de la MISMA transacción
      // Usar el rol_id que fue asignado automáticamente (si aplica)
      for (const sedeId of sedes) {
        await PersonalSede.create({
          personal_id: persona.id,
          sede_id: sedeId,
          rol_id: personaRolId,
          fecha_inicio: new Date(),
          activo: true
        }, { transaction: t });
      }

      // Solo commit si creamos la transacción localmente
      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Nuevo personal creado correctamente:', {
        personalId: persona.id,
        email: persona.email,
        sedes: sedes.length,
        creadoPor: usuarioEmail
      });

      return persona;
    } catch (error) {
      // Rollback si creamos la transacción localmente
      if (shouldCommit && t) {
        await t.rollback();
      }
      logger.error('Error creando personal:', {
        error: error.message,
        email,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Actualizar persona
   * @param {string} personalId - ID de la persona
   * @param {Object} datosActualizacion - Datos a actualizar
   * @param {string} usuarioEmail - Email del usuario que actualiza
   * @param {Object} options - Opciones incluyendo transaction
   */
  async actualizar(personalId, datosActualizacion, usuarioEmail, options = {}) {
    const { transaction } = options;

    // Validaciones (fuera de la transacción - son operaciones de lectura)
    const persona = await Personal.findByPk(personalId);

    if (!persona) {
      throw new Error('Personal no encontrado');
    }

    // Validar email si se actualiza
    if (datosActualizacion.email && datosActualizacion.email !== persona.email) {
      await this.validarEmailUnico(datosActualizacion.email, personalId);
    }

    // Validar rol si se actualiza
    if (datosActualizacion.rol_id && datosActualizacion.rol_id !== persona.rol_id) {
      await this.validarRolActivo(datosActualizacion.rol_id);
    }

    // Validar sedes si se actualizan
    const sedesParaActualizar = datosActualizacion.sedes;
    if (sedesParaActualizar && Array.isArray(sedesParaActualizar)) {
      await this.validarSedesActivas(sedesParaActualizar);
    }

    // CRITICAL: Si se pasa transaction, usarla. Si no, crear una nueva
    let t = transaction;
    let shouldCommit = false;

    if (!t) {
      t = await sequelize.transaction();
      shouldCommit = true;
    }

    try {
      // Preparar datos (excluir 'sedes' de la actualización de Personal)
      const datosLimpios = {};
      Object.keys(datosActualizacion).forEach(key => {
        if (key === 'sedes') {
          // No actualizar sedes aquí, se maneja aparte
          return;
        }
        if (key === 'email') {
          datosLimpios[key] = datosActualizacion[key].toLowerCase().trim();
        } else if (typeof datosActualizacion[key] === 'string') {
          datosLimpios[key] = datosActualizacion[key].trim();
        } else {
          datosLimpios[key] = datosActualizacion[key];
        }
      });

      // Actualizar datos básicos de personal DENTRO DE LA TRANSACCIÓN
      await persona.update(datosLimpios, { transaction: t });

      // Actualizar sedes si se proporcionan - DENTRO DE LA MISMA TRANSACCIÓN
      if (sedesParaActualizar && Array.isArray(sedesParaActualizar) && sedesParaActualizar.length > 0) {
        // Desactivar asignaciones previas
        await PersonalSede.update(
          { activo: false, fecha_fin: new Date() },
          {
            where: { personal_id: personalId, activo: true },
            transaction: t
          }
        );

        // Crear nuevas asignaciones
        for (const sedeId of sedesParaActualizar) {
          await PersonalSede.create({
            personal_id: personalId,
            sede_id: sedeId,
            rol_id: datosLimpios.rol_id || persona.rol_id,
            fecha_inicio: new Date(),
            activo: true
          }, { transaction: t });
        }

        // Actualizar sede_id principal (primera sede de la lista)
        await persona.update({ sede_id: sedesParaActualizar[0] }, { transaction: t });
      }

      // Solo commit si creamos la transacción localmente
      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Personal actualizado correctamente:', {
        personalId: persona.id,
        cambios: Object.keys(datosLimpios),
        sedesActualizadas: sedesParaActualizar?.length || 0,
        actualizadoPor: usuarioEmail
      });

      return await this.obtenerConDetalles(personalId);
    } catch (error) {
      // Rollback si creamos la transacción localmente
      if (shouldCommit && t) {
        await t.rollback();
      }
      logger.error('Error actualizando personal:', {
        error: error.message,
        personalId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Verificar si tiene remitos pendientes antes de eliminar
   */
  async verificarRemitosPendientes(personalId) {
    const remitosPendientes = await Remito.count({
      where: {
        [Op.or]: [
          { solicitante_id: personalId, estado: { [Op.ne]: 'completado' } },
          { tecnico_asignado_id: personalId, estado: { [Op.ne]: 'completado' } }
        ]
      }
    });

    if (remitosPendientes > 0) {
      throw new Error(`No se puede eliminar el personal. Existen ${remitosPendientes} remito(s) pendiente(s) asociado(s) a esta persona. Por favor completa o reasigna todos los remitos pendientes.`);
    }
  }

  /**
   * Eliminar persona (soft delete)
   * @param {string} personalId - ID de la persona
   * @param {string} usuarioEmail - Email del usuario que elimina
   * @param {Object} options - Opciones incluyendo transaction
   */
  async eliminar(personalId, usuarioEmail, options = {}) {
    const { transaction } = options;

    // Validaciones (fuera de la transacción - son operaciones de lectura)
    const persona = await Personal.findByPk(personalId);

    if (!persona) {
      throw new Error('Personal no encontrado');
    }

    // Verificar remitos pendientes
    await this.verificarRemitosPendientes(personalId);

    // CRITICAL: Si se pasa transaction, usarla. Si no, crear una nueva
    let t = transaction;
    let shouldCommit = false;

    if (!t) {
      t = await sequelize.transaction();
      shouldCommit = true;
    }

    try {
      // Soft delete - DENTRO DE LA TRANSACCIÓN
      await persona.update({ activo: false }, { transaction: t });

      // Desactivar asignaciones - DENTRO DE LA MISMA TRANSACCIÓN
      await PersonalSede.update(
        { activo: false, fecha_fin: new Date() },
        {
          where: { personal_id: personalId },
          transaction: t
        }
      );

      // Solo commit si creamos la transacción localmente
      if (shouldCommit) {
        await t.commit();
      }

      logger.info('Personal eliminado correctamente (soft delete):', {
        personalId: persona.id,
        email: persona.email,
        eliminadoPor: usuarioEmail
      });

      return true;
    } catch (error) {
      // Rollback si creamos la transacción localmente
      if (shouldCommit && t) {
        await t.rollback();
      }
      logger.error('Error eliminando personal:', {
        error: error.message,
        personalId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Buscar personal rápidamente
   */
  async buscar(termino, filtros = {}) {
    const { limite = 20, sede_id = null, rol_id = null } = filtros;

    const whereClause = {
      activo: true,
      [Op.or]: [
        { nombre: { [Op.iLike]: `%${termino}%` } },
        { apellido: { [Op.iLike]: `%${termino}%` } },
        { email: { [Op.iLike]: `%${termino}%` } }
      ]
    };

    if (rol_id) {
      whereClause.rol_id = rol_id;
    }

    let include = [{ model: Rol, as: 'rol', attributes: ['id', 'nombre'] }];

    if (sede_id) {
      include.push({
        model: PersonalSede,
        as: 'sedesAsignadas',
        where: { sede_id, activo: true },
        required: true
      });
    }

    const resultados = await Personal.findAll({
      where: whereClause,
      include,
      limit: parseInt(limite),
      order: [['apellido', 'ASC'], ['nombre', 'ASC']]
    });

    return resultados;
  }

  /**
   * Obtener estadísticas por sede
   */
  async obtenerEstadisticasPorSede() {
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

    return estadisticas;
  }

  /**
   * Obtener estadísticas generales
   */
  async obtenerEstadisticasGenerales() {
    // Contar personal total
    const totalPersonal = await Personal.count({ where: { activo: true } });

    // Contar total de sedes activas en el sistema
    const totalSedes = await Sede.count({ where: { activo: true } });

    // Contar roles únicos
    const rolesUnicos = await sequelize.query(`
      SELECT COUNT(DISTINCT rol_id) as total_roles
      FROM personal
      WHERE activo = true AND rol_id IS NOT NULL
    `, { type: sequelize.QueryTypes.SELECT });

    const estadisticas = {
      totalPersonal,
      totalSedesUnicas: totalSedes,
      totalRolesUnicos: rolesUnicos[0]?.total_roles || 0,
      personal: {
        total: totalPersonal
      },
      resumen: {
        totalPersonal,
        totalSedes: totalSedes,
        totalRoles: rolesUnicos[0]?.total_roles || 0
      },
      sedesConMasPersonal: await this.obtenerEstadisticasPorSede()
    };

    return estadisticas;
  }

  /**
   * Auto-provisionar un Personal cuando se loguea desde Azure AD
   * Crea automáticamente un registro en Personal si no existe
   * @param {Object} azureUser - Datos del usuario desde Azure AD
   * @param {Object} roleInfo - Información del rol obtenida del servicio de roles
   */
  async autoProvisionarPersonal(azureUser, roleInfo) {
    const { id, email, name } = azureUser;
    const { role } = roleInfo;

    // Verificar si ya existe y está activo
    const personalExistente = await Personal.findOne({
      where: {
        email: email.toLowerCase(),
        activo: true
      }
    });

    if (personalExistente) {
      logger.info('Personal ya existe y está activo, no requiere auto-provisioning:', {
        email,
        personalId: personalExistente.id,
        privilegioActual: personalExistente.privilegio_app
      });
      return personalExistente;
    }

    // Extraer nombre y apellido del name completo
    const [nombre, ...apellidoArr] = name?.split(' ') || ['Usuario', 'Automático'];
    const apellido = apellidoArr.length > 0 ? apellidoArr.join(' ') : 'Automático';

    // El role desde Azure AD ya viene como 'super_admin', 'support', 'helpdesk' o 'user'
    // Se asigna directamente como privilegio_app
    const privilegioApp = role || 'user';

    logger.info('Asignando privilegios de aplicación basados en grupo Azure AD:', {
      email,
      role,
      privilegioAsignado: privilegioApp
    });

    // Si existe pero está inactivo, reactivarlo y actualizar privilegios
    const personalInactivo = await Personal.findOne({
      where: {
        email: email.toLowerCase(),
        activo: false
      }
    });

    if (personalInactivo) {
      logger.info('Personal encontrado pero inactivo, reactivando:', {
        email,
        personalId: personalInactivo.id,
        privilegioAnterior: personalInactivo.privilegio_app,
        privilegioNuevo: privilegioApp
      });

      const transaction = await sequelize.transaction();
      try {
        await personalInactivo.update({
          activo: true,
          privilegio_app: privilegioApp
        }, { transaction });

        await transaction.commit();

        logger.info('Personal reactivado exitosamente:', {
          email,
          personalId: personalInactivo.id,
          privilegioAsignado: privilegioApp
        });

        return personalInactivo;
      } catch (error) {
        await transaction.rollback();
        logger.error('Error al reactivar personal:', {
          email,
          error: error.message
        });
        throw error;
      }
    }

    // Crear nuevo usuario con privilegios basados en grupo Azure AD
    const transaction = await sequelize.transaction();

    try {
      // El id de Entra ID contiene un punto (homeAccountId) que no es válido como UUID en PostgreSQL
      // Generar un UUID válido en su lugar - el email será el identificador único
      const validUUID = uuidv4();

      const nuevoPersonal = await Personal.create({
        id: validUUID, // Generar UUID válido en lugar de usar homeAccountId
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.toLowerCase().trim(),
        privilegio_app: privilegioApp,
        activo: true,
        // Sin sede principal por defecto
        sede_id: null,
        // Sin rol de sede por defecto
        rol_id: null
      }, { transaction });

      await transaction.commit();

      logger.info('Personal creado automáticamente por auto-provisioning:', {
        personalId: nuevoPersonal.id,
        email: nuevoPersonal.email,
        nombre: nuevoPersonal.nombre,
        apellido: nuevoPersonal.apellido,
        privilegioAsignado: privilegioApp
      });

      return nuevoPersonal;
    } catch (error) {
      await transaction.rollback();

      logger.error('Error en auto-provisioning de personal:', {
        email,
        error: error.message,
        stack: error.stack
      });

      // No fallar la autenticación si hay error en provisioning
      // Solo loguear la advertencia
      logger.warn('Continuando con autenticación a pesar del error de auto-provisioning', {
        email,
        error: error.message
      });

      return null; // Retornar null pero no fallar la autenticación
    }
  }
}

module.exports = new PersonalService();
