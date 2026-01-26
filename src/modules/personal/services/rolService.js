// src/modules/personal/services/rolService.js
import Rol from '../../../models/Rol.js';
import Personal from '../../../models/Personal.js';
import { Op } from 'sequelize';
import logger from '../../../shared/utils/logger.js';

class RolService {
  /**
   * Listar todos los roles
   */
  async listar(filters = {}) {
    try {
      const { activo = null, search = '', includeHierarchy = true } = filters;

      const whereClause = {};

      // Filtrar por estado activo
      if (activo !== null) {
        whereClause.activo = activo === 'true' || activo === true;
      }

      // Búsqueda por nombre o descripción
      if (search && search.trim()) {
        whereClause[Op.or] = [
          { nombre: { [Op.iLike]: `%${search.trim()}%` } },
          { descripcion: { [Op.iLike]: `%${search.trim()}%` } }
        ];
      }

      const roles = await Rol.findAll({
        where: whereClause,
        include: includeHierarchy ? [
          {
            model: Rol,
            as: 'rolPadre',
            attributes: ['id', 'nombre']
          },
          {
            model: Rol,
            as: 'subRoles',
            attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia', 'activo'],
            include: [
              {
                model: Rol,
                as: 'subRoles',
                attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia', 'activo']
              }
            ]
          }
        ] : [],
        order: [['nivel_jerarquia', 'DESC'], ['nombre', 'ASC']],
        attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia', 'parent_id', 'activo']
      });

      return roles;
    } catch (err) {
      logger.error('Error al listar roles:', err);
      throw new Error(`Error al listar roles: ${err.message}`);
    }
  }

  /**
   * Obtener un rol por ID con estadísticas
   */
  async obtenerPorId(id) {
    try {
      const rol = await Rol.findByPk(id, {
        attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia', 'parent_id', 'activo', 'created_at', 'updated_at'],
        include: [
          {
            model: Rol,
            as: 'rolPadre',
            attributes: ['id', 'nombre']
          },
          {
            model: Rol,
            as: 'subRoles',
            attributes: ['id', 'nombre', 'descripcion', 'nivel_jerarquia', 'activo']
          }
        ]
      });

      if (!rol) {
        throw new Error('Rol no encontrado');
      }

      // Contar cuántos usuarios tienen este rol
      const totalPersonal = await Personal.count({
        where: { rol_id: id, activo: true }
      });

      return {
        ...rol.toJSON(),
        totalPersonal
      };
    } catch (err) {
      logger.error('Error al obtener rol:', err);
      throw new Error(`Error al obtener rol: ${err.message}`);
    }
  }

  /**
   * Crear un nuevo rol
   */
  async crear(data, options = {}) {
    try {
      const { nombre, descripcion, nivel_jerarquia, parent_id } = data;

      // Validar que el nombre no exista
      const rolExistente = await Rol.findOne({
        where: { nombre: { [Op.iLike]: nombre.trim() } }
      });

      if (rolExistente) {
        throw new Error(`El rol "${nombre}" ya existe`);
      }

      // Si tiene parent_id, validar que el rol padre exista
      if (parent_id) {
        const rolPadre = await Rol.findByPk(parent_id);
        if (!rolPadre) {
          throw new Error('El rol padre especificado no existe');
        }
      }

      const nuevoRol = await Rol.create(
        {
          nombre: nombre.trim(),
          descripcion: descripcion ? descripcion.trim() : null,
          nivel_jerarquia: nivel_jerarquia || 5, // Valor por defecto neutro
          parent_id: parent_id || null,
          activo: true
        },
        options
      );

      logger.info(`Rol creado: ${nuevoRol.nombre} (ID: ${nuevoRol.id})`);

      return nuevoRol;
    } catch (err) {
      logger.error('Error al crear rol:', err);
      throw new Error(`Error al crear rol: ${err.message}`);
    }
  }

  /**
   * Actualizar un rol existente
   */
  async actualizar(id, data, options = {}) {
    try {
      const rol = await Rol.findByPk(id);

      if (!rol) {
        throw new Error('Rol no encontrado');
      }

      // Si se está cambiando el nombre, validar que no exista otro rol con ese nombre
      if (data.nombre && data.nombre.trim() !== rol.nombre) {
        const rolExistente = await Rol.findOne({
          where: {
            nombre: { [Op.iLike]: data.nombre.trim() },
            id: { [Op.ne]: id }
          }
        });

        if (rolExistente) {
          throw new Error(`El rol "${data.nombre}" ya existe`);
        }
      }

      // Si se está cambiando el parent_id, validar
      if (data.parent_id !== undefined) {
        if (data.parent_id) {
          // Validar que el rol padre exista
          const rolPadre = await Rol.findByPk(data.parent_id);
          if (!rolPadre) {
            throw new Error('El rol padre especificado no existe');
          }

          // Evitar crear ciclos (un rol no puede ser su propio padre o descendiente)
          if (data.parent_id === id) {
            throw new Error('Un rol no puede ser su propio padre');
          }

          // Verificar que no se cree un ciclo en la jerarquía
          let currentParentId = data.parent_id;
          while (currentParentId) {
            const parentRol = await Rol.findByPk(currentParentId);
            if (!parentRol) break;
            if (parentRol.parent_id === id) {
              throw new Error('Esta operación crearía un ciclo en la jerarquía de roles');
            }
            currentParentId = parentRol.parent_id;
          }
        }
      }

      // Actualizar campos permitidos
      const camposActualizables = ['nombre', 'descripcion', 'nivel_jerarquia', 'parent_id', 'activo'];
      const datosActualizacion = {};

      camposActualizables.forEach(campo => {
        if (data[campo] !== undefined) {
          datosActualizacion[campo] = data[campo];
        }
      });

      await rol.update(datosActualizacion, options);

      logger.info(`Rol actualizado: ${rol.nombre} (ID: ${rol.id})`);

      return rol;
    } catch (err) {
      logger.error('Error al actualizar rol:', err);
      throw new Error(`Error al actualizar rol: ${err.message}`);
    }
  }

  /**
   * Eliminar un rol (soft delete)
   */
  async eliminar(id, options = {}) {
    try {
      const rol = await Rol.findByPk(id);

      if (!rol) {
        throw new Error('Rol no encontrado');
      }

      // Verificar si hay personal activo con este rol
      const personalConRol = await Personal.count({
        where: { rol_id: id, activo: true }
      });

      if (personalConRol > 0) {
        throw new Error(
          `No se puede eliminar el rol "${rol.nombre}" porque tiene ${personalConRol} persona(s) asignada(s). Por favor, reasigne el personal antes de eliminar el rol.`
        );
      }

      // Soft delete
      await rol.update({ activo: false }, options);

      logger.info(`Rol desactivado: ${rol.nombre} (ID: ${rol.id})`);

      return { mensaje: 'Rol desactivado correctamente' };
    } catch (err) {
      logger.error('Error al eliminar rol:', err);
      throw new Error(`Error al eliminar rol: ${err.message}`);
    }
  }

  /**
   * Obtener personal por rol
   */
  async obtenerPersonalPorRol(rolId) {
    try {
      const rol = await Rol.findByPk(rolId);

      if (!rol) {
        throw new Error('Rol no encontrado');
      }

      const personal = await Personal.findAll({
        where: { rol_id: rolId, activo: true },
        attributes: ['id', 'nombre', 'apellido', 'email', 'telefono'],
        order: [['apellido', 'ASC'], ['nombre', 'ASC']]
      });

      return {
        rol: {
          id: rol.id,
          nombre: rol.nombre,
          descripcion: rol.descripcion
        },
        personal,
        total: personal.length
      };
    } catch (err) {
      logger.error('Error al obtener personal por rol:', err);
      throw new Error(`Error al obtener personal por rol: ${err.message}`);
    }
  }

  /**
   * Asignar rol a un usuario
   */
  async asignarRolAPersonal(personalId, rolId, options = {}) {
    try {
      const personal = await Personal.findByPk(personalId);
      if (!personal) {
        throw new Error('Personal no encontrado');
      }

      const rol = await Rol.findByPk(rolId);
      if (!rol) {
        throw new Error('Rol no encontrado');
      }

      if (!rol.activo) {
        throw new Error('No se puede asignar un rol inactivo');
      }

      await personal.update({ rol_id: rolId }, options);

      logger.info(`Rol "${rol.nombre}" asignado a ${personal.nombre} ${personal.apellido}`);

      return await Personal.findByPk(personalId, {
        include: [{ model: Rol, as: 'rol', attributes: ['id', 'nombre', 'descripcion'] }]
      });
    } catch (err) {
      logger.error('Error al asignar rol:', err);
      throw new Error(`Error al asignar rol: ${err.message}`);
    }
  }
}

export default new RolService();
