// src/__tests__/modules/proveedores/proveedorService.test.js
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
  Proveedor: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn()
  },
  EjecutivoCuentas: {
    findAll: jest.fn()
  },
  Servicio: {
    findAll: jest.fn(),
    count: jest.fn()
  },
  TipoServicio: {
    findAll: jest.fn()
  },
  SoporteNivel: {
    findAll: jest.fn()
  },
  sequelize: mockSequelize
}));

// Mock de TransactionWrapper
const transactionWrapperPath = resolve(__dirname, '../../../shared/utils/transactionWrapper.js');
await jest.unstable_mockModule(transactionWrapperPath, () => ({
  default: {
    execute: jest.fn(async ({ operation }) => {
      const result = await operation(mockTransaction);
      return { data: result };
    })
  }
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
const servicePath = resolve(__dirname, '../../../modules/proveedores/services/proveedorService.js');
const { default: proveedorService } = await import(servicePath);
const { Proveedor, EjecutivoCuentas, Servicio, TipoServicio } = await import(modelsPath);
const { default: TransactionWrapper } = await import(transactionWrapperPath);

describe('ProveedorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    const mockProveedores = [
      { id: '1', empresa: 'Proveedor A', activo: true },
      { id: '2', empresa: 'Proveedor B', activo: true }
    ];

    beforeEach(() => {
      Proveedor.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockProveedores,
        count: 2
      });
    });

    it('debe listar proveedores con paginación por defecto', async () => {
      const result = await proveedorService.listar({});

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
      await proveedorService.listar({ page: 2, limit: 5 });

      expect(Proveedor.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por búsqueda (search) solo por empresa', async () => {
      await proveedorService.listar({ search: 'Proveedor A' });

      expect(Proveedor.findAndCountAll).toHaveBeenCalled();
      const callArgs = Proveedor.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where).toBeDefined();
    });

    it('debe filtrar por activo', async () => {
      await proveedorService.listar({ activo: false });

      expect(Proveedor.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: false })
        })
      );
    });

    it('debe mostrar solo activos por defecto', async () => {
      await proveedorService.listar({});

      expect(Proveedor.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true })
        })
      );
    });

    it('debe incluir relaciones (ejecutivos)', async () => {
      await proveedorService.listar({});

      expect(Proveedor.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: EjecutivoCuentas, as: 'ejecutivos' })
          ])
        })
      );
    });
  });

  describe('obtenerConDetalles()', () => {
    const mockProveedor = {
      id: 'uuid-prov',
      empresa: 'Proveedor Test',
      activo: true,
      ejecutivos: [],
      servicios: [],
      soporteNiveles: [],
      toJSON: function () { return this; }
    };

    it('debe obtener proveedor con detalles completos', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(mockProveedor);

      const result = await proveedorService.obtenerConDetalles('uuid-prov');

      expect(result).toBeDefined();
      expect(Proveedor.findByPk).toHaveBeenCalledWith('uuid-prov', expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: EjecutivoCuentas }),
          expect.objectContaining({ model: Servicio })
        ])
      }));
    });

    it('debe retornar null si el proveedor no existe', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(null);

      const result = await proveedorService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      empresa: 'Nuevo Proveedor',
      direccion: 'Calle 123'
    };

    beforeEach(() => {
      Proveedor.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        ...datosNuevo
      });

      jest.spyOn(proveedorService, 'obtenerConDetalles').mockResolvedValue({
        id: 'uuid-nuevo',
        empresa: 'Nuevo Proveedor'
      });
    });

    it('debe crear proveedor exitosamente solo con empresa', async () => {
      const result = await proveedorService.crear(datosNuevo);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo');
      expect(Proveedor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          empresa: 'Nuevo Proveedor',
          direccion: 'Calle 123'
        }),
        expect.any(Object)
      );
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        empresa: '  Nuevo Proveedor  ',
        direccion: '  Calle 123  '
      };

      await proveedorService.crear(datosConEspacios);

      expect(Proveedor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          empresa: 'Nuevo Proveedor',
          direccion: 'Calle 123'
        }),
        expect.any(Object)
      );
    });

    it('debe crear proveedor con solo empresa (sin dirección)', async () => {
      const datosSinDireccion = {
        empresa: 'Proveedor Mínimo'
      };

      await proveedorService.crear(datosSinDireccion);

      expect(Proveedor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          empresa: 'Proveedor Mínimo'
        }),
        expect.any(Object)
      );
    });
  });

  describe('actualizar()', () => {
    const proveedorId = 'uuid-prov';
    const datosActualizacion = {
      empresa: 'Proveedor Actualizado',
      direccion: 'Nueva Dirección'
    };

    let mockProveedor;

    beforeEach(() => {
      mockProveedor = {
        id: proveedorId,
        empresa: 'Proveedor Viejo',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      Proveedor.findByPk = jest.fn().mockResolvedValue(mockProveedor);

      jest.spyOn(proveedorService, 'obtenerConDetalles').mockResolvedValue({
        id: proveedorId,
        empresa: 'Proveedor Actualizado'
      });
    });

    it('debe actualizar proveedor exitosamente', async () => {
      const result = await proveedorService.actualizar(proveedorId, datosActualizacion);

      expect(result).toBeDefined();
      expect(mockProveedor.update).toHaveBeenCalled();
    });

    it('debe lanzar error si proveedor no existe', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        proveedorService.actualizar(proveedorId, datosActualizacion)
      ).rejects.toThrow('Proveedor no encontrado');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        empresa: '  Proveedor Actualizado  ',
        direccion: '  Nueva Dirección  '
      };

      await proveedorService.actualizar(proveedorId, datosConEspacios);

      expect(mockProveedor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          empresa: 'Proveedor Actualizado',
          direccion: 'Nueva Dirección'
        }),
        expect.any(Object)
      );
    });

  });

  describe('eliminar()', () => {
    const proveedorId = 'uuid-prov';

    let mockProveedor;

    beforeEach(() => {
      mockProveedor = {
        id: proveedorId,
        empresa: 'Proveedor Test',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      Proveedor.findByPk = jest.fn().mockResolvedValue(mockProveedor);
      Servicio.count = jest.fn().mockResolvedValue(0);
    });

    it('debe eliminar proveedor exitosamente (soft delete)', async () => {
      const result = await proveedorService.eliminar(proveedorId);

      expect(result).toBe(true);
      expect(mockProveedor.update).toHaveBeenCalledWith(
        { activo: false },
        expect.any(Object)
      );
    });

    it('debe lanzar error si proveedor no existe', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        proveedorService.eliminar(proveedorId)
      ).rejects.toThrow('Proveedor no encontrado');
    });

    it('debe marcar activo=false', async () => {
      await proveedorService.eliminar(proveedorId);

      expect(mockProveedor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          activo: false
        }),
        expect.any(Object)
      );
    });

  });

  describe('obtenerEstadisticas()', () => {
    beforeEach(() => {
      Proveedor.findAll = jest.fn()
        .mockResolvedValueOnce([{ activo: true }])
        .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);

      Servicio.count = jest.fn().mockResolvedValue(5);
    });

    it('debe obtener estadísticas completas', async () => {
      const result = await proveedorService.obtenerEstadisticas();

      expect(result.proveedores).toBeDefined();
      expect(result.servicios).toBeDefined();
      expect(result.proveedores.total).toBeDefined();
      expect(result.proveedores.activos).toBeDefined();
    });

    it('debe contar proveedores totales y activos', async () => {
      const result = await proveedorService.obtenerEstadisticas();

      expect(result.proveedores.total).toBeGreaterThanOrEqual(0);
      expect(result.proveedores.activos).toBeGreaterThanOrEqual(0);
    });

    it('debe contar servicios totales', async () => {
      const result = await proveedorService.obtenerEstadisticas();

      expect(result.servicios.total).toBeGreaterThanOrEqual(0);
    });
  });
});
