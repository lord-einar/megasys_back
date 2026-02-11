// src/__tests__/modules/proveedores/servicioService.test.js
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
  QueryTypes: { SELECT: 'SELECT' },
  fn: jest.fn((fn, col) => ({ fn, col })),
  col: jest.fn((col) => ({ col })),
  literal: jest.fn((literal) => ({ literal }))
};

// Mock de modelos
const modelsPath = resolve(__dirname, '../../../models/index.js');
await jest.unstable_mockModule(modelsPath, () => ({
  Servicio: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn()
  },
  Proveedor: {
    findByPk: jest.fn(),
    findOne: jest.fn()
  },
  TipoServicio: {
    findByPk: jest.fn(),
    findOne: jest.fn()
  },
  SoporteNivel: {
    findAll: jest.fn()
  },
  Sede: {
    findByPk: jest.fn()
  },
  EquipoServicio: {
    create: jest.fn(),
    findAll: jest.fn()
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
const servicePath = resolve(__dirname, '../../../modules/proveedores/services/servicioService.js');
const { default: servicioService } = await import(servicePath);
const { Servicio, Proveedor, TipoServicio, EquipoServicio } = await import(modelsPath);

describe('ServicioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    const mockServicios = [
      { id: '1', nombre: 'Servicio A', proveedor_id: 'p1', activo: true },
      { id: '2', nombre: 'Servicio B', proveedor_id: 'p2', activo: true }
    ];

    beforeEach(() => {
      Servicio.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockServicios,
        count: 2
      });
    });

    it('debe listar servicios con paginación por defecto', async () => {
      const result = await servicioService.listar({});

      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      });
    });

    it('debe aplicar paginación personalizada', async () => {
      await servicioService.listar({ page: 2, limit: 5 });

      expect(Servicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por proveedor_id', async () => {
      await servicioService.listar({ proveedor_id: 'uuid-prov' });

      expect(Servicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ proveedor_id: 'uuid-prov' })
        })
      );
    });

    it('debe filtrar por tipo_servicio_id', async () => {
      await servicioService.listar({ tipo_servicio_id: 'uuid-tipo' });

      expect(Servicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tipo_servicio_id: 'uuid-tipo' })
        })
      );
    });

    it('debe filtrar por activo', async () => {
      await servicioService.listar({ activo: false });

      expect(Servicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: false })
        })
      );
    });

    it('debe incluir relaciones (proveedor, tipoServicio)', async () => {
      await servicioService.listar({});

      expect(Servicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: Proveedor, as: 'proveedor' }),
            expect.objectContaining({ model: TipoServicio, as: 'tipoServicio' })
          ])
        })
      );
    });
  });

  describe('obtenerConDetalles()', () => {
    const mockServicio = {
      id: 'uuid-servicio',
      nombre: 'Servicio Test',
      proveedor_id: 'uuid-prov',
      activo: true,
      toJSON: function() { return this; }
    };

    it('debe obtener servicio con detalles completos', async () => {
      Servicio.findByPk = jest.fn().mockResolvedValue(mockServicio);

      const result = await servicioService.obtenerConDetalles('uuid-servicio');

      expect(result).toBeDefined();
      expect(Servicio.findByPk).toHaveBeenCalledWith('uuid-servicio', expect.any(Object));
    });

    it('debe retornar null si el servicio no existe', async () => {
      Servicio.findByPk = jest.fn().mockResolvedValue(null);

      const result = await servicioService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      nombre: 'Nuevo Servicio',
      proveedor_id: 'uuid-prov',
      tipo_servicio_id: 'uuid-tipo',
      descripcion: 'Descripción del servicio',
      activo: true
    };

    beforeEach(() => {
      Proveedor.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-prov', activo: true });
      TipoServicio.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });

      Servicio.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        ...datosNuevo
      });

      jest.spyOn(servicioService, 'obtenerConDetalles').mockResolvedValue({
        id: 'uuid-nuevo',
        nombre: 'Nuevo Servicio'
      });
    });

    it('debe crear servicio exitosamente', async () => {
      const result = await servicioService.crear(datosNuevo);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo');
      expect(Servicio.create).toHaveBeenCalled();
    });

    it('debe validar que el proveedor existe', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        servicioService.crear(datosNuevo)
      ).rejects.toThrow('Proveedor no encontrado');
    });

    it('debe validar que el tipo de servicio existe', async () => {
      TipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        servicioService.crear(datosNuevo)
      ).rejects.toThrow('Tipo de servicio no encontrado');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        ...datosNuevo,
        nombre: '  Nuevo Servicio  ',
        descripcion: '  Descripción  '
      };

      await servicioService.crear(datosConEspacios);

      expect(Servicio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Nuevo Servicio',
          descripcion: 'Descripción'
        }),
        expect.any(Object)
      );
    });
  });

  describe('actualizar()', () => {
    const servicioId = 'uuid-servicio';
    const datosActualizacion = {
      nombre: 'Servicio Actualizado',
      descripcion: 'Nueva descripción'
    };

    let mockServicio;

    beforeEach(() => {
      mockServicio = {
        id: servicioId,
        nombre: 'Servicio Viejo',
        proveedor_id: 'uuid-prov',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      Servicio.findByPk = jest.fn().mockResolvedValue(mockServicio);
      Proveedor.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-prov', activo: true });
      TipoServicio.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });

      jest.spyOn(servicioService, 'obtenerConDetalles').mockResolvedValue({
        id: servicioId,
        nombre: 'Servicio Actualizado'
      });
    });

    it('debe actualizar servicio exitosamente', async () => {
      const result = await servicioService.actualizar(servicioId, datosActualizacion);

      expect(result).toBeDefined();
      expect(mockServicio.update).toHaveBeenCalled();
    });

    it('debe lanzar error si servicio no existe', async () => {
      Servicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        servicioService.actualizar(servicioId, datosActualizacion)
      ).rejects.toThrow('Servicio no encontrado');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        nombre: '  Servicio Actualizado  ',
        descripcion: '  Nueva descripción  '
      };

      await servicioService.actualizar(servicioId, datosConEspacios);

      expect(mockServicio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Servicio Actualizado',
          descripcion: 'Nueva descripción'
        }),
        expect.any(Object)
      );
    });
  });

  describe('eliminar()', () => {
    const servicioId = 'uuid-servicio';

    let mockServicio;

    beforeEach(() => {
      mockServicio = {
        id: servicioId,
        nombre: 'Servicio Test',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      Servicio.findByPk = jest.fn().mockResolvedValue(mockServicio);
      EquipoServicio.findAll = jest.fn().mockResolvedValue([]);
    });

    it('debe eliminar servicio exitosamente (soft delete)', async () => {
      const result = await servicioService.eliminar(servicioId);

      expect(result).toBe(true);
      expect(mockServicio.update).toHaveBeenCalledWith(
        { activo: false },
        expect.any(Object)
      );
    });

    it('debe lanzar error si servicio no existe', async () => {
      Servicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        servicioService.eliminar(servicioId)
      ).rejects.toThrow('Servicio no encontrado');
    });

    it('debe permitir eliminar servicio sin verificar equipos', async () => {
      const result = await servicioService.eliminar(servicioId);

      expect(result).toBe(true);
      expect(mockServicio.update).toHaveBeenCalledWith(
        { activo: false },
        expect.any(Object)
      );
    });
  });
});
