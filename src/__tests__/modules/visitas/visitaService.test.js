// src/__tests__/modules/visitas/visitaService.test.js
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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
  fn: jest.fn((fn, col) => ({ fn, col })),
  col: jest.fn((col) => ({ col })),
  literal: jest.fn((literal) => ({ literal })),
};

// Mock de modelos
const modelsPath = resolve(__dirname, '../../../models/index.js');
await jest.unstable_mockModule(modelsPath, () => ({
  Visita: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn(),
  },
  VisitaRecurrencia: {
    create: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  VisitaSolicitudPrevia: {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  },
  VisitaInforme: {
    create: jest.fn(),
    update: jest.fn(),
    findByPk: jest.fn(),
  },
  VisitaProblemaResuelto: {
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
  },
  VisitaChecklistItem: {
    findAll: jest.fn(),
  },
  Sede: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  Personal: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
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

// Mock de AuditService
const auditPath = resolve(__dirname, '../../../shared/services/auditService.js');
await jest.unstable_mockModule(auditPath, () => ({
  default: {
    registrarAccion: jest.fn(() => Promise.resolve())
  }
}));

// Mock de emailService
const emailServicePath = resolve(__dirname, '../../../modules/visitas/services/emailService.js');
await jest.unstable_mockModule(emailServicePath, () => ({
  default: {
    enviarMinuta: jest.fn(() => Promise.resolve()),
    enviarNotificacionCancelacion: jest.fn(() => Promise.resolve()),
    enviarNotificacionReprogramacion: jest.fn(() => Promise.resolve())
  }
}));

// Importar módulos mockeados
const servicePath = resolve(__dirname, '../../../modules/visitas/services/visitaService.js');
const { default: visitaService } = await import(servicePath);
const {
  Visita,
  VisitaRecurrencia,
  VisitaSolicitudPrevia,
  VisitaInforme,
  VisitaProblemaResuelto,
  Sede,
  Personal,
  sequelize
} = await import(modelsPath);

describe('VisitaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe('listar()', () => {
    it('debe listar visitas con paginación por defecto', async () => {
      const mockVisitas = [
        { id: 'uuid-1', fecha: '2025-01-20', tipo: 'preventiva', estado: 'programada' },
        { id: 'uuid-2', fecha: '2025-01-21', tipo: 'correctiva', estado: 'realizada' }
      ];

      Visita.findAndCountAll = jest.fn().mockResolvedValue({
        count: 2,
        rows: mockVisitas
      });

      const result = await visitaService.listar();

      expect(result.visitas).toEqual(mockVisitas);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('debe aplicar filtros correctamente', async () => {
      Visita.findAndCountAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });

      await visitaService.listar({
        sede_id: 'uuid-sede',
        tecnico_id: 'uuid-tecnico',
        estado: 'programada',
        tipo: 'preventiva'
      });

      expect(Visita.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sede_id: 'uuid-sede',
            tecnico_asignado_id: 'uuid-tecnico',
            estado: 'programada',
            tipo: 'preventiva'
          })
        })
      );
    });

    it('debe aplicar paginación personalizada', async () => {
      Visita.findAndCountAll = jest.fn().mockResolvedValue({ count: 50, rows: [] });

      const result = await visitaService.listar({}, { page: 2, limit: 10 });

      expect(Visita.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10
        })
      );
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  describe('obtenerPorId()', () => {
    it('debe retornar visita con todas las relaciones', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        fecha: '2025-01-20',
        sedePrincipal: { nombre_sede: 'Sede A' },
        tecnicoAsignado: { nombre: 'Juan' }
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);

      const result = await visitaService.obtenerPorId('uuid-visita');

      expect(result).toEqual(mockVisita);
      expect(Visita.findByPk).toHaveBeenCalledWith('uuid-visita', expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: Sede, as: 'sedePrincipal' }),
          expect.objectContaining({ model: Personal, as: 'tecnicoAsignado' })
        ])
      }));
    });

    it('debe lanzar error si la visita no existe', async () => {
      Visita.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        visitaService.obtenerPorId('uuid-inexistente')
      ).rejects.toThrow('Visita no encontrada');
    });
  });

  describe('crear()', () => {
    it('debe crear visita simple sin recurrencia', async () => {
      const datosVisita = {
        sede_id: 'uuid-sede',
        tecnico_asignado_id: 'uuid-tecnico',
        fecha: '2025-01-25',
        tipo: 'preventiva',
        motivo: 'Mantenimiento mensual',
        es_recurrente: false
      };

      const mockVisitaCreada = { id: 'uuid-nueva', ...datosVisita };
      Visita.create = jest.fn().mockResolvedValue(mockVisitaCreada);

      const result = await visitaService.crear(datosVisita, 'uuid-usuario');

      expect(result.visita).toEqual(mockVisitaCreada);
      expect(result.instanciasAdicionales).toBe(0);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(VisitaRecurrencia.create).not.toHaveBeenCalled();
    });

    it('debe crear visita recurrente con instancias futuras', async () => {
      const datosVisita = {
        sede_id: 'uuid-sede',
        tecnico_asignado_id: 'uuid-tecnico',
        fecha: '2025-01-25',
        tipo: 'preventiva',
        motivo: 'Mantenimiento quincenal',
        es_recurrente: true,
        frecuencia: 'quincenal'
      };

      const mockRecurrencia = { id: 'uuid-recurrencia', ...datosVisita };
      const mockVisitaCreada = { id: 'uuid-nueva', recurrencia_id: 'uuid-recurrencia', ...datosVisita };

      VisitaRecurrencia.create = jest.fn().mockResolvedValue(mockRecurrencia);
      VisitaRecurrencia.findByPk = jest.fn().mockResolvedValue(mockRecurrencia);
      Visita.create = jest.fn().mockResolvedValue(mockVisitaCreada);
      Visita.bulkCreate = jest.fn().mockResolvedValue([]);

      const result = await visitaService.crear(datosVisita, 'uuid-usuario');

      expect(VisitaRecurrencia.create).toHaveBeenCalled();
      expect(result.visita.recurrencia_id).toBe('uuid-recurrencia');
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe hacer rollback si falla la creación', async () => {
      Visita.create = jest.fn().mockRejectedValue(new Error('Error de base de datos'));

      await expect(
        visitaService.crear({ sede_id: 'uuid', fecha: '2025-01-25' }, 'uuid-usuario')
      ).rejects.toThrow('Error de base de datos');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('actualizar()', () => {
    it('debe actualizar una visita individual', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        fecha: '2025-01-20',
        tipo: 'preventiva',
        estado: 'programada',
        recurrencia_id: null,
        update: jest.fn().mockResolvedValue(true)
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);

      const result = await visitaService.actualizar(
        'uuid-visita',
        { motivo: 'Motivo actualizado' },
        'uuid-usuario'
      );

      expect(mockVisita.update).toHaveBeenCalledWith(
        { motivo: 'Motivo actualizado' },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si la visita no existe', async () => {
      Visita.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        visitaService.actualizar('uuid-inexistente', {}, 'uuid-usuario')
      ).rejects.toThrow('Visita no encontrada');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('marcarRealizada()', () => {
    it('debe marcar visita como realizada y crear informe', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        estado: 'programada',
        sedePrincipal: { nombre_sede: 'Sede A' },
        tecnicoAsignado: { nombre: 'Juan' },
        solicitudesPrevias: [],
        update: jest.fn().mockResolvedValue(true)
      };

      const mockInforme = {
        id: 'uuid-informe',
        setDataValue: jest.fn()
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);
      VisitaInforme.create = jest.fn().mockResolvedValue(mockInforme);
      Personal.findAll = jest.fn().mockResolvedValue([{ email: 'test@test.com' }]);

      const datosInforme = {
        checklist_items: ['item1', 'item2'],
        observaciones: 'Todo OK'
      };

      const result = await visitaService.marcarRealizada('uuid-visita', datosInforme, 'uuid-usuario');

      expect(mockVisita.update).toHaveBeenCalledWith(
        { estado: 'realizada' },
        { transaction: mockTransaction }
      );
      expect(VisitaInforme.create).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si la visita ya fue realizada', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        estado: 'realizada'
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);

      await expect(
        visitaService.marcarRealizada('uuid-visita', {}, 'uuid-usuario')
      ).rejects.toThrow('La visita ya fue realizada');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('cancelar()', () => {
    it('debe cancelar visita y registrar motivo', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        estado: 'programada',
        sedePrincipal: { nombre_sede: 'Sede A' },
        tecnicoAsignado: { nombre: 'Juan' },
        update: jest.fn().mockResolvedValue(true)
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);
      Personal.findAll = jest.fn().mockResolvedValue([]);

      await visitaService.cancelar('uuid-visita', 'Cliente no disponible', 'uuid-usuario');

      expect(mockVisita.update).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'cancelada',
          motivo_cancelacion: 'Cliente no disponible'
        }),
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si la visita ya fue realizada', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        estado: 'realizada'
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);

      await expect(
        visitaService.cancelar('uuid-visita', 'Motivo', 'uuid-usuario')
      ).rejects.toThrow('No se puede cancelar una visita que ya fue realizada');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('reprogramar()', () => {
    it('debe reprogramar visita a nueva fecha', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        fecha: '2025-01-20',
        estado: 'programada',
        sedePrincipal: { nombre_sede: 'Sede A' },
        tecnicoAsignado: { nombre: 'Juan' },
        update: jest.fn().mockResolvedValue(true)
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);
      Personal.findAll = jest.fn().mockResolvedValue([]);

      await visitaService.reprogramar('uuid-visita', '2025-01-25', 'uuid-usuario');

      expect(mockVisita.update).toHaveBeenCalledWith(
        expect.objectContaining({
          fecha: '2025-01-25',
          estado: 'programada'
        }),
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si la visita ya fue realizada', async () => {
      Visita.findByPk = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'realizada'
      });

      await expect(
        visitaService.reprogramar('uuid-visita', '2025-01-25', 'uuid-usuario')
      ).rejects.toThrow('No se puede reprogramar una visita que ya fue realizada');
    });

    it('debe lanzar error si la visita está cancelada', async () => {
      Visita.findByPk = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'cancelada'
      });

      await expect(
        visitaService.reprogramar('uuid-visita', '2025-01-25', 'uuid-usuario')
      ).rejects.toThrow('No se puede reprogramar una visita cancelada');
    });
  });

  describe('eliminar()', () => {
    it('debe eliminar visita individual futura', async () => {
      const fechaFutura = new Date();
      fechaFutura.setDate(fechaFutura.getDate() + 5);
      const fechaStr = fechaFutura.toISOString().split('T')[0];

      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        fecha: fechaStr,
        estado: 'programada',
        recurrencia_id: null,
        destroy: jest.fn().mockResolvedValue(true)
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);

      const result = await visitaService.eliminar('uuid-visita', false, 'uuid-usuario');

      expect(mockVisita.destroy).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.message).toBe('Visita eliminada correctamente');
    });

    it('debe lanzar error si la visita ya fue realizada', async () => {
      Visita.findByPk = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'realizada',
        fecha: '2025-01-20'
      });

      await expect(
        visitaService.eliminar('uuid-visita', false, 'uuid-usuario')
      ).rejects.toThrow('No se puede eliminar una visita que ya fue realizada');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('debe lanzar error si la visita tiene fecha pasada', async () => {
      const fechaPasada = new Date();
      fechaPasada.setDate(fechaPasada.getDate() - 5);
      const fechaStr = fechaPasada.toISOString().split('T')[0];

      Visita.findByPk = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'programada',
        fecha: fechaStr
      });

      await expect(
        visitaService.eliminar('uuid-visita', false, 'uuid-usuario')
      ).rejects.toThrow('No se puede eliminar una visita con fecha pasada');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('debe eliminar serie completa cuando se solicita (solo futuras)', async () => {
      const fechaFutura = new Date();
      fechaFutura.setDate(fechaFutura.getDate() + 5);
      const fechaStr = fechaFutura.toISOString().split('T')[0];

      const mockVisita = {
        id: 'uuid-visita',
        sede_id: 'uuid-sede',
        fecha: fechaStr,
        estado: 'programada',
        recurrencia_id: 'uuid-recurrencia'
      };

      Visita.findByPk = jest.fn().mockResolvedValue(mockVisita);
      Visita.destroy = jest.fn().mockResolvedValue(5);
      Visita.count = jest.fn().mockResolvedValue(2);

      await visitaService.eliminar('uuid-visita', true, 'uuid-usuario');

      expect(Visita.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recurrencia_id: 'uuid-recurrencia',
            estado: 'programada'
          })
        })
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });

  describe('agregarSolicitud()', () => {
    it('debe agregar solicitud pre-visita con token válido', async () => {
      const mockVisita = {
        id: 'uuid-visita',
        estado: 'programada'
      };

      const mockSolicitud = {
        id: 'uuid-solicitud',
        visita_id: 'uuid-visita',
        descripcion: 'Revisar impresora'
      };

      Visita.findOne = jest.fn().mockResolvedValue(mockVisita);
      VisitaSolicitudPrevia.create = jest.fn().mockResolvedValue(mockSolicitud);

      const result = await visitaService.agregarSolicitud('token-valido', {
        nombre: 'Juan',
        email: 'juan@empresa.com',
        descripcion: 'Revisar impresora'
      });

      expect(result).toEqual(mockSolicitud);
      expect(VisitaSolicitudPrevia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visita_id: 'uuid-visita',
          descripcion: 'Revisar impresora'
        })
      );
    });

    it('debe lanzar error con token inválido', async () => {
      Visita.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        visitaService.agregarSolicitud('token-invalido', { descripcion: 'Test' })
      ).rejects.toThrow('Token inválido o visita no encontrada');
    });

    it('debe lanzar error si la visita ya fue realizada', async () => {
      Visita.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'realizada'
      });

      await expect(
        visitaService.agregarSolicitud('token-valido', { descripcion: 'Test' })
      ).rejects.toThrow('La visita ya fue realizada o cancelada');
    });
  });

  describe('obtenerCalendario()', () => {
    it('debe retornar visitas formateadas para calendario', async () => {
      const mockVisitas = [
        {
          id: 'uuid-1',
          fecha: '2025-01-15',
          tipo: 'preventiva',
          estado: 'programada',
          sedePrincipal: { nombre_sede: 'Sede A' },
          tecnicoAsignado: { id: 'uuid-tec', nombre: 'Juan', apellido: 'Pérez', color: '#ff0000' }
        }
      ];

      Visita.findAll = jest.fn().mockResolvedValue(mockVisitas);

      const result = await visitaService.obtenerCalendario(1, 2025);

      expect(result[0]).toEqual(expect.objectContaining({
        id: 'uuid-1',
        start: '2025-01-15',
        end: '2025-01-15',
        allDay: true,
        backgroundColor: '#ff0000'
      }));
    });

    it('debe filtrar por técnico si se proporciona', async () => {
      Visita.findAll = jest.fn().mockResolvedValue([]);

      await visitaService.obtenerCalendario(1, 2025, 'uuid-tecnico');

      const callArgs = Visita.findAll.mock.calls[0][0];
      expect(callArgs.where.tecnico_asignado_id).toBe('uuid-tecnico');
    });
  });

  describe('obtenerEstadisticas()', () => {
    it('debe retornar estadísticas completas', async () => {
      Visita.count = jest.fn().mockResolvedValue(100);
      Visita.findAll = jest.fn()
        .mockResolvedValueOnce([
          { estado: 'realizada', count: '60' },
          { estado: 'programada', count: '30' },
          { estado: 'cancelada', count: '10' }
        ])
        .mockResolvedValueOnce([
          { tipo: 'preventiva', count: '70' },
          { tipo: 'correctiva', count: '30' }
        ])
        .mockResolvedValueOnce([
          { nombre_sede: 'Sede A', count: '50' },
          { nombre_sede: 'Sede B', count: '50' }
        ]);
      VisitaProblemaResuelto.findAll = jest.fn().mockResolvedValue([
        { categoria: 'hardware', count: '20' },
        { categoria: 'software', count: '15' }
      ]);

      const result = await visitaService.obtenerEstadisticas('2025-01-01', '2025-01-31');

      expect(result.total).toBe(100);
      expect(result.visitas_realizadas).toBe(60);
      expect(result.visitas_canceladas).toBe(10);
      expect(result.visitas_pendientes).toBe(30);
    });
  });

  describe('obtenerPorTokenFeedback()', () => {
    it('debe retornar visita con token válido y dentro del plazo', async () => {
      const fechaReciente = new Date();
      fechaReciente.setHours(fechaReciente.getHours() - 12);

      const mockVisita = {
        id: 'uuid-visita',
        estado: 'realizada',
        sedePrincipal: { nombre_sede: 'Sede A' },
        tecnicoAsignado: { nombre: 'Juan' },
        informe: {
          id: 'uuid-informe',
          fecha_realizacion: fechaReciente.toISOString(),
          comentarios_responsable_sede: null
        }
      };

      Visita.findOne = jest.fn().mockResolvedValue(mockVisita);

      const result = await visitaService.obtenerPorTokenFeedback('token-valido');

      expect(result).toEqual(mockVisita);
    });

    it('debe lanzar error con token inválido', async () => {
      Visita.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        visitaService.obtenerPorTokenFeedback('token-invalido')
      ).rejects.toThrow('Token inválido o visita no encontrada');
    });

    it('debe lanzar error si la visita no está completada', async () => {
      Visita.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'programada'
      });

      await expect(
        visitaService.obtenerPorTokenFeedback('token-valido')
      ).rejects.toThrow('La visita aún no ha sido completada');
    });

    it('debe lanzar error si el plazo expiró (más de 2 días)', async () => {
      const fechaAntigua = new Date();
      fechaAntigua.setDate(fechaAntigua.getDate() - 5);

      Visita.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'realizada',
        informe: {
          fecha_realizacion: fechaAntigua.toISOString(),
          comentarios_responsable_sede: null
        }
      });

      await expect(
        visitaService.obtenerPorTokenFeedback('token-valido')
      ).rejects.toThrow('El plazo para agregar comentarios ha expirado');
    });

    it('debe lanzar error si ya hay comentarios', async () => {
      const fechaReciente = new Date();

      Visita.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-visita',
        estado: 'realizada',
        informe: {
          fecha_realizacion: fechaReciente.toISOString(),
          comentarios_responsable_sede: 'Ya comentado'
        }
      });

      await expect(
        visitaService.obtenerPorTokenFeedback('token-valido')
      ).rejects.toThrow('Ya se agregaron comentarios para esta visita');
    });
  });
});
