// src/__tests__/modules/proveedores/ejecutivoCuentasService.test.js
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
  EjecutivoCuentas: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn()
  },
  Proveedor: {
    findByPk: jest.fn()
  },
  TipoServicio: {
    findByPk: jest.fn()
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
const servicePath = resolve(__dirname, '../../../modules/proveedores/services/ejecutivoCuentasService.js');
const { default: ejecutivoCuentasService } = await import(servicePath);
const { EjecutivoCuentas, Proveedor, TipoServicio } = await import(modelsPath);

describe('EjecutivoCuentasService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    const mockEjecutivos = [
      { id: '1', nombre: 'Juan', email: 'juan@test.com', activo: true },
      { id: '2', nombre: 'María', email: 'maria@test.com', activo: true }
    ];

    beforeEach(() => {
      EjecutivoCuentas.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockEjecutivos,
        count: 2
      });
    });

    it('debe listar ejecutivos con paginación por defecto', async () => {
      const result = await ejecutivoCuentasService.listar({});

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
      await ejecutivoCuentasService.listar({ page: 2, limit: 5 });

      expect(EjecutivoCuentas.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por proveedor_id', async () => {
      await ejecutivoCuentasService.listar({ proveedor_id: 'uuid-prov' });

      expect(EjecutivoCuentas.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ proveedor_id: 'uuid-prov' })
        })
      );
    });

    it('debe filtrar por tipo_servicio_id', async () => {
      await ejecutivoCuentasService.listar({ tipo_servicio_id: 'uuid-tipo' });

      expect(EjecutivoCuentas.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tipo_servicio_id: 'uuid-tipo' })
        })
      );
    });

    it('debe filtrar por búsqueda (nombre, email)', async () => {
      await ejecutivoCuentasService.listar({ search: 'Juan' });

      expect(EjecutivoCuentas.findAndCountAll).toHaveBeenCalled();
      const callArgs = EjecutivoCuentas.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where).toBeDefined();
    });

    it('debe incluir relaciones (proveedor, tipoServicio)', async () => {
      await ejecutivoCuentasService.listar({});

      expect(EjecutivoCuentas.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: Proveedor, as: 'proveedor' }),
            expect.objectContaining({ model: TipoServicio, as: 'tipoServicio' })
          ])
        })
      );
    });

    it('debe mostrar solo activos por defecto', async () => {
      await ejecutivoCuentasService.listar({});

      expect(EjecutivoCuentas.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true })
        })
      );
    });
  });

  describe('obtenerPorId()', () => {
    const mockEjecutivo = {
      id: 'uuid-ejecutivo',
      nombre: 'Juan',
      email: 'juan@test.com',
      activo: true,
      toJSON: function() { return this; }
    };

    it('debe obtener ejecutivo por ID', async () => {
      EjecutivoCuentas.findByPk = jest.fn().mockResolvedValue(mockEjecutivo);

      const result = await ejecutivoCuentasService.obtenerPorId('uuid-ejecutivo');

      expect(result).toBeDefined();
      expect(EjecutivoCuentas.findByPk).toHaveBeenCalledWith('uuid-ejecutivo', expect.any(Object));
    });

    it('debe retornar null si el ejecutivo no existe', async () => {
      EjecutivoCuentas.findByPk = jest.fn().mockResolvedValue(null);

      const result = await ejecutivoCuentasService.obtenerPorId('uuid-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      proveedor_id: 'uuid-prov',
      tipo_servicio_id: 'uuid-tipo',
      nombre: 'Juan Pérez',
      email: 'juan@test.com',
      telefono: '123456789'
    };

    beforeEach(() => {
      Proveedor.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-prov', activo: true });
      TipoServicio.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });

      EjecutivoCuentas.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        ...datosNuevo
      });
    });

    it('debe crear ejecutivo exitosamente', async () => {
      const result = await ejecutivoCuentasService.crear(datosNuevo);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo');
      expect(EjecutivoCuentas.create).toHaveBeenCalled();
    });

    it('debe validar que el proveedor existe', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        ejecutivoCuentasService.crear(datosNuevo)
      ).rejects.toThrow('Proveedor no encontrado');
    });

    it('debe validar que el tipo de servicio existe si se proporciona', async () => {
      TipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        ejecutivoCuentasService.crear(datosNuevo)
      ).rejects.toThrow('Tipo de servicio no encontrado');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        ...datosNuevo,
        nombre: '  Juan Pérez  ',
        email: '  juan@test.com  '
      };

      await ejecutivoCuentasService.crear(datosConEspacios);

      expect(EjecutivoCuentas.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan Pérez',
          email: 'juan@test.com'
        }),
        expect.any(Object)
      );
    });

    it('debe permitir crear sin tipo_servicio_id', async () => {
      const datosSinTipo = {
        proveedor_id: 'uuid-prov',
        nombre: 'Juan Pérez',
        email: 'juan@test.com',
        telefono: '123456789'
      };

      await ejecutivoCuentasService.crear(datosSinTipo);

      expect(EjecutivoCuentas.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan Pérez',
          tipo_servicio_id: undefined
        }),
        expect.any(Object)
      );
    });
  });

  describe('actualizar()', () => {
    const ejecutivoId = 'uuid-ejecutivo';
    const datosActualizacion = {
      nombre: 'Juan Carlos Pérez',
      email: 'juancarlos@test.com'
    };

    let mockEjecutivo;

    beforeEach(() => {
      mockEjecutivo = {
        id: ejecutivoId,
        nombre: 'Juan Pérez',
        email: 'juan@test.com',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      EjecutivoCuentas.findByPk = jest.fn().mockResolvedValue(mockEjecutivo);
      Proveedor.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-prov', activo: true });
      TipoServicio.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });
    });

    it('debe actualizar ejecutivo exitosamente', async () => {
      const result = await ejecutivoCuentasService.actualizar(ejecutivoId, datosActualizacion);

      expect(result).toBeDefined();
      expect(mockEjecutivo.update).toHaveBeenCalled();
    });

    it('debe lanzar error si ejecutivo no existe', async () => {
      EjecutivoCuentas.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        ejecutivoCuentasService.actualizar(ejecutivoId, datosActualizacion)
      ).rejects.toThrow('Ejecutivo de cuentas no encontrado');
    });

    it('debe validar proveedor si se cambia', async () => {
      Proveedor.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        ejecutivoCuentasService.actualizar(ejecutivoId, { proveedor_id: 'uuid-nuevo' })
      ).rejects.toThrow('Proveedor no encontrado');
    });

    it('debe validar tipo de servicio si se cambia', async () => {
      TipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        ejecutivoCuentasService.actualizar(ejecutivoId, { tipo_servicio_id: 'uuid-nuevo' })
      ).rejects.toThrow('Tipo de servicio no encontrado');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        nombre: '  Juan Carlos Pérez  ',
        email: '  juancarlos@test.com  '
      };

      await ejecutivoCuentasService.actualizar(ejecutivoId, datosConEspacios);

      expect(mockEjecutivo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan Carlos Pérez',
          email: 'juancarlos@test.com'
        }),
        expect.any(Object)
      );
    });
  });

  describe('eliminar()', () => {
    const ejecutivoId = 'uuid-ejecutivo';

    let mockEjecutivo;

    beforeEach(() => {
      mockEjecutivo = {
        id: ejecutivoId,
        nombre: 'Juan Pérez',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      EjecutivoCuentas.findByPk = jest.fn().mockResolvedValue(mockEjecutivo);
    });

    it('debe eliminar ejecutivo exitosamente (soft delete)', async () => {
      const result = await ejecutivoCuentasService.eliminar(ejecutivoId);

      expect(result).toBe(true);
      expect(mockEjecutivo.update).toHaveBeenCalledWith(
        { activo: false },
        expect.any(Object)
      );
    });

    it('debe lanzar error si ejecutivo no existe', async () => {
      EjecutivoCuentas.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        ejecutivoCuentasService.eliminar(ejecutivoId)
      ).rejects.toThrow('Ejecutivo de cuentas no encontrado');
    });
  });
});
