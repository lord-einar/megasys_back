// src/__tests__/modules/proveedores/tipoServicioService.test.js
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

const mockSequelize = {
  transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  query: jest.fn(),
  QueryTypes: { SELECT: 'SELECT' }
};

// Mock de modelos
const modelsPath = resolve(__dirname, '../../../models/index.js');
await jest.unstable_mockModule(modelsPath, () => ({
  TipoServicio: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn()
  },
  Servicio: {
    count: jest.fn()
  },
  sequelize: mockSequelize
}));

// Mock de logger
const loggerPath = resolve(__dirname, '../../../shared/utils/logger.js');
await jest.unstable_mockModule(loggerPath, () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Importar módulos mockeados
const servicePath = resolve(__dirname, '../../../modules/proveedores/services/tipoServicioService.js');
const { default: tipoServicioService } = await import(servicePath);
const { TipoServicio, Servicio } = await import(modelsPath);

describe('TipoServicioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    const mockTipos = [
      { id: '1', nombre: 'Internet', descripcion: 'Servicios de Internet', activo: true },
      { id: '2', nombre: 'Telefonía', descripcion: 'Servicios de Telefonía', activo: true }
    ];

    beforeEach(() => {
      TipoServicio.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockTipos,
        count: 2
      });
    });

    it('debe listar tipos con paginación por defecto', async () => {
      const result = await tipoServicioService.listar({});

      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1
      });
    });

    it('debe aplicar paginación personalizada', async () => {
      await tipoServicioService.listar({ page: 2, limit: 20 });

      expect(TipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 20
        })
      );
    });

    it('debe filtrar por búsqueda (nombre)', async () => {
      await tipoServicioService.listar({ search: 'Internet' });

      expect(TipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nombre: expect.any(Object)
          })
        })
      );
    });

    it('debe filtrar por activo', async () => {
      await tipoServicioService.listar({ activo: false });

      expect(TipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: false })
        })
      );
    });

    it('debe mostrar solo activos por defecto', async () => {
      await tipoServicioService.listar({});

      expect(TipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true })
        })
      );
    });

    it('debe ordenar por nombre ASC', async () => {
      await tipoServicioService.listar({});

      expect(TipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['nombre', 'ASC']]
        })
      );
    });
  });

  describe('obtenerPorId()', () => {
    it('debe obtener tipo por ID', async () => {
      const mockTipo = { id: 'uuid-tipo', nombre: 'Internet', activo: true };
      TipoServicio.findByPk = jest.fn().mockResolvedValue(mockTipo);

      const result = await tipoServicioService.obtenerPorId('uuid-tipo');

      expect(result).toBeDefined();
      expect(TipoServicio.findByPk).toHaveBeenCalledWith('uuid-tipo');
    });

    it('debe retornar null si el tipo no existe', async () => {
      TipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      const result = await tipoServicioService.obtenerPorId('uuid-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      nombre: 'Internet',
      descripcion: 'Servicios de Internet'
    };

    beforeEach(() => {
      TipoServicio.findOne = jest.fn().mockResolvedValue(null);
      TipoServicio.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        ...datosNuevo
      });
    });

    it('debe crear tipo exitosamente', async () => {
      const result = await tipoServicioService.crear(datosNuevo);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo');
      expect(TipoServicio.create).toHaveBeenCalled();
    });

    it('debe validar que no existe tipo con el mismo nombre', async () => {
      TipoServicio.findOne = jest.fn().mockResolvedValue({ id: 'uuid-existente', nombre: 'Internet' });

      await expect(
        tipoServicioService.crear(datosNuevo)
      ).rejects.toThrow('Ya existe un tipo de servicio con este nombre');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        nombre: '  Internet  ',
        descripcion: '  Servicios de Internet  '
      };

      await tipoServicioService.crear(datosConEspacios);

      expect(TipoServicio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Internet',
          descripcion: 'Servicios de Internet'
        }),
        expect.any(Object)
      );
    });
  });

  describe('actualizar()', () => {
    const tipoId = 'uuid-tipo';
    const datosActualizacion = {
      nombre: 'Internet Empresarial',
      descripcion: 'Nueva descripción'
    };

    let mockTipo;

    beforeEach(() => {
      mockTipo = {
        id: tipoId,
        nombre: 'Internet',
        descripcion: 'Servicios de Internet',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      TipoServicio.findByPk = jest.fn().mockResolvedValue(mockTipo);
      TipoServicio.findOne = jest.fn().mockResolvedValue(null);
    });

    it('debe actualizar tipo exitosamente', async () => {
      const result = await tipoServicioService.actualizar(tipoId, datosActualizacion);

      expect(result).toBeDefined();
      expect(mockTipo.update).toHaveBeenCalled();
    });

    it('debe lanzar error si tipo no existe', async () => {
      TipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        tipoServicioService.actualizar(tipoId, datosActualizacion)
      ).rejects.toThrow('Tipo de servicio no encontrado');
    });

    it('debe validar nombre único al actualizar', async () => {
      TipoServicio.findOne = jest.fn().mockResolvedValue({ id: 'uuid-otro', nombre: 'Internet Empresarial' });

      await expect(
        tipoServicioService.actualizar(tipoId, datosActualizacion)
      ).rejects.toThrow('Ya existe un tipo de servicio con este nombre');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        nombre: '  Internet Empresarial  ',
        descripcion: '  Nueva descripción  '
      };

      await tipoServicioService.actualizar(tipoId, datosConEspacios);

      expect(mockTipo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Internet Empresarial',
          descripcion: 'Nueva descripción'
        }),
        expect.any(Object)
      );
    });
  });

  describe('eliminar()', () => {
    const tipoId = 'uuid-tipo';

    let mockTipo;

    beforeEach(() => {
      mockTipo = {
        id: tipoId,
        nombre: 'Internet',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      TipoServicio.findByPk = jest.fn().mockResolvedValue(mockTipo);
      Servicio.count = jest.fn().mockResolvedValue(0);
    });

    it('debe eliminar tipo exitosamente (soft delete)', async () => {
      const result = await tipoServicioService.eliminar(tipoId);

      expect(result).toBe(true);
      expect(mockTipo.update).toHaveBeenCalledWith(
        { activo: false },
        expect.any(Object)
      );
    });

    it('debe lanzar error si tipo no existe', async () => {
      TipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        tipoServicioService.eliminar(tipoId)
      ).rejects.toThrow('Tipo de servicio no encontrado');
    });

    it('debe verificar servicios activos antes de eliminar', async () => {
      Servicio.count = jest.fn().mockResolvedValue(3);

      await expect(
        tipoServicioService.eliminar(tipoId)
      ).rejects.toThrow('servicio(s) activo(s)');
    });
  });
});
