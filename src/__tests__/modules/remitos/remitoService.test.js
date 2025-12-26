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
      findAll: jest.fn(),
      count: jest.fn()
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
jest.mock('../../../shared/services/pdfService', () => ({
  generarPDF: jest.fn().mockResolvedValue({
    path: '/tmp/remito.pdf',
    buffer: Buffer.from('pdf-content')
  }),
  generarPDFRemito: jest.fn().mockResolvedValue({
    path: '/tmp/remito.pdf',
    buffer: Buffer.from('pdf-content')
  })
}));

jest.mock('../../../shared/services/emailService', () => ({
  enviarEmailConAdjuntos: jest.fn().mockResolvedValue(true),
  enviarEmail: jest.fn().mockResolvedValue(true),
  enviarAlReceptor: jest.fn().mockResolvedValue(true),
  enviarAlSolicitante: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../shared/services/tokenService', () => ({
  generarTokenConfirmacion: jest.fn().mockReturnValue('mock-confirmation-token'),
  generarUrlConfirmacion: jest.fn().mockReturnValue('https://megasys.com/confirmar/mock-token'),
  validarTokenConfirmacion: jest.fn()
}));

jest.mock('../../../shared/services/auditService', () => ({
  registrarActividad: jest.fn().mockResolvedValue({ id: 'uuid-auditoria' }),
  registrarAccion: jest.fn().mockResolvedValue({ id: 'uuid-auditoria' })
}));

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
      // Limpiar todos los mocks
      jest.clearAllMocks();

      // Mock de validaciones CON MÚLTIPLES LLAMADAS (solicitante y técnico)
      Personal.findOne = jest.fn()
        .mockResolvedValueOnce({ id: 'uuid-solicitante', activo: true })  // 1ra llamada
        .mockResolvedValueOnce({ id: 'uuid-tecnico', activo: true });     // 2da llamada

      // Mock de validaciones de sedes (origen y destino)
      Sede.findOne = jest.fn()
        .mockResolvedValueOnce({ id: 'uuid-sede-origen', activo: true })    // 1ra llamada
        .mockResolvedValueOnce({ id: 'uuid-sede-destino', activo: true });  // 2da llamada

      // Mock de validación de inventario (puede ser llamado múltiples veces, una por artículo)
      Inventario.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-inventario',
        sede_id: 'uuid-sede-origen',
        activo: true,
        estado: 'disponible'
      });

      // Mock de búsqueda de remitos activos (RemitoDetalle.findAll)
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);

      // Mock de generación de número de remito
      sequelize.query = jest.fn().mockResolvedValue([[{ numero: 1 }]]);

      // Mock de creación de remito
      Remito.create = jest.fn().mockResolvedValue({
        id: 'uuid-remito',
        numero_remito: 'REM-2025-001',
        estado: 'preparado'
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

      // ⭐ CRÍTICO: Mock del método obtener() usando spyOn
      jest.spyOn(remitoService, 'obtener').mockResolvedValue({
        id: 'uuid-remito',
        numero_remito: 'REM-2025-001',
        estado: 'preparado',
        detalles: [
          { id: 'uuid-detalle-1', es_prestamo: false },
          { id: 'uuid-detalle-2', es_prestamo: true }
        ],
        toJSON: function() { return this; }
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

      // Override del mock para retornar null cuando se busca con id null
      Personal.findOne = jest.fn().mockResolvedValue(null);

      await expect(remitoService.crear(datosInvalidos, usuarioEmail))
        .rejects.toThrow('Solicitante no existe o no está activo');
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
      jest.clearAllMocks();

      const mockRemito = {
        id: remitoId,
        numero_remito: 'REM-2025-001',
        estado: 'preparado',
        tecnico_asignado_id: 'uuid-tecnico',
        update: jest.fn().mockResolvedValue({
          id: remitoId,
          numero_remito: 'REM-2025-001',
          estado: 'en_transito'
        })
      };

      Remito.findByPk = jest.fn().mockResolvedValue(mockRemito);

      // Mock de obtener para el email (se llama en setImmediate)
      jest.spyOn(remitoService, 'obtener').mockResolvedValue({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        estado: 'en_transito',
        solicitante: { email: 'solicitante@test.com' },
        toJSON: function() { return this; }
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
        Personal.findOne = jest.fn().mockResolvedValue({
          id: 'uuid-persona',
          activo: true
        });

        await expect(
          remitoService.validarPersonaActiva('uuid-persona', 'Solicitante')
        ).resolves.not.toThrow();
      });

      it('debe lanzar error si persona no existe', async () => {
        Personal.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarPersonaActiva('uuid-inexistente', 'Solicitante')
        ).rejects.toThrow('no existe o no está activo');
      });

      it('debe lanzar error si persona está inactiva', async () => {
        Personal.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarPersonaActiva('uuid-persona', 'Solicitante')
        ).rejects.toThrow('no existe o no está activo');
      });
    });

    describe('validarSedeActiva()', () => {
      it('debe pasar si sede existe y está activa', async () => {
        Sede.findOne = jest.fn().mockResolvedValue({
          id: 'uuid-sede',
          activo: true
        });

        await expect(
          remitoService.validarSedeActiva('uuid-sede', 'Sede de origen')
        ).resolves.not.toThrow();
      });

      it('debe lanzar error si sede no existe', async () => {
        Sede.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarSedeActiva('uuid-inexistente', 'Sede')
        ).rejects.toThrow('no existe o no está activa');
      });
    });

    describe('validarInventarioDisponible()', () => {
      it('debe pasar si inventario está disponible en la sede', async () => {
        Inventario.findOne = jest.fn().mockResolvedValue({
          id: 'uuid-inventario',
          sede_id: 'uuid-sede',
          activo: true,
          estado: 'disponible'
        });

        // Mock de validación de remitos activos
        RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);

        await expect(
          remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-sede')
        ).resolves.not.toThrow();
      });

      it('debe lanzar error si inventario no existe', async () => {
        Inventario.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarInventarioDisponible('uuid-inexistente', 'uuid-sede')
        ).rejects.toThrow('no existe en la sede seleccionada o no está disponible');
      });

      it('debe lanzar error si inventario no está disponible', async () => {
        Inventario.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-sede')
        ).rejects.toThrow('no está disponible');
      });

      it('debe lanzar error si inventario está en otra sede', async () => {
        Inventario.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-otra-sede')
        ).rejects.toThrow('no existe en la sede seleccionada o no está disponible');
      });
    });
  });

  describe('obtener()', () => {
    const remitoId = 'uuid-remito';

    // Clase helper para crear mocks de Sequelize que permiten asignaciones dinámicas
    class MockSequelizeModel {
      constructor(data) {
        Object.assign(this, data);
      }
    }

    beforeEach(() => {
      // Restaurar el spy de obtener() que se creó en tests anteriores
      if (remitoService.obtener.mockRestore) {
        remitoService.obtener.mockRestore();
      }
      jest.restoreAllMocks();
    });

    it('debe obtener un remito por ID con todas sus relaciones', async () => {
      const mockRemito = new MockSequelizeModel({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        estado: 'preparado',
        solicitante: { id: 'uuid-sol', nombre: 'Juan', apellido: 'Pérez' },
        tecnicoAsignado: { id: 'uuid-tec', nombre: 'Pedro', apellido: 'García' },
        sedeOrigen: { id: 'uuid-sede-1', nombre_sede: 'Sede A' },
        sedeDestino: { id: 'uuid-sede-2', nombre_sede: 'Sede B' },
        detalles: [
          { id: 'det-1', es_prestamo: false, inventarioDetalle: { id: 'inv-1' } },
          { id: 'det-2', es_prestamo: true, inventarioDetalle: { id: 'inv-2' } }
        ],
        historialMovimientosRemito: []
      });

      Remito.findByPk = jest.fn().mockResolvedValue(mockRemito);

      const result = await remitoService.obtener(remitoId);

      expect(result).toBeDefined();
      expect(result.id).toBe(remitoId);
      expect(result.es_prestamo).toBe(true); // Tiene al menos un artículo en préstamo
      expect(Remito.findByPk).toHaveBeenCalledWith(
        remitoId,
        expect.objectContaining({
          include: expect.any(Array)
        })
      );
    });

    it('debe calcular es_prestamo=false cuando no hay artículos en préstamo', async () => {
      const mockRemito = new MockSequelizeModel({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        detalles: [
          { id: 'det-1', es_prestamo: false },
          { id: 'det-2', es_prestamo: false }
        ]
      });

      Remito.findByPk = jest.fn().mockResolvedValue(mockRemito);

      const result = await remitoService.obtener(remitoId);

      expect(result.es_prestamo).toBe(false);
    });

    it('debe lanzar error si el remito no existe', async () => {
      Remito.findByPk = jest.fn().mockResolvedValue(null);

      await expect(remitoService.obtener('uuid-inexistente'))
        .rejects.toThrow('El remito no existe');
    });

    it('debe manejar remito sin detalles', async () => {
      const mockRemito = new MockSequelizeModel({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        detalles: null
      });

      Remito.findByPk = jest.fn().mockResolvedValue(mockRemito);

      const result = await remitoService.obtener(remitoId);

      expect(result.es_prestamo).toBeFalsy(); // null o false son valores falsy válidos
    });
  });

  describe('listar()', () => {
    const createMockRemito = (data) => ({
      ...data,
      toJSON: function() { return this; }
    });

    const mockRemitos = [
      createMockRemito({
        id: 'rem-1',
        numero_remito: 'REM-2025-001',
        estado: 'preparado',
        solicitante: { id: 'sol-1', nombre: 'Juan' },
        detalles: []
      }),
      createMockRemito({
        id: 'rem-2',
        numero_remito: 'REM-2025-002',
        estado: 'en_transito',
        solicitante: { id: 'sol-2', nombre: 'María' },
        detalles: []
      })
    ];

    beforeEach(() => {
      Remito.findAndCountAll = jest.fn().mockResolvedValue({
        count: mockRemitos.length,
        rows: mockRemitos
      });
    });

    it('debe listar remitos con paginación por defecto', async () => {
      const result = await remitoService.listar({});

      expect(result).toBeDefined();
      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          order: [['created_at', 'DESC']]
        })
      );
    });

    it('debe aplicar paginación personalizada', async () => {
      await remitoService.listar({ page: 2, limit: 5 });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por estado', async () => {
      await remitoService.listar({ estado: 'preparado' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: 'preparado'
          })
        })
      );
    });

    it('debe filtrar por solicitante_id', async () => {
      await remitoService.listar({ solicitante_id: 'uuid-sol' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            solicitante_id: 'uuid-sol'
          })
        })
      );
    });

    it('debe filtrar por tecnico_id', async () => {
      await remitoService.listar({ tecnico_id: 'uuid-tec' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tecnico_id: 'uuid-tec'
          })
        })
      );
    });

    it('debe filtrar por sede_origen_id', async () => {
      await remitoService.listar({ sede_origen_id: 'uuid-sede-1' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sede_origen_id: 'uuid-sede-1'
          })
        })
      );
    });

    it('debe filtrar por sede_destino_id', async () => {
      await remitoService.listar({ sede_destino_id: 'uuid-sede-2' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sede_destino_id: 'uuid-sede-2'
          })
        })
      );
    });

    it('debe aplicar múltiples filtros simultáneamente', async () => {
      await remitoService.listar({
        estado: 'en_transito',
        solicitante_id: 'uuid-sol',
        sede_origen_id: 'uuid-sede-1'
      });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: 'en_transito',
            solicitante_id: 'uuid-sol',
            sede_origen_id: 'uuid-sede-1'
          })
        })
      );
    });

    it('debe incluir todas las relaciones necesarias', async () => {
      await remitoService.listar({});

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ as: 'solicitante' }),
            expect.objectContaining({ as: 'tecnicoAsignado' }),
            expect.objectContaining({ as: 'sedeOrigen' }),
            expect.objectContaining({ as: 'sedeDestino' }),
            expect.objectContaining({ as: 'detalles' })
          ])
        })
      );
    });

    it('debe retornar estructura correcta con paginación', async () => {
      const result = await remitoService.listar({ page: 1, limit: 10 });

      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('limit');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('pages');
      expect(result.pagination).toHaveProperty('currentPage');
      expect(result.pagination.pages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
    });
  });

  describe('generarRemitoDevolucion()', () => {
    const remitoOriginalId = 'uuid-remito-original';
    const detalleIds = ['uuid-detalle-1', 'uuid-detalle-2'];
    const usuarioEmail = 'test@megatlon.com.ar';

    beforeEach(() => {
      jest.restoreAllMocks();

      // Mock de generarNumeroRemito
      jest.spyOn(remitoService, 'generarNumeroRemito').mockResolvedValue('REM-2025-DEV-001');

      // Mock del remito original
      Remito.findByPk = jest.fn().mockResolvedValue({
        id: remitoOriginalId,
        numero_remito: 'REM-2025-001',
        sede_origen_id: 'uuid-sede-1',
        sede_destino_id: 'uuid-sede-2',
        solicitante_id: 'uuid-sol',
        tecnico_asignado_id: 'uuid-tec'
      });

      // Mock de sede Deposito
      Sede.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-deposito',
        nombre_sede: 'Deposito'
      });

      // Mock de detalles a devolver
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([
        {
          id: 'uuid-detalle-1',
          inventario_id: 'uuid-inv-1',
          es_prestamo: true,
          devuelto: false,
          update: jest.fn().mockResolvedValue({ devuelto: true })
        }
      ]);

      RemitoDetalle.create = jest.fn().mockResolvedValue({
        id: 'uuid-detalle-dev',
        remito_id: 'uuid-remito-dev'
      });

      Remito.create = jest.fn().mockResolvedValue({
        id: 'uuid-remito-dev',
        numero_remito: 'REM-2025-DEV-001'
      });

      Inventario.update = jest.fn().mockResolvedValue([1]);

      jest.spyOn(remitoService, 'obtener').mockResolvedValue({
        id: 'uuid-remito-dev',
        numero_remito: 'REM-2025-DEV-001',
        toJSON: function() { return this; }
      });
    });

    it('debe generar remito de devolución exitosamente', async () => {
      const result = await remitoService.generarRemitoDevolucion(
        remitoOriginalId,
        detalleIds,
        usuarioEmail
      );

      expect(result).toBeDefined();
      expect(Remito.findByPk).toHaveBeenCalledWith(remitoOriginalId);
      expect(Remito.create).toHaveBeenCalled();
      expect(RemitoDetalle.create).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si remito original no existe', async () => {
      Remito.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        remitoService.generarRemitoDevolucion(remitoOriginalId, detalleIds, usuarioEmail)
      ).rejects.toThrow('El remito original no existe');
    });

    it('debe lanzar error si no existe sede Deposito', async () => {
      Sede.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        remitoService.generarRemitoDevolucion(remitoOriginalId, detalleIds, usuarioEmail)
      ).rejects.toThrow('No se encontró la sede "Deposito"');
    });

    it('debe lanzar error si no hay artículos válidos para devolver', async () => {
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);

      await expect(
        remitoService.generarRemitoDevolucion(remitoOriginalId, detalleIds, usuarioEmail)
      ).rejects.toThrow('No hay artículos válidos para devolver');
    });

    it('debe actualizar estado de inventario a disponible', async () => {
      await remitoService.generarRemitoDevolucion(
        remitoOriginalId,
        detalleIds,
        usuarioEmail
      );

      expect(Inventario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'disponible',
          sede_id: 'uuid-deposito'
        }),
        expect.any(Object)
      );
    });

    it('debe invertir sedes (origen <-> destino)', async () => {
      await remitoService.generarRemitoDevolucion(
        remitoOriginalId,
        detalleIds,
        usuarioEmail
      );

      expect(Remito.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sede_origen_id: 'uuid-sede-2', // Invertido
          sede_destino_id: 'uuid-sede-1'  // Invertido
        }),
        expect.any(Object)
      );
    });
  });

  describe('validarArticuloNoEnTransito()', () => {
    it('debe pasar si artículo no está en tránsito', async () => {
      RemitoDetalle.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        remitoService.validarArticuloNoEnTransito('uuid-inv')
      ).resolves.not.toThrow();
    });

    it('debe lanzar error si artículo está en tránsito', async () => {
      RemitoDetalle.findOne = jest.fn().mockResolvedValue({
        remito: {
          numero_remito: 'REM-2025-001',
          estado: 'en_transito'
        }
      });

      await expect(
        remitoService.validarArticuloNoEnTransito('uuid-inv')
      ).rejects.toThrow('ya está en el remito');
    });
  });

  describe('asignarReceptor()', () => {
    const remitoId = 'uuid-remito';
    const receptorNombre = 'Juan Pérez';
    const receptorEmail = 'juan@example.com';
    const usuarioEmail = 'admin@megatlon.com.ar';

    beforeEach(() => {
      jest.clearAllMocks();

      Remito.findByPk = jest.fn().mockResolvedValue({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        estado: 'en_transito',
        receptor_nombre: null,
        receptor_email: null,
        detalles: [],
        update: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: function() { return this; },
        solicitante: { email: 'solicitante@test.com' },
        sedeDestino: { nombre_sede: 'Sede B' }
      });
    });

    it('debe asignar receptor exitosamente', async () => {
      const result = await remitoService.asignarReceptor(
        remitoId,
        receptorNombre,
        receptorEmail,
        usuarioEmail
      );

      expect(result).toBeDefined();
      expect(Remito.findByPk).toHaveBeenCalledWith(remitoId, expect.any(Object));
    });

    it('debe lanzar error si remito no existe', async () => {
      Remito.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        remitoService.asignarReceptor(remitoId, receptorNombre, receptorEmail, usuarioEmail)
      ).rejects.toThrow('El remito no existe');
    });

    it('debe lanzar error si remito no está en tránsito', async () => {
      Remito.findByPk = jest.fn().mockResolvedValue({
        id: remitoId,
        estado: 'preparado'
      });

      await expect(
        remitoService.asignarReceptor(remitoId, receptorNombre, receptorEmail, usuarioEmail)
      ).rejects.toThrow('Solo se puede asignar receptor a remitos en estado "en_transito"');
    });
  });

  describe('confirmarRecepcion()', () => {
    const remitoId = 'uuid-remito';
    const validToken = 'valid-jwt-token';

    beforeEach(() => {
      jest.clearAllMocks();

      // Mock tokenService
      const tokenService = require('../../../shared/services/tokenService');
      tokenService.validarTokenConfirmacion = jest.fn().mockReturnValue({
        remitoId: remitoId,
        email: 'receptor@test.com'
      });

      Remito.findByPk = jest.fn().mockResolvedValue({
        id: remitoId,
        numero_remito: 'REM-2025-001',
        estado: 'en_transito',
        receptor_email: 'receptor@test.com', // Email que coincide con el token
        solicitante: { email: 'solicitante@test.com' },
        sedeOrigen: { nombre_sede: 'Sede A' },
        sedeDestino: { nombre_sede: 'Sede B' },
        save: jest.fn().mockResolvedValue(true),
        detalles: [],
        toJSON: function() { return this; }
      });
    });

    it('debe confirmar recepción con token válido', async () => {
      const result = await remitoService.confirmarRecepcion(remitoId, validToken);

      expect(result).toBeDefined();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error con token inválido', async () => {
      const tokenService = require('../../../shared/services/tokenService');
      tokenService.validarTokenConfirmacion = jest.fn().mockImplementation(() => {
        throw new Error('inválido o expirado');
      });

      await expect(
        remitoService.confirmarRecepcion(remitoId, 'invalid-token')
      ).rejects.toThrow('Token de confirmación');
    });

    it('debe lanzar error si token no corresponde al remito', async () => {
      const tokenService = require('../../../shared/services/tokenService');
      tokenService.validarTokenConfirmacion = jest.fn().mockReturnValue({
        remitoId: 'otro-uuid',
        email: 'receptor@test.com'
      });

      await expect(
        remitoService.confirmarRecepcion(remitoId, validToken)
      ).rejects.toThrow('no corresponde a este remito');
    });

    it('debe lanzar error si remito no existe', async () => {
      Remito.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        remitoService.confirmarRecepcion(remitoId, validToken)
      ).rejects.toThrow('no existe');
    });
  });

  describe('obtenerPrestamosProximosAVencer()', () => {
    it('debe obtener préstamos próximos a vencer', async () => {
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([
        {
          id: 'det-1',
          es_prestamo: true,
          devuelto: false,
          fecha_devolucion_esperada: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'det-2',
          es_prestamo: true,
          devuelto: false,
          fecha_devolucion_esperada: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        }
      ]);

      const result = await remitoService.obtenerPrestamosProximosAVencer(7);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('debe retornar array vacío si no hay préstamos próximos', async () => {
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);

      const result = await remitoService.obtenerPrestamosProximosAVencer(7);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('debe usar parámetro de días correctamente', async () => {
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);

      await remitoService.obtenerPrestamosProximosAVencer(14);

      expect(RemitoDetalle.findAll).toHaveBeenCalled();
    });
  });

  describe('obtenerPrestamosVencidos()', () => {
    it('debe obtener préstamos vencidos', async () => {
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([
        {
          id: 'det-1',
          es_prestamo: true,
          devuelto: false,
          fecha_devolucion_esperada: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        }
      ]);

      const result = await remitoService.obtenerPrestamosVencidos();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('debe retornar array vacío si no hay préstamos vencidos', async () => {
      RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);

      const result = await remitoService.obtenerPrestamosVencidos();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('obtenerResumenPrestamos()', () => {
    it('debe obtener resumen de préstamos completo', async () => {
      // Mock para count (3 llamadas: próximos a vencer, vencidos, total activos)
      RemitoDetalle.count = jest.fn()
        .mockResolvedValueOnce(1) // Próximos a vencer
        .mockResolvedValueOnce(1) // Vencidos
        .mockResolvedValueOnce(2); // Total activos

      const result = await remitoService.obtenerResumenPrestamos();

      expect(result).toBeDefined();
      expect(result.totalActivos).toBe(2);
      expect(result.proximosAVencer).toBe(1);
      expect(result.vencidos).toBe(1);
    });

    it('debe manejar caso sin préstamos', async () => {
      RemitoDetalle.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await remitoService.obtenerResumenPrestamos();

      expect(result.totalActivos).toBe(0);
      expect(result.proximosAVencer).toBe(0);
      expect(result.vencidos).toBe(0);
    });
  });
});
