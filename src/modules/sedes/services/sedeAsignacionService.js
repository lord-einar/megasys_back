// src/modules/sedes/services/sedeAsignacionService.js
const { SedeAsignacion, Sede, Personal, Rol } = require('../../../models');
const logger = require('../../../shared/utils/logger');

class SedeAsignacionService {
  /**
   * Asignar un técnico de soporte a una sede
   */
  async asignarTecnico(sedeId, personalId, notas = null) {
    try {
      // Validar que la sede existe
      const sede = await Sede.findByPk(sedeId);
      if (!sede) {
        throw new Error('La sede no existe');
      }

      // Validar que el personal existe
      const personal = await Personal.findByPk(personalId);
      if (!personal) {
        throw new Error('El personal no existe');
      }

      // Validar que el personal tiene grupo Soporte
      const personalConRol = await Personal.findByPk(personalId, {
        include: [{ model: Rol, as: 'rol', attributes: ['nombre'] }]
      });

      logger.info('Asignando técnico a sede:', {
        sedeId,
        personalId,
        personalNombre: personal.nombre
      });

      // Desactivar asignaciones previas de este personal a esta sede
      await SedeAsignacion.update(
        { activo: false, fecha_fin_asignacion: new Date() },
        {
          where: {
            sede_id: sedeId,
            personal_id: personalId,
            activo: true
          }
        }
      );

      // Crear nueva asignación
      const asignacion = await SedeAsignacion.create({
        sede_id: sedeId,
        personal_id: personalId,
        notas,
        activo: true
      });

      logger.info('Técnico asignado exitosamente:', {
        asignacionId: asignacion.id,
        sedeId,
        personalId
      });

      return asignacion;
    } catch (error) {
      logger.error('Error asignando técnico:', error);
      throw error;
    }
  }

  /**
   * Desasignar un técnico de una sede
   */
  async desasignarTecnico(sedeId, personalId) {
    try {
      logger.info('Desasignando técnico de sede:', {
        sedeId,
        personalId
      });

      const asignacion = await SedeAsignacion.findOne({
        where: {
          sede_id: sedeId,
          personal_id: personalId,
          activo: true
        }
      });

      if (!asignacion) {
        throw new Error('No hay asignación activa para desactivar');
      }

      await asignacion.update({
        activo: false,
        fecha_fin_asignacion: new Date()
      });

      logger.info('Técnico desasignado exitosamente:', {
        asignacionId: asignacion.id,
        sedeId,
        personalId
      });

      return asignacion;
    } catch (error) {
      logger.error('Error desasignando técnico:', error);
      throw error;
    }
  }

  /**
   * Obtener técnico asignado actualmente a una sede
   */
  async obtenerTecnicoAsignado(sedeId) {
    try {
      const asignacion = await SedeAsignacion.findOne({
        where: {
          sede_id: sedeId,
          activo: true
        },
        include: [
          {
            model: Personal,
            as: 'personal',
            attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
          }
        ]
      });

      return asignacion;
    } catch (error) {
      logger.error('Error obteniendo técnico asignado:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las asignaciones de una sede (incluyendo históricas)
   */
  async obtenerAsignacionesSede(sedeId, soloActivas = true) {
    try {
      const whereClause = { sede_id: sedeId };
      if (soloActivas) {
        whereClause.activo = true;
      }

      const asignaciones = await SedeAsignacion.findAll({
        where: whereClause,
        include: [
          {
            model: Personal,
            as: 'personal',
            attributes: ['id', 'nombre', 'apellido', 'email', 'telefono']
          }
        ],
        order: [['fecha_asignacion', 'DESC']]
      });

      return asignaciones;
    } catch (error) {
      logger.error('Error obteniendo asignaciones de sede:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las sedes asignadas a un técnico
   */
  async obtenerSedesAsignadas(personalId, soloActivas = true) {
    try {
      const whereClause = { personal_id: personalId };
      if (soloActivas) {
        whereClause.activo = true;
      }

      const asignaciones = await SedeAsignacion.findAll({
        where: whereClause,
        include: [
          {
            model: Sede,
            as: 'sede',
            attributes: ['id', 'nombre_sede', 'direccion', 'localidad', 'provincia']
          }
        ],
        order: [['fecha_asignacion', 'DESC']]
      });

      return asignaciones;
    } catch (error) {
      logger.error('Error obteniendo sedes asignadas:', error);
      throw error;
    }
  }

  /**
   * Listar todos los técnicos disponibles (grupo Soporte)
   */
  async obtenerTecnicosDisponibles() {
    try {
      const tecnicos = await Personal.findAll({
        attributes: ['id', 'nombre', 'apellido', 'email', 'telefono'],
        where: { activo: true },
        include: [
          {
            model: Rol,
            as: 'rol',
            attributes: ['nombre'],
            where: { nombre: 'Soporte' },
            required: false
          }
        ]
      });

      return tecnicos;
    } catch (error) {
      logger.error('Error obteniendo técnicos disponibles:', error);
      throw error;
    }
  }
}

module.exports = new SedeAsignacionService();
