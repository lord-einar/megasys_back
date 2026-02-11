// src/__tests__/modules/proveedores/equipoServicioService.test.js
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
  EquipoServicio: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn()
  },
  Servicio: {
    findByPk: jest.fn()
  },
  Sede: {
    findByPk: jest.fn()
  },
  Reclamo: {
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
const servicePath = resolve(__dirname, '../../../modules/proveedores/services/equipoServicioService.js');
const { default: equipoServicioService } = await import(servicePath);
const { EquipoServicio, Servicio, Sede, Reclamo } = await import(modelsPath);

describe('EquipoServicioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    const mockEquipos = [
      { id: '1', mac: 'AA:BB:CC:DD:EE:FF', modelo: 'Modelo A', activo: true },
      { id: '2', mac: '11:22:33:44:55:66', modelo: 'Modelo B', activo: true }
    ];

    beforeEach(() => {
      EquipoServicio.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockEquipos,
        count: 2
      });
    });

    it('debe listar equipos con paginación por defecto', async () => {
      const result = await equipoServicioService.listar({});

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
      await equipoServicioService.listar({ page: 2, limit: 5 });

      expect(EquipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por servicio_id', async () => {
      await equipoServicioService.listar({ servicio_id: 'uuid-serv' });

      expect(EquipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ servicio_id: 'uuid-serv' })
        })
      );
    });

    it('debe filtrar por sede_id', async () => {
      await equipoServicioService.listar({ sede_id: 'uuid-sede' });

      expect(EquipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sede_id: 'uuid-sede' })
        })
      );
    });

    it('debe filtrar por búsqueda (MAC, modelo, marca)', async () => {
      await equipoServicioService.listar({ search: 'AA:BB' });

      expect(EquipoServicio.findAndCountAll).toHaveBeenCalled();
      const callArgs = EquipoServicio.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where).toBeDefined();
    });

    it('debe incluir relaciones (servicio, sede)', async () => {
      await equipoServicioService.listar({});

      expect(EquipoServicio.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: Servicio, as: 'servicio' }),
            expect.objectContaining({ model: Sede, as: 'sede' })
          ])
        })
      );
    });
  });

  describe('obtenerConDetalles()', () => {
    const mockEquipo = {
      id: 'uuid-equipo',
      mac: 'AA:BB:CC:DD:EE:FF',
      modelo: 'Modelo Test',
      activo: true,
      toJSON: function() { return this; }
    };

    it('debe obtener equipo con detalles completos', async () => {
      EquipoServicio.findByPk = jest.fn().mockResolvedValue(mockEquipo);

      const result = await equipoServicioService.obtenerConDetalles('uuid-equipo');

      expect(result).toBeDefined();
      expect(EquipoServicio.findByPk).toHaveBeenCalledWith('uuid-equipo', expect.any(Object));
    });

    it('debe retornar null si el equipo no existe', async () => {
      EquipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      const result = await equipoServicioService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });

    it('debe incluir reclamos en los detalles', async () => {
      EquipoServicio.findByPk = jest.fn().mockResolvedValue(mockEquipo);

      await equipoServicioService.obtenerConDetalles('uuid-equipo');

      expect(EquipoServicio.findByPk).toHaveBeenCalledWith(
        'uuid-equipo',
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: Reclamo, as: 'reclamos' })
          ])
        })
      );
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      servicio_id: 'uuid-servicio',
      sede_id: 'uuid-sede',
      mac: 'AA:BB:CC:DD:EE:FF',
      modelo: 'Modelo X',
      marca: 'Marca Y',
      numero_serie: 'SN12345',
      observaciones: 'Observaciones'
    };

    beforeEach(() => {
      Servicio.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-servicio', activo: true });
      Sede.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-sede', activo: true });

      EquipoServicio.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        ...datosNuevo
      });
    });

    it('debe crear equipo exitosamente', async () => {
      const result = await equipoServicioService.crear(datosNuevo);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo');
      expect(EquipoServicio.create).toHaveBeenCalled();
    });

    it('debe validar que el servicio existe', async () => {
      Servicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        equipoServicioService.crear(datosNuevo)
      ).rejects.toThrow('Servicio no encontrado');
    });

    it('debe validar que la sede existe', async () => {
      Sede.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        equipoServicioService.crear(datosNuevo)
      ).rejects.toThrow('Sede no encontrada');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        ...datosNuevo,
        mac: '  AA:BB:CC:DD:EE:FF  ',
        modelo: '  Modelo X  '
      };

      await equipoServicioService.crear(datosConEspacios);

      expect(EquipoServicio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mac: 'AA:BB:CC:DD:EE:FF',
          modelo: 'Modelo X'
        }),
        expect.any(Object)
      );
    });
  });

  describe('actualizar()', () => {
    const equipoId = 'uuid-equipo';
    const datosActualizacion = {
      modelo: 'Modelo Actualizado',
      marca: 'Marca Nueva'
    };

    let mockEquipo;

    beforeEach(() => {
      mockEquipo = {
        id: equipoId,
        mac: 'AA:BB:CC:DD:EE:FF',
        modelo: 'Modelo Viejo',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      EquipoServicio.findByPk = jest.fn().mockResolvedValue(mockEquipo);
    });

    it('debe actualizar equipo exitosamente', async () => {
      const result = await equipoServicioService.actualizar(equipoId, datosActualizacion);

      expect(result).toBeDefined();
      expect(mockEquipo.update).toHaveBeenCalled();
    });

    it('debe lanzar error si equipo no existe', async () => {
      EquipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        equipoServicioService.actualizar(equipoId, datosActualizacion)
      ).rejects.toThrow('Equipo no encontrado');
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        modelo: '  Modelo Actualizado  ',
        marca: '  Marca Nueva  '
      };

      await equipoServicioService.actualizar(equipoId, datosConEspacios);

      expect(mockEquipo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          modelo: 'Modelo Actualizado',
          marca: 'Marca Nueva'
        }),
        expect.any(Object)
      );
    });
  });

  describe('eliminar()', () => {
    const equipoId = 'uuid-equipo';

    let mockEquipo;

    beforeEach(() => {
      mockEquipo = {
        id: equipoId,
        mac: 'AA:BB:CC:DD:EE:FF',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined)
      };

      EquipoServicio.findByPk = jest.fn().mockResolvedValue(mockEquipo);
      Reclamo.count = jest.fn().mockResolvedValue(0);
    });

    it('debe eliminar equipo exitosamente (soft delete)', async () => {
      const result = await equipoServicioService.eliminar(equipoId);

      expect(result).toBe(true);
      expect(mockEquipo.update).toHaveBeenCalledWith(
        { activo: false },
        expect.any(Object)
      );
    });

    it('debe lanzar error si equipo no existe', async () => {
      EquipoServicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        equipoServicioService.eliminar(equipoId)
      ).rejects.toThrow('Equipo no encontrado');
    });

    it('debe verificar reclamos abiertos antes de eliminar', async () => {
      Reclamo.count = jest.fn().mockResolvedValue(2);

      await expect(
        equipoServicioService.eliminar(equipoId)
      ).rejects.toThrow('reclamo(s) abierto(s)');
    });
  });
});
