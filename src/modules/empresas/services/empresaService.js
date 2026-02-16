// src/modules/empresas/services/empresaService.js
import { Op } from 'sequelize';
import Empresa from '../../../models/Empresa.js';
import logger from '../../../shared/utils/logger.js';

class EmpresaService {
  /**
   * Obtener todas las empresas activas
   */
  async getEmpresasActivas(filtros = {}) {
    try {
      const where = { activo: true };

      if (filtros.nombre) {
        where.nombre_empresa = {
          [Op.iLike]: `%${filtros.nombre}%`
        };
      }

      const empresas = await Empresa.findAll({
        where,
        order: [['nombre_empresa', 'ASC']]
      });

      logger.info('Empresas activas obtenidas', { cantidad: empresas.length });
      return empresas;
    } catch (error) {
      logger.error('Error obteniendo empresas activas:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las empresas (incluyendo inactivas)
   */
  async getTodasLasEmpresas(filtros = {}) {
    try {
      const where = {};

      if (filtros.nombre) {
        where.nombre_empresa = {
          [Op.iLike]: `%${filtros.nombre}%`
        };
      }

      if (filtros.activo !== undefined) {
        where.activo = filtros.activo;
      }

      const empresas = await Empresa.findAll({
        where,
        order: [['nombre_empresa', 'ASC']]
      });

      logger.info('Todas las empresas obtenidas', { cantidad: empresas.length });
      return empresas;
    } catch (error) {
      logger.error('Error obteniendo empresas:', error);
      throw error;
    }
  }

  /**
   * Obtener empresa por ID
   */
  async getEmpresaById(empresaId) {
    try {
      const empresa = await Empresa.findByPk(empresaId, {
        include: [{
          association: 'sedes',
          attributes: ['id', 'nombre_sede']
        }]
      });

      if (!empresa) {
        throw new Error('Empresa no encontrada');
      }

      logger.info('Empresa obtenida', { empresaId });
      return empresa;
    } catch (error) {
      logger.error('Error obteniendo empresa:', error);
      throw error;
    }
  }

  /**
   * Crear nueva empresa
   */
  async crearEmpresa(datosEmpresa, options = {}) {
    try {
      const empresa = await Empresa.create({
        nombre_empresa: datosEmpresa.nombre,
        rason_social: datosEmpresa.razonSocial,
        cuit: datosEmpresa.cuit,
        direccion: datosEmpresa.direccion,
        telefono: datosEmpresa.telefono,
        email: datosEmpresa.email,
        activo: datosEmpresa.activo !== false
      }, options);

      logger.info('Nueva empresa creada', { empresaId: empresa.id, nombre: empresa.nombre_empresa });
      return empresa;
    } catch (error) {
      logger.error('Error creando empresa:', error);
      throw error;
    }
  }

  /**
   * Actualizar empresa
   */
  async actualizarEmpresa(empresaId, datosEmpresa, options = {}) {
    try {
      const empresa = await Empresa.findByPk(empresaId, options);

      if (!empresa) {
        throw new Error('Empresa no encontrada');
      }

      await empresa.update({
        nombre_empresa: datosEmpresa.nombre || empresa.nombre_empresa,
        rason_social: datosEmpresa.razonSocial || empresa.rason_social,
        cuit: datosEmpresa.cuit || empresa.cuit,
        direccion: datosEmpresa.direccion || empresa.direccion,
        telefono: datosEmpresa.telefono || empresa.telefono,
        email: datosEmpresa.email || empresa.email,
        activo: datosEmpresa.activo !== undefined ? datosEmpresa.activo : empresa.activo
      }, options);

      logger.info('Empresa actualizada', { empresaId });
      return empresa;
    } catch (error) {
      logger.error('Error actualizando empresa:', error);
      throw error;
    }
  }

  /**
   * Eliminar empresa
   */
  async eliminarEmpresa(empresaId, options = {}) {
    try {
      const empresa = await Empresa.findByPk(empresaId, options);

      if (!empresa) {
        throw new Error('Empresa no encontrada');
      }

      await empresa.destroy(options);

      logger.info('Empresa eliminada', { empresaId });
      return { success: true, message: 'Empresa eliminada correctamente' };
    } catch (error) {
      logger.error('Error eliminando empresa:', error);
      throw error;
    }
  }
}

export default new EmpresaService();
