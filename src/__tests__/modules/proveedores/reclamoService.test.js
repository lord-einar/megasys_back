// src/__tests__/modules/proveedores/reclamoService.test.js
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
  col: jest.fn((col) => ({ col }))
};

// Mock de modelos
const modelsPath = resolve(__dirname, '../../../models/index.js');
await jest.unstable_mockModule(modelsPath, () => ({
  Reclamo: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  Servicio: {
    findByPk: jest.fn()
  },
  Sede: {
    findByPk: jest.fn()
  },
  EquipoServicio: {
    findByPk: jest.fn()
  },
  Personal: {
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
const servicePath = resolve(__dirname, '../../../modules/proveedores/services/reclamoService.js');
const { default: reclamoService } = await import(servicePath);
const { Reclamo, Servicio, Sede, EquipoServicio, Personal } = await import(modelsPath);

describe('ReclamoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    const mockReclamos = [
      { id: '1', titulo: 'Reclamo A', estado: 'abierto', prioridad: 'alta' },
      { id: '2', titulo: 'Reclamo B', estado: 'en_proceso', prioridad: 'media' }
    ];

    beforeEach(() => {
      Reclamo.findAndCountAll = jest.fn().mockResolvedValue({
        rows: mockReclamos,
        count: 2
      });
    });

    it('debe listar reclamos con paginación por defecto', async () => {
      const result = await reclamoService.listar({});

      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      });
    });

    it('debe filtrar por estado', async () => {
      await reclamoService.listar({ estado: 'abierto' });

      expect(Reclamo.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'abierto' })
        })
      );
    });

    it('debe filtrar por prioridad', async () => {
      await reclamoService.listar({ prioridad: 'alta' });

      expect(Reclamo.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ prioridad: 'alta' })
        })
      );
    });

    it('debe filtrar por servicio_id', async () => {
      await reclamoService.listar({ servicio_id: 'uuid-servicio' });

      expect(Reclamo.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ servicio_id: 'uuid-servicio' })
        })
      );
    });

    it('debe filtrar por sede_id', async () => {
      await reclamoService.listar({ sede_id: 'uuid-sede' });

      expect(Reclamo.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sede_id: 'uuid-sede' })
        })
      );
    });
  });

  describe('obtenerConDetalles()', () => {
    const mockReclamo = {
      id: 'uuid-reclamo',
      titulo: 'Reclamo Test',
      estado: 'abierto',
      toJSON: function() { return this; }
    };

    it('debe obtener reclamo con detalles completos', async () => {
      Reclamo.findByPk = jest.fn().mockResolvedValue(mockReclamo);

      const result = await reclamoService.obtenerConDetalles('uuid-reclamo');

      expect(result).toBeDefined();
      expect(Reclamo.findByPk).toHaveBeenCalledWith('uuid-reclamo', expect.any(Object));
    });

    it('debe retornar null si el reclamo no existe', async () => {
      Reclamo.findByPk = jest.fn().mockResolvedValue(null);

      const result = await reclamoService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      titulo: 'Nuevo Reclamo',
      descripcion: 'Descripción del reclamo',
      servicio_id: 'uuid-servicio',
      sede_id: 'uuid-sede',
      prioridad: 'alta'
    };

    beforeEach(() => {
      Servicio.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-servicio', activo: true });
      Sede.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-sede', activo: true });
      Reclamo.count = jest.fn().mockResolvedValue(5);

      Reclamo.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        numero_reclamo: 'REC-000006',
        ...datosNuevo
      });

      jest.spyOn(reclamoService, 'obtenerConDetalles').mockResolvedValue({
        id: 'uuid-nuevo',
        numero_reclamo: 'REC-000006'
      });
    });

    it('debe crear reclamo exitosamente', async () => {
      const result = await reclamoService.crear(datosNuevo);

      expect(result).toBeDefined();
      expect(result.numero_reclamo).toBe('REC-000006');
      expect(Reclamo.create).toHaveBeenCalled();
    });

    it('debe generar número de reclamo automáticamente', async () => {
      await reclamoService.crear(datosNuevo);

      expect(Reclamo.count).toHaveBeenCalled();
      expect(Reclamo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          numero_reclamo: 'REC-000006'
        }),
        expect.any(Object)
      );
    });

    it('debe validar que el servicio existe', async () => {
      Servicio.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        reclamoService.crear(datosNuevo)
      ).rejects.toThrow('Servicio no encontrado');
    });

    it('debe validar que la sede existe', async () => {
      Sede.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        reclamoService.crear(datosNuevo)
      ).rejects.toThrow('Sede no encontrada');
    });
  });

  describe('cambiarEstado()', () => {
    const reclamoId = 'uuid-reclamo';
    const nuevoEstado = 'resuelto';

    let mockReclamo;

    beforeEach(() => {
      mockReclamo = {
        id: reclamoId,
        titulo: 'Reclamo Test',
        estado: 'en_proceso',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: function() { return this; }
      };

      Reclamo.findByPk = jest.fn().mockResolvedValue(mockReclamo);
    });

    it('debe cambiar estado exitosamente', async () => {
      const result = await reclamoService.cambiarEstado(reclamoId, nuevoEstado);

      expect(result).toBeDefined();
      expect(mockReclamo.update).toHaveBeenCalledWith(
        expect.objectContaining({ estado: nuevoEstado }),
        expect.any(Object)
      );
    });

    it('debe lanzar error si reclamo no existe', async () => {
      Reclamo.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        reclamoService.cambiarEstado(reclamoId, nuevoEstado)
      ).rejects.toThrow('Reclamo no encontrado');
    });

    it('debe cambiar estado sin validar si es igual', async () => {
      await reclamoService.cambiarEstado(reclamoId, 'en_proceso');

      expect(mockReclamo.update).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'en_proceso' }),
        expect.any(Object)
      );
    });

    it('debe actualizar solo el estado', async () => {
      await reclamoService.cambiarEstado(reclamoId, 'resuelto');

      expect(mockReclamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'resuelto'
        }),
        expect.any(Object)
      );
    });
  });

  describe('asignarTecnico()', () => {
    const reclamoId = 'uuid-reclamo';
    const tecnicoId = 'uuid-tecnico';

    let mockReclamo;

    beforeEach(() => {
      mockReclamo = {
        id: reclamoId,
        titulo: 'Reclamo Test',
        asignado_a_id: null,
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: function() { return this; }
      };

      Reclamo.findByPk = jest.fn().mockResolvedValue(mockReclamo);
      Personal.findByPk = jest.fn().mockResolvedValue({ id: tecnicoId, activo: true });
    });

    it('debe asignar técnico exitosamente', async () => {
      const result = await reclamoService.asignarTecnico(reclamoId, tecnicoId);

      expect(result).toBeDefined();
      expect(mockReclamo.update).toHaveBeenCalledWith(
        expect.objectContaining({ asignado_a_id: tecnicoId }),
        expect.any(Object)
      );
    });

    it('debe lanzar error si reclamo no existe', async () => {
      Reclamo.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        reclamoService.asignarTecnico(reclamoId, tecnicoId)
      ).rejects.toThrow('Reclamo no encontrado');
    });

    it('debe lanzar error si técnico no existe', async () => {
      Personal.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        reclamoService.asignarTecnico(reclamoId, tecnicoId)
      ).rejects.toThrow('Técnico no encontrado');
    });
  });

  describe('obtenerEstadisticas()', () => {
    beforeEach(() => {
      Reclamo.findAll = jest.fn()
        .mockResolvedValueOnce([
          { estado: 'abierto', total: '10' },
          { estado: 'en_proceso', total: '5' },
          { estado: 'resuelto', total: '3' }
        ])
        .mockResolvedValueOnce([
          { prioridad: 'critica', total: '3' },
          { prioridad: 'alta', total: '5' },
          { prioridad: 'media', total: '8' },
          { prioridad: 'baja', total: '2' }
        ]);
    });

    it('debe obtener estadísticas completas', async () => {
      const result = await reclamoService.obtenerEstadisticas();

      expect(result.porEstado).toBeDefined();
      expect(result.porPrioridad).toBeDefined();
      expect(result.porEstado.abierto).toBe(10);
      expect(result.porPrioridad.critica).toBe(3);
    });

    it('debe contar reclamos por estado', async () => {
      const result = await reclamoService.obtenerEstadisticas();

      expect(Reclamo.findAll).toHaveBeenCalled();
      expect(result.porEstado).toBeDefined();
      expect(result.porEstado.abierto).toBe(10);
      expect(result.porEstado.en_proceso).toBe(5);
    });
  });
});
