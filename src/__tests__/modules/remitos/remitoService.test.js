// src/__tests__/modules/remitos/remitoService.test.js

// IMPORTANTE: Mockear database ANTES de cualquier import
jest.mock('../../../shared/utils/database', () => ({
  sequelize: {
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' }
  }
}));

// Mock de modelos
jest.mock('../../../models', () => {
  const mockSequelize = {
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' }
  };

  return {
    Remito: {
      create: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn()
    },
    RemitoDetalle: {
      create: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    Inventario: {
      create: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn()
    },
    HistorialMovimiento: {
      create: jest.fn(),
      findAll: jest.fn()
    },
    Personal: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    Sede: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    sequelize: mockSequelize
  };
});

// Mock de servicios externos
jest.mock('../../../shared/services/pdfService');
jest.mock('../../../shared/services/emailService');
jest.mock('../../../shared/services/auditService');

const remitoService = require('../../../modules/remitos/services/remitoService');
const { Remito, RemitoDetalle, Inventario, HistorialMovimiento, Personal, Sede, sequelize } = require('../../../models');

describe('RemitoService', () => {
  let mockTransaction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock de transacción
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };

    sequelize.transaction = jest.fn().mockResolvedValue(mockTransaction);
    sequelize.query = jest.fn();
  });

  describe('crear()', () => {
    const validDatos = {
      solicitante_id: 'uuid-solicitante',
      tecnico_id: 'uuid-tecnico',
      sede_origen_id: 'uuid-sede-origen',
      sede_destino_id: 'uuid-sede-destino',
      fecha: '2025-01-15',
      observaciones: 'Test remito',
      articulos: [
        { inventario_id: 'uuid-inventario-1', es_prestamo: false },
        { inventario_id: 'uuid-inventario-2', es_prestamo: true, fecha_devolucion_esperada: '2025-02-15' }
      ]
    };

    const usuarioEmail = 'test@megatlon.com.ar';

    beforeEach(() => {
      // Mock de validaciones - usar findOne porque el servicio lo usa
      Personal.findOne = jest.fn().mockResolvedValue({ id: 'uuid-personal', activo: true });
      Sede.findOne = jest.fn().mockResolvedValue({ id: 'uuid-sede', activo: true });
      Inventario.findByPk = jest.fn().mockResolvedValue({
        id: 'uuid-inventario',
        sede_id: 'uuid-sede-origen',
        estado: 'disponible'
      });

      // Mock de búsqueda de remitos activos
      RemitoDetalle.findOne = jest.fn().mockResolvedValue(null);

      // Mock de generación de número de remito
      sequelize.query.mockResolvedValueOnce([[{ numero: 1 }]]);

      // Mock de creación de remito
      Remito.create = jest.fn().mockResolvedValue({
        id: 'uuid-remito',
        numero_remito: 'REM-2025-001',
        estado: 'preparado',
        toJSON: () => ({ id: 'uuid-remito', numero_remito: 'REM-2025-001' })
      });

      // Mock de creación de detalles
      RemitoDetalle.create = jest.fn().mockResolvedValue({
        id: 'uuid-detalle',
        remito_id: 'uuid-remito'
      });

      // Mock de actualización de inventario
      Inventario.update = jest.fn().mockResolvedValue([1]);

      // Mock de creación de historial
      HistorialMovimiento.create = jest.fn().mockResolvedValue({
        id: 'uuid-historial'
      });

      // Mock de obtener para el PDF/Email
      remitoService.obtener = jest.fn().mockResolvedValue({
        id: 'uuid-remito',
        numero_remito: 'REM-2025-001',
        toJSON: () => ({ id: 'uuid-remito', numero_remito: 'REM-2025-001' })
      });
    });

    it('debe crear un remito exitosamente con artículos válidos', async () => {
      const result = await remitoService.crear(validDatos, usuarioEmail);

      expect(result).toBeDefined();
      expect(result.numero_remito).toBe('REM-2025-001');
      expect(Remito.create).toHaveBeenCalledTimes(1);
      expect(RemitoDetalle.create).toHaveBeenCalledTimes(2);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si falta solicitante_id', async () => {
      const datosInvalidos = { ...validDatos, solicitante_id: null };

      await expect(remitoService.crear(datosInvalidos, usuarioEmail))
        .rejects.toThrow();
    });

    it('debe lanzar error si sede origen y destino son iguales', async () => {
      const datosInvalidos = {
        ...validDatos,
        sede_destino_id: validDatos.sede_origen_id
      };

      await expect(remitoService.crear(datosInvalidos, usuarioEmail))
        .rejects.toThrow('La sede de origen y destino deben ser diferentes');
    });

    it('debe lanzar error si no hay artículos', async () => {
      const datosInvalidos = { ...validDatos, articulos: [] };

      await expect(remitoService.crear(datosInvalidos, usuarioEmail))
        .rejects.toThrow('Debes incluir al menos un artículo');
    });

    it('debe lanzar error si préstamo sin fecha de devolución', async () => {
      const datosInvalidos = {
        ...validDatos,
        articulos: [
          { inventario_id: 'uuid-inv', es_prestamo: true }
        ]
      };

      await expect(remitoService.crear(datosInvalidos, usuarioEmail))
        .rejects.toThrow('fecha de devolución es requerida para préstamos');
    });

    it('debe hacer rollback en caso de error', async () => {
      Remito.create.mockRejectedValueOnce(new Error('DB Error'));

      await expect(remitoService.crear(validDatos, usuarioEmail))
        .rejects.toThrow('DB Error');

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('debe actualizar estado del inventario correctamente para transferencia', async () => {
      await remitoService.crear(validDatos, usuarioEmail);

      // Verificar que se actualizó el primer artículo (no préstamo)
      expect(Inventario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'en_uso',
          sede_id: validDatos.sede_destino_id
        }),
        expect.any(Object)
      );
    });

    it('debe actualizar estado del inventario a "en_prestamo" sin cambiar sede', async () => {
      await remitoService.crear(validDatos, usuarioEmail);

      // Verificar que se actualizó el segundo artículo (préstamo)
      expect(Inventario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'en_prestamo'
        }),
        expect.any(Object)
      );
    });

    it('debe crear historial de movimiento para cada artículo', async () => {
      await remitoService.crear(validDatos, usuarioEmail);

      expect(HistorialMovimiento.create).toHaveBeenCalledTimes(2);
      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_movimiento: 'transferencia'
        }),
        expect.any(Object)
      );
      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_movimiento: 'prestamo'
        }),
        expect.any(Object)
      );
    });
  });

  describe('cambiarEstado()', () => {
    const remitoId = 'uuid-remito';
    const usuarioId = 'uuid-usuario';
    const options = {
      userRoles: ['Infraestructura'],
      usuarioEmail: 'admin@megatlon.com.ar'
    };

    beforeEach(() => {
      Remito.findByPk = jest.fn().mockResolvedValue({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        estado: 'preparado',
        tecnico_asignado_id: 'uuid-tecnico',
        update: jest.fn().mockResolvedValue({
          id: remitoId,
          estado: 'en_transito'
        })
      });
    });

    it('debe cambiar estado de "preparado" a "en_transito"', async () => {
      const result = await remitoService.cambiarEstado(
        remitoId,
        'en_transito',
        usuarioId,
        options
      );

      expect(result).toBeDefined();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si estado no es válido', async () => {
      await expect(
        remitoService.cambiarEstado(remitoId, 'estado_invalido', usuarioId, options)
      ).rejects.toThrow('no es válido');
    });

    it('debe lanzar error si transición no es permitida', async () => {
      Remito.findByPk.mockResolvedValueOnce({
        id: remitoId,
        estado: 'completado',
        tecnico_asignado_id: 'uuid-tecnico'
      });

      await expect(
        remitoService.cambiarEstado(remitoId, 'preparado', usuarioId, options)
      ).rejects.toThrow('No se puede cambiar');
    });

    it('debe permitir a Infraestructura cambiar cualquier remito', async () => {
      const result = await remitoService.cambiarEstado(
        remitoId,
        'en_transito',
        usuarioId,
        { ...options, userRoles: ['Infraestructura'] }
      );

      expect(result).toBeDefined();
    });

    it('debe permitir al técnico asignado cambiar su remito', async () => {
      const result = await remitoService.cambiarEstado(
        remitoId,
        'en_transito',
        'uuid-tecnico',
        { ...options, userRoles: [] }
      );

      expect(result).toBeDefined();
    });

    it('debe rechazar cambios de usuarios no autorizados', async () => {
      await expect(
        remitoService.cambiarEstado(
          remitoId,
          'en_transito',
          'uuid-otro-usuario',
          { userRoles: [], usuarioEmail: 'otro@test.com' }
        )
      ).rejects.toThrow('No tienes permisos');
    });

    it('debe hacer rollback si ocurre un error', async () => {
      Remito.findByPk.mockRejectedValueOnce(new Error('DB Error'));

      await expect(
        remitoService.cambiarEstado(remitoId, 'en_transito', usuarioId, options)
      ).rejects.toThrow();

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('validaciones', () => {
    describe('validarPersonaActiva()', () => {
      it('debe pasar si persona existe y está activa', async () => {
        Personal.findByPk = jest.fn().mockResolvedValue({
          id: 'uuid-persona',
          activo: true
        });

        await expect(
          remitoService.validarPersonaActiva('uuid-persona', 'Solicitante')
        ).resolves.not.toThrow();
      });

      it('debe lanzar error si persona no existe', async () => {
        Personal.findByPk = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarPersonaActiva('uuid-inexistente', 'Solicitante')
        ).rejects.toThrow('no existe');
      });

      it('debe lanzar error si persona está inactiva', async () => {
        Personal.findByPk = jest.fn().mockResolvedValue({
          id: 'uuid-persona',
          activo: false
        });

        await expect(
          remitoService.validarPersonaActiva('uuid-persona', 'Solicitante')
        ).rejects.toThrow('inactiva');
      });
    });

    describe('validarSedeActiva()', () => {
      it('debe pasar si sede existe y está activa', async () => {
        Sede.findByPk = jest.fn().mockResolvedValue({
          id: 'uuid-sede',
          activo: true
        });

        await expect(
          remitoService.validarSedeActiva('uuid-sede', 'Sede de origen')
        ).resolves.not.toThrow();
      });

      it('debe lanzar error si sede no existe', async () => {
        Sede.findByPk = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarSedeActiva('uuid-inexistente', 'Sede')
        ).rejects.toThrow('no existe');
      });
    });

    describe('validarInventarioDisponible()', () => {
      it('debe pasar si inventario está disponible en la sede', async () => {
        Inventario.findByPk = jest.fn().mockResolvedValue({
          id: 'uuid-inventario',
          sede_id: 'uuid-sede',
          estado: 'disponible'
        });

        await expect(
          remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-sede')
        ).resolves.not.toThrow();
      });

      it('debe lanzar error si inventario no existe', async () => {
        Inventario.findByPk = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarInventarioDisponible('uuid-inexistente', 'uuid-sede')
        ).rejects.toThrow('no existe');
      });

      it('debe lanzar error si inventario no está disponible', async () => {
        Inventario.findByPk = jest.fn().mockResolvedValue({
          id: 'uuid-inventario',
          sede_id: 'uuid-sede',
          estado: 'en_uso'
        });

        await expect(
          remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-sede')
        ).rejects.toThrow('no está disponible');
      });

      it('debe lanzar error si inventario está en otra sede', async () => {
        Inventario.findByPk = jest.fn().mockResolvedValue({
          id: 'uuid-inventario',
          sede_id: 'uuid-otra-sede',
          estado: 'disponible'
        });

        await expect(
          remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-sede')
        ).rejects.toThrow('no se encuentra en');
      });
    });
  });
});
