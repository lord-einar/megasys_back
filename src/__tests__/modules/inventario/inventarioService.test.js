// src/__tests__/modules/inventario/inventarioService.test.js

// IMPORTANTE: Mockear database ANTES de cualquier import
jest.mock('../../../shared/utils/database', () => ({
  sequelize: {
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
    fn: jest.fn(),
    col: jest.fn(),
    literal: jest.fn()
  }
}));

// Mock de modelos
jest.mock('../../../models', () => {
  const mockSequelize = {
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
    fn: jest.fn((fn, col) => ({ fn, col })),
    col: jest.fn((col) => ({ col })),
    literal: jest.fn((literal) => ({ literal }))
  };

  return {
    Inventario: {
      create: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      update: jest.fn()
    },
    TipoArticulo: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    Sede: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    HistorialMovimiento: {
      create: jest.fn(),
      findAll: jest.fn()
    },
    RemitoDetalle: {
      findOne: jest.fn()
    },
    Remito: {
      findOne: jest.fn()
    },
    sequelize: mockSequelize
  };
});

// Mock de TransactionWrapper
jest.mock('../../../shared/utils/transactionWrapper', () => ({
  execute: jest.fn(async ({ operation }) => {
    const mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    };
    const result = await operation(mockTransaction);
    return { data: result };
  })
}));

// Mock de logger
jest.mock('../../../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const inventarioService = require('../../../modules/inventario/services/inventarioService');
const { Inventario, TipoArticulo, Sede, HistorialMovimiento, RemitoDetalle, Remito, sequelize } = require('../../../models');
const TransactionWrapper = require('../../../shared/utils/transactionWrapper');
const { Op } = require('sequelize');

describe('InventarioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validarTipoArticuloActivo()', () => {
    it('debe pasar si el tipo de artículo existe y está activo', async () => {
      const mockTipo = { id: 'uuid-tipo', nombre: 'Notebook', activo: true };
      TipoArticulo.findOne = jest.fn().mockResolvedValue(mockTipo);

      const result = await inventarioService.validarTipoArticuloActivo('uuid-tipo');

      expect(result).toEqual(mockTipo);
      expect(TipoArticulo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-tipo', activo: true }
      });
    });

    it('debe lanzar error si el tipo de artículo no existe', async () => {
      TipoArticulo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.validarTipoArticuloActivo('uuid-inexistente')
      ).rejects.toThrow('El tipo de artículo no existe o no está disponible');
    });

    it('debe lanzar error si el tipo de artículo está inactivo', async () => {
      TipoArticulo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.validarTipoArticuloActivo('uuid-tipo-inactivo')
      ).rejects.toThrow('El tipo de artículo no existe o no está disponible');
    });
  });

  describe('validarSedeActiva()', () => {
    it('debe pasar si la sede existe y está activa', async () => {
      const mockSede = { id: 'uuid-sede', nombre_sede: 'Sede A', activo: true };
      Sede.findOne = jest.fn().mockResolvedValue(mockSede);

      const result = await inventarioService.validarSedeActiva('uuid-sede');

      expect(result).toEqual(mockSede);
      expect(Sede.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-sede', activo: true }
      });
    });

    it('debe lanzar error si la sede no existe', async () => {
      Sede.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.validarSedeActiva('uuid-inexistente')
      ).rejects.toThrow('La sede no existe o no está disponible');
    });

    it('debe lanzar error si la sede está inactiva', async () => {
      Sede.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.validarSedeActiva('uuid-sede-inactiva')
      ).rejects.toThrow('La sede no existe o no está disponible');
    });
  });

  describe('validarNumeroSerieUnico()', () => {
    it('debe pasar si numero_serie es null', async () => {
      await expect(
        inventarioService.validarNumeroSerieUnico(null)
      ).resolves.not.toThrow();

      expect(Inventario.findOne).not.toHaveBeenCalled();
    });

    it('debe pasar si numero_serie es undefined', async () => {
      await expect(
        inventarioService.validarNumeroSerieUnico(undefined)
      ).resolves.not.toThrow();

      expect(Inventario.findOne).not.toHaveBeenCalled();
    });

    it('debe pasar si el número de serie es único', async () => {
      Inventario.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.validarNumeroSerieUnico('SN12345')
      ).resolves.not.toThrow();

      expect(Inventario.findOne).toHaveBeenCalledWith({
        where: { numero_serie: 'SN12345' }
      });
    });

    it('debe lanzar error si el número de serie ya existe', async () => {
      Inventario.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-existente',
        numero_serie: 'SN12345'
      });

      await expect(
        inventarioService.validarNumeroSerieUnico('SN12345')
      ).rejects.toThrow('Ya existe un item con el número de serie "SN12345"');
    });

    it('debe pasar si el número de serie existe pero es del mismo item (exclusión)', async () => {
      const inventarioId = 'uuid-mismo-item';

      Inventario.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.validarNumeroSerieUnico('SN12345', inventarioId)
      ).resolves.not.toThrow();

      expect(Inventario.findOne).toHaveBeenCalledWith({
        where: {
          numero_serie: 'SN12345',
          id: { [Op.ne]: inventarioId }
        }
      });
    });
  });

  describe('listar()', () => {
    const createMockInventario = (data) => ({
      ...data,
      toJSON: function() { return this; },
      getIdentificacion: jest.fn(() => `${data.marca} ${data.modelo}`),
      getDescripcionCompleta: jest.fn(() => `${data.marca} ${data.modelo} - ${data.numero_serie}`),
      estaDisponible: jest.fn(() => data.estado === 'disponible')
    });

    beforeEach(() => {
      Inventario.findAndCountAll = jest.fn().mockResolvedValue({
        rows: [
          createMockInventario({ id: '1', marca: 'HP', modelo: 'EliteBook', estado: 'disponible', numero_serie: 'SN001' }),
          createMockInventario({ id: '2', marca: 'Dell', modelo: 'Latitude', estado: 'en_uso', numero_serie: 'SN002' })
        ],
        count: 2
      });
    });

    it('debe listar inventario con paginación por defecto', async () => {
      const result = await inventarioService.listar({});

      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2
      });
    });

    it('debe aplicar paginación personalizada', async () => {
      await inventarioService.listar({ page: 2, limit: 5 });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por search (marca, modelo, numero_serie, service_tag)', async () => {
      await inventarioService.listar({ search: 'HP' });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { marca: { [Op.iLike]: '%HP%' } },
              { modelo: { [Op.iLike]: '%HP%' } },
              { numero_serie: { [Op.iLike]: '%HP%' } },
              { service_tag: { [Op.iLike]: '%HP%' } }
            ])
          })
        })
      );
    });

    it('debe filtrar por sede_id', async () => {
      await inventarioService.listar({ sede_id: 'uuid-sede' });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sede_id: 'uuid-sede' })
        })
      );
    });

    it('debe filtrar por tipo_articulo_id', async () => {
      await inventarioService.listar({ tipo_articulo_id: 'uuid-tipo' });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tipo_articulo_id: 'uuid-tipo' })
        })
      );
    });

    it('debe filtrar por estado', async () => {
      await inventarioService.listar({ estado: 'disponible' });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'disponible' })
        })
      );
    });

    it('debe filtrar por disponible_solo', async () => {
      await inventarioService.listar({ disponible_solo: true });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'disponible' })
        })
      );
    });

    it('debe filtrar por activo', async () => {
      await inventarioService.listar({ activo: false });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: false })
        })
      );
    });

    it('debe mostrar solo activos por defecto', async () => {
      await inventarioService.listar({});

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true })
        })
      );
    });

    it('debe aplicar múltiples filtros simultáneamente', async () => {
      await inventarioService.listar({
        search: 'HP',
        sede_id: 'uuid-sede',
        estado: 'disponible',
        tipo_articulo_id: 'uuid-tipo'
      });

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            sede_id: 'uuid-sede',
            estado: 'disponible',
            tipo_articulo_id: 'uuid-tipo',
            [Op.or]: expect.any(Array)
          })
        })
      );
    });

    it('debe incluir relaciones (TipoArticulo, Sede)', async () => {
      await inventarioService.listar({});

      expect(Inventario.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: TipoArticulo, as: 'tipoArticulo' }),
            expect.objectContaining({ model: Sede, as: 'sedePrincipal' })
          ])
        })
      );
    });

    it('debe agregar información adicional (identificacion, descripcionCompleta, disponible)', async () => {
      const result = await inventarioService.listar({});

      expect(result.rows[0]).toHaveProperty('identificacion');
      expect(result.rows[0]).toHaveProperty('descripcionCompleta');
      expect(result.rows[0]).toHaveProperty('disponible');
      expect(result.rows[0].getIdentificacion).toHaveBeenCalled();
      expect(result.rows[0].getDescripcionCompleta).toHaveBeenCalled();
      expect(result.rows[0].estaDisponible).toHaveBeenCalled();
    });
  });

  describe('obtenerConDetalles()', () => {
    const createMockItem = (data) => ({
      ...data,
      toJSON: function() { return this; },
      getDescripcionCompleta: jest.fn(() => `${data.marca} ${data.modelo}`)
    });

    it('debe obtener item con detalles completos', async () => {
      const mockItem = createMockItem({
        id: 'uuid-item',
        marca: 'HP',
        modelo: 'EliteBook',
        estado: 'disponible'
      });

      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);

      const result = await inventarioService.obtenerConDetalles('uuid-item');

      expect(result).toBeDefined();
      expect(Inventario.findByPk).toHaveBeenCalledWith('uuid-item', expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: TipoArticulo, as: 'tipoArticulo' }),
          expect.objectContaining({ model: Sede, as: 'sedePrincipal' }),
          expect.objectContaining({ model: HistorialMovimiento, as: 'historialMovimientosInventario' })
        ])
      }));
    });

    it('debe retornar null si el item no existe', async () => {
      Inventario.findByPk = jest.fn().mockResolvedValue(null);

      const result = await inventarioService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });

    it('debe incluir préstamo activo si estado es en_prestamo', async () => {
      const mockItem = createMockItem({
        id: 'uuid-item',
        marca: 'HP',
        modelo: 'EliteBook',
        estado: 'en_prestamo'
      });

      const mockPrestamoActivo = {
        remito: {
          numero_remito: 'REM-2025-001',
          estado: 'entregado',
          sedeDestino: { nombre_sede: 'Sede B' },
          sedeOrigen: { nombre_sede: 'Sede A' }
        },
        fecha_devolucion_esperada: '2025-01-15',
        observaciones: 'Préstamo temporal'
      };

      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);
      RemitoDetalle.findOne = jest.fn().mockResolvedValue(mockPrestamoActivo);

      const result = await inventarioService.obtenerConDetalles('uuid-item');

      expect(result.prestamoActivo).toBeDefined();
      expect(result.prestamoActivo.numeroRemito).toBe('REM-2025-001');
      expect(RemitoDetalle.findOne).toHaveBeenCalled();
    });

    it('debe no incluir préstamo activo si estado no es en_prestamo', async () => {
      const mockItem = createMockItem({
        id: 'uuid-item',
        marca: 'HP',
        modelo: 'EliteBook',
        estado: 'disponible'
      });

      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);

      const result = await inventarioService.obtenerConDetalles('uuid-item');

      expect(result.prestamoActivo).toBeUndefined();
      expect(RemitoDetalle.findOne).not.toHaveBeenCalled();
    });
  });

  describe('crear()', () => {
    const datosNuevo = {
      tipo_articulo_id: 'uuid-tipo',
      marca: 'HP',
      modelo: 'EliteBook 840',
      numero_serie: 'SN12345',
      service_tag: 'ST67890',
      sede_id: 'uuid-sede',
      estado: 'disponible',
      fecha_adquisicion: '2025-01-01',
      valor_adquisicion: 1500,
      observaciones: 'Nuevo equipo'
    };
    const usuarioEmail = 'admin@test.com';

    beforeEach(() => {
      TipoArticulo.findOne = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });
      Sede.findOne = jest.fn().mockResolvedValue({ id: 'uuid-sede', activo: true });
      Inventario.findOne = jest.fn().mockResolvedValue(null);

      Inventario.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo-item',
        ...datosNuevo,
        getDescripcionCompleta: jest.fn(() => 'HP EliteBook 840')
      });

      HistorialMovimiento.create = jest.fn().mockResolvedValue({ id: 'uuid-historial' });

      jest.spyOn(inventarioService, 'obtenerConDetalles').mockResolvedValue({
        id: 'uuid-nuevo-item',
        marca: 'HP',
        modelo: 'EliteBook 840'
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('debe crear item de inventario exitosamente', async () => {
      const result = await inventarioService.crear(datosNuevo, usuarioEmail);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo-item');
      expect(TransactionWrapper.execute).toHaveBeenCalled();
    });

    it('debe lanzar error si tipo_articulo_id es inválido', async () => {
      TipoArticulo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.crear(datosNuevo, usuarioEmail)
      ).rejects.toThrow('El tipo de artículo no existe o no está disponible');
    });

    it('debe lanzar error si sede_id es inválida', async () => {
      Sede.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.crear(datosNuevo, usuarioEmail)
      ).rejects.toThrow('La sede no existe o no está disponible');
    });

    it('debe lanzar error si numero_serie está duplicado', async () => {
      Inventario.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-existente',
        numero_serie: 'SN12345'
      });

      await expect(
        inventarioService.crear(datosNuevo, usuarioEmail)
      ).rejects.toThrow('Ya existe un item con el número de serie "SN12345"');
    });

    it('debe crear registro en historial de movimientos', async () => {
      await inventarioService.crear(datosNuevo, usuarioEmail);

      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventario_id: 'uuid-nuevo-item',
          sede_origen_id: 'uuid-sede',
          sede_destino_id: 'uuid-sede',
          tipo_movimiento: 'asignacion',
          observaciones: 'Item agregado al inventario'
        }),
        expect.any(Object)
      );
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        ...datosNuevo,
        marca: '  HP  ',
        modelo: '  EliteBook 840  ',
        numero_serie: '  SN12345  ',
        observaciones: '  Nuevo equipo  '
      };

      await inventarioService.crear(datosConEspacios, usuarioEmail);

      expect(Inventario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          marca: 'HP',
          modelo: 'EliteBook 840',
          numero_serie: 'SN12345',
          observaciones: 'Nuevo equipo'
        }),
        expect.any(Object)
      );
    });

    it('debe usar TransactionWrapper con auditoría', async () => {
      await inventarioService.crear(datosNuevo, usuarioEmail, {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla'
      });

      expect(TransactionWrapper.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioEmail,
          modulo: 'inventario',
          accion: 'crear',
          recurso: 'Inventario',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla'
        })
      );
    });

    it('debe manejar campos opcionales (numero_serie, service_tag, observaciones)', async () => {
      const datosSinOpcionales = {
        tipo_articulo_id: 'uuid-tipo',
        marca: 'HP',
        modelo: 'EliteBook 840',
        sede_id: 'uuid-sede'
      };

      await inventarioService.crear(datosSinOpcionales, usuarioEmail);

      expect(Inventario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          marca: 'HP',
          modelo: 'EliteBook 840'
        }),
        expect.any(Object)
      );
    });

    it('debe llamar obtenerConDetalles al final', async () => {
      await inventarioService.crear(datosNuevo, usuarioEmail);

      expect(inventarioService.obtenerConDetalles).toHaveBeenCalledWith('uuid-nuevo-item');
    });

    it('debe manejar errores con rollback via TransactionWrapper', async () => {
      Inventario.create = jest.fn().mockRejectedValue(new Error('Error de DB'));

      // TransactionWrapper maneja el rollback automáticamente
      await expect(
        inventarioService.crear(datosNuevo, usuarioEmail)
      ).rejects.toThrow();
    });
  });

  describe('actualizar()', () => {
    const inventarioId = 'uuid-item';
    const datosActualizacion = {
      marca: 'Dell',
      modelo: 'Latitude 5420',
      numero_serie: 'SN-NEW',
      sede_id: 'uuid-sede-nueva'
    };
    const usuarioEmail = 'admin@test.com';

    let mockItem;

    beforeEach(() => {
      mockItem = {
        id: inventarioId,
        tipo_articulo_id: 'uuid-tipo',
        marca: 'HP',
        modelo: 'EliteBook 840',
        numero_serie: 'SN-OLD',
        sede_id: 'uuid-sede-vieja',
        estado: 'disponible',
        update: jest.fn().mockResolvedValue(undefined),
        getDescripcionCompleta: jest.fn(() => 'HP EliteBook 840')
      };

      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);
      TipoArticulo.findOne = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });
      Sede.findOne = jest.fn().mockResolvedValue({ id: 'uuid-sede-nueva', activo: true });
      Inventario.findOne = jest.fn().mockResolvedValue(null);
      HistorialMovimiento.create = jest.fn().mockResolvedValue({ id: 'uuid-historial' });

      jest.spyOn(inventarioService, 'obtenerConDetalles').mockResolvedValue({
        id: inventarioId,
        marca: 'Dell',
        modelo: 'Latitude 5420'
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('debe actualizar item exitosamente', async () => {
      const result = await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(result).toBeDefined();
      expect(mockItem.update).toHaveBeenCalled();
      expect(TransactionWrapper.execute).toHaveBeenCalled();
    });

    it('debe lanzar error si item no existe', async () => {
      Inventario.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail)
      ).rejects.toThrow('Item de inventario no encontrado');
    });

    it('debe validar tipo_articulo_id si cambia', async () => {
      const datosConTipoNuevo = {
        ...datosActualizacion,
        tipo_articulo_id: 'uuid-tipo-nuevo'
      };

      await inventarioService.actualizar(inventarioId, datosConTipoNuevo, usuarioEmail);

      expect(TipoArticulo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-tipo-nuevo', activo: true }
      });
    });

    it('debe validar numero_serie si cambia', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(Inventario.findOne).toHaveBeenCalledWith({
        where: {
          numero_serie: 'SN-NEW',
          id: { [Op.ne]: inventarioId }
        }
      });
    });

    it('debe validar sede_id si cambia', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(Sede.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-sede-nueva', activo: true }
      });
    });

    it('debe crear historial de movimiento si cambió de sede', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventario_id: inventarioId,
          sede_origen_id: 'uuid-sede-vieja',
          sede_destino_id: 'uuid-sede-nueva',
          tipo_movimiento: 'transferencia',
          observaciones: 'Transferencia manual de sede'
        }),
        expect.any(Object)
      );
    });

    it('debe no crear historial si no cambió de sede', async () => {
      const datosSinCambioSede = {
        marca: 'Dell',
        modelo: 'Latitude 5420'
      };

      await inventarioService.actualizar(inventarioId, datosSinCambioSede, usuarioEmail);

      expect(HistorialMovimiento.create).not.toHaveBeenCalled();
    });

    it('debe normalizar strings (trim)', async () => {
      const datosConEspacios = {
        marca: '  Dell  ',
        modelo: '  Latitude 5420  '
      };

      await inventarioService.actualizar(inventarioId, datosConEspacios, usuarioEmail);

      expect(mockItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          marca: 'Dell',
          modelo: 'Latitude 5420'
        }),
        expect.any(Object)
      );
    });

    it('debe guardar valores anteriores y nuevos para auditoría', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(TransactionWrapper.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          valoresAnteriores: expect.objectContaining({
            marca: 'HP',
            modelo: 'EliteBook 840',
            numero_serie: 'SN-OLD',
            sede_id: 'uuid-sede-vieja'
          }),
          valoresNuevos: expect.any(Object)
        })
      );
    });

    it('debe usar TransactionWrapper con auditoría', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail, {
        ipAddress: '192.168.1.1'
      });

      expect(TransactionWrapper.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioEmail,
          modulo: 'inventario',
          accion: 'actualizar',
          recurso: 'Inventario',
          recursoId: inventarioId,
          ipAddress: '192.168.1.1'
        })
      );
    });

    it('debe llamar obtenerConDetalles al final', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(inventarioService.obtenerConDetalles).toHaveBeenCalledWith(inventarioId);
    });

    it('debe manejar errores con rollback via TransactionWrapper', async () => {
      mockItem.update = jest.fn().mockRejectedValue(new Error('Error de DB'));

      await expect(
        inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail)
      ).rejects.toThrow();
    });
  });

  describe('cambiarEstado()', () => {
    const inventarioId = 'uuid-item';
    const nuevoEstado = 'mantenimiento';
    const observaciones = 'Requiere reparación';
    const usuarioEmail = 'admin@test.com';

    let mockItem;

    beforeEach(() => {
      mockItem = {
        id: inventarioId,
        estado: 'disponible',
        sede_id: 'uuid-sede',
        update: jest.fn().mockResolvedValue(undefined)
      };

      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);
      HistorialMovimiento.create = jest.fn().mockResolvedValue({ id: 'uuid-historial' });
    });

    it('debe cambiar estado exitosamente', async () => {
      const result = await inventarioService.cambiarEstado(inventarioId, nuevoEstado, observaciones, usuarioEmail);

      expect(result).toBeDefined();
      expect(result.estadoAnterior).toBe('disponible');
      expect(result.estadoNuevo).toBe('mantenimiento');
      expect(mockItem.update).toHaveBeenCalledWith(
        { estado: nuevoEstado },
        expect.any(Object)
      );
    });

    it('debe lanzar error si item no existe', async () => {
      Inventario.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.cambiarEstado(inventarioId, nuevoEstado, observaciones, usuarioEmail)
      ).rejects.toThrow('Item de inventario no encontrado');
    });

    it('debe lanzar error si nuevo estado es igual al actual', async () => {
      await expect(
        inventarioService.cambiarEstado(inventarioId, 'disponible', observaciones, usuarioEmail)
      ).rejects.toThrow('El nuevo estado es igual al actual');
    });

    it('debe crear historial para estado mantenimiento', async () => {
      await inventarioService.cambiarEstado(inventarioId, 'mantenimiento', observaciones, usuarioEmail);

      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventario_id: inventarioId,
          tipo_movimiento: 'mantenimiento',
          observaciones
        }),
        expect.any(Object)
      );
    });

    it('debe crear historial para estado dado_de_baja', async () => {
      await inventarioService.cambiarEstado(inventarioId, 'dado_de_baja', observaciones, usuarioEmail);

      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_movimiento: 'mantenimiento'
        }),
        expect.any(Object)
      );
    });

    it('debe no crear historial para otros estados', async () => {
      await inventarioService.cambiarEstado(inventarioId, 'en_uso', null, usuarioEmail);

      expect(HistorialMovimiento.create).not.toHaveBeenCalled();
    });

    it('debe usar TransactionWrapper con auditoría', async () => {
      await inventarioService.cambiarEstado(inventarioId, nuevoEstado, observaciones, usuarioEmail, {
        ipAddress: '192.168.1.1'
      });

      expect(TransactionWrapper.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioEmail,
          modulo: 'inventario',
          accion: 'cambiar_estado',
          recursoId: inventarioId,
          ipAddress: '192.168.1.1'
        })
      );
    });

    it('debe incluir observaciones en la descripción de auditoría', async () => {
      await inventarioService.cambiarEstado(inventarioId, nuevoEstado, observaciones, usuarioEmail);

      expect(TransactionWrapper.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          descripcion: expect.stringContaining(observaciones)
        })
      );
    });
  });

  describe('eliminar()', () => {
    const inventarioId = 'uuid-item';
    const usuarioEmail = 'admin@test.com';

    let mockItem;

    beforeEach(() => {
      mockItem = {
        id: inventarioId,
        marca: 'HP',
        modelo: 'EliteBook',
        estado: 'disponible',
        sede_id: 'uuid-sede',
        activo: true,
        update: jest.fn().mockResolvedValue(undefined),
        getDescripcionCompleta: jest.fn(() => 'HP EliteBook 840')
      };

      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);
      HistorialMovimiento.create = jest.fn().mockResolvedValue({ id: 'uuid-historial' });
    });

    it('debe eliminar item exitosamente (soft delete)', async () => {
      const result = await inventarioService.eliminar(inventarioId, usuarioEmail);

      expect(result).toBe(true);
      expect(mockItem.update).toHaveBeenCalledWith(
        { activo: false, estado: 'dado_de_baja' },
        expect.any(Object)
      );
    });

    it('debe lanzar error si item no existe', async () => {
      Inventario.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.eliminar(inventarioId, usuarioEmail)
      ).rejects.toThrow('Item de inventario no encontrado');
    });

    it('debe marcar activo=false y estado=dado_de_baja', async () => {
      await inventarioService.eliminar(inventarioId, usuarioEmail);

      expect(mockItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          activo: false,
          estado: 'dado_de_baja'
        }),
        expect.any(Object)
      );
    });

    it('debe crear registro en historial de movimientos', async () => {
      await inventarioService.eliminar(inventarioId, usuarioEmail);

      expect(HistorialMovimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventario_id: inventarioId,
          tipo_movimiento: 'mantenimiento',
          observaciones: 'Item dado de baja'
        }),
        expect.any(Object)
      );
    });

    it('debe usar TransactionWrapper con auditoría', async () => {
      await inventarioService.eliminar(inventarioId, usuarioEmail, {
        ipAddress: '192.168.1.1'
      });

      expect(TransactionWrapper.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioEmail,
          modulo: 'inventario',
          accion: 'eliminar',
          recursoId: inventarioId,
          valoresAnteriores: expect.objectContaining({ activo: true }),
          valoresNuevos: expect.objectContaining({ activo: false }),
          ipAddress: '192.168.1.1'
        })
      );
    });
  });

  describe('buscar()', () => {
    const mockResultados = [
      {
        id: '1',
        marca: 'HP',
        modelo: 'EliteBook',
        estado: 'disponible',
        getIdentificacion: jest.fn(() => 'HP EliteBook'),
        getDescripcionCompleta: jest.fn(() => 'HP EliteBook 840 - SN001'),
        estaDisponible: jest.fn(() => true),
        tipoArticulo: { id: 'tipo-1', nombre: 'Notebook' },
        sede: { id: 'sede-1', nombre_sede: 'Sede A' }
      }
    ];

    beforeEach(() => {
      Inventario.findAll = jest.fn().mockResolvedValue(mockResultados);
    });

    it('debe buscar por marca', async () => {
      await inventarioService.buscar('HP');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            [Op.or]: expect.arrayContaining([
              { marca: { [Op.iLike]: '%HP%' } }
            ])
          })
        })
      );
    });

    it('debe buscar por modelo', async () => {
      await inventarioService.buscar('EliteBook');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { modelo: { [Op.iLike]: '%EliteBook%' } }
            ])
          })
        })
      );
    });

    it('debe buscar por numero_serie', async () => {
      await inventarioService.buscar('SN001');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { numero_serie: { [Op.iLike]: '%SN001%' } }
            ])
          })
        })
      );
    });

    it('debe buscar por service_tag', async () => {
      await inventarioService.buscar('ST001');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { service_tag: { [Op.iLike]: '%ST001%' } }
            ])
          })
        })
      );
    });

    it('debe filtrar por sede_id, tipo_articulo_id, disponible_solo', async () => {
      await inventarioService.buscar('HP', {
        sede_id: 'uuid-sede',
        tipo_articulo_id: 'uuid-tipo',
        disponible_solo: true
      });

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sede_id: 'uuid-sede',
            tipo_articulo_id: 'uuid-tipo',
            estado: 'disponible'
          })
        })
      );
    });

    it('debe retornar formato simplificado con métodos del modelo', async () => {
      const result = await inventarioService.buscar('HP');

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('identificacion');
      expect(result[0]).toHaveProperty('descripcionCompleta');
      expect(result[0]).toHaveProperty('disponible');
      expect(mockResultados[0].getIdentificacion).toHaveBeenCalled();
      expect(mockResultados[0].getDescripcionCompleta).toHaveBeenCalled();
      expect(mockResultados[0].estaDisponible).toHaveBeenCalled();
    });
  });

  describe('obtenerDisponiblesPorSede()', () => {
    const mockItems = [
      { id: '1', marca: 'HP', modelo: 'EliteBook', estado: 'disponible' },
      { id: '2', marca: 'Dell', modelo: 'Latitude', estado: 'disponible' }
    ];

    beforeEach(() => {
      Inventario.findAll = jest.fn().mockResolvedValue(mockItems);
    });

    it('debe obtener items disponibles de una sede', async () => {
      const result = await inventarioService.obtenerDisponiblesPorSede('uuid-sede');

      expect(result).toEqual(mockItems);
      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sede_id: 'uuid-sede',
            estado: 'disponible',
            activo: true
          }
        })
      );
    });

    it('debe ordenar por marca y modelo ASC', async () => {
      await inventarioService.obtenerDisponiblesPorSede('uuid-sede');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['marca', 'ASC'], ['modelo', 'ASC']]
        })
      );
    });
  });

  describe('obtenerPorSede()', () => {
    const mockItems = [
      { id: '1', marca: 'HP', estado: 'disponible' },
      { id: '2', marca: 'Dell', estado: 'en_uso' }
    ];

    beforeEach(() => {
      Inventario.findAll = jest.fn().mockResolvedValue(mockItems);
    });

    it('debe obtener todos los items activos de una sede', async () => {
      const result = await inventarioService.obtenerPorSede('uuid-sede');

      expect(result).toEqual(mockItems);
      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sede_id: 'uuid-sede',
            activo: true
          }
        })
      );
    });

    it('debe ordenar por estado, marca', async () => {
      await inventarioService.obtenerPorSede('uuid-sede');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['estado', 'ASC'], ['marca', 'ASC']]
        })
      );
    });
  });

  describe('obtenerHistorial()', () => {
    const inventarioId = 'uuid-item';
    const mockItem = {
      id: inventarioId,
      marca: 'HP',
      modelo: 'EliteBook',
      getDescripcionCompleta: jest.fn(() => 'HP EliteBook 840'),
      getIdentificacion: jest.fn(() => 'HP EliteBook')
    };

    const mockHistorial = [
      { id: 'h1', fecha_movimiento: '2025-01-10', tipo_movimiento: 'transferencia' },
      { id: 'h2', fecha_movimiento: '2025-01-05', tipo_movimiento: 'asignacion' }
    ];

    beforeEach(() => {
      Inventario.findByPk = jest.fn().mockResolvedValue(mockItem);
      HistorialMovimiento.findAll = jest.fn().mockResolvedValue(mockHistorial);
    });

    it('debe obtener historial de un item', async () => {
      const result = await inventarioService.obtenerHistorial(inventarioId);

      expect(result.item).toBeDefined();
      expect(result.historial).toEqual(mockHistorial);
      expect(HistorialMovimiento.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inventario_id: inventarioId }
        })
      );
    });

    it('debe lanzar error si item no existe', async () => {
      Inventario.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        inventarioService.obtenerHistorial(inventarioId)
      ).rejects.toThrow('Item de inventario no encontrado');
    });

    it('debe aplicar límite al historial', async () => {
      await inventarioService.obtenerHistorial(inventarioId, 10);

      expect(HistorialMovimiento.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10
        })
      );
    });
  });

  describe('obtenerEstadisticasGenerales()', () => {
    const mockEstadisticas = [{
      total: '10',
      disponible: '5',
      enUso: '3',
      mantenimiento: '1',
      dadoDeBaja: '1'
    }];

    const mockPorTipo = [
      { tipo_articulo_id: 'tipo-1', total: '6', 'tipoArticulo.nombre': 'Notebook' }
    ];

    const mockPorSede = [
      { sede_id: 'sede-1', total: '8', disponible: '4', 'sedePrincipal.nombre_sede': 'Sede A' }
    ];

    beforeEach(() => {
      Inventario.findAll = jest.fn()
        .mockResolvedValueOnce(mockEstadisticas)
        .mockResolvedValueOnce(mockPorTipo)
        .mockResolvedValueOnce(mockPorSede);
    });

    it('debe obtener estadísticas generales completas', async () => {
      const result = await inventarioService.obtenerEstadisticasGenerales();

      expect(result.resumen).toEqual({
        total: 10,
        disponible: 5,
        enUso: 3,
        mantenimiento: 1,
        dadoDeBaja: 1
      });
      expect(result.porTipo).toEqual(mockPorTipo);
      expect(result.porSede).toEqual(mockPorSede);
    });

    it('debe filtrar por sede_id si se proporciona', async () => {
      await inventarioService.obtenerEstadisticasGenerales('uuid-sede');

      expect(Inventario.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { activo: true, sede_id: 'uuid-sede' }
        })
      );
    });

    it('debe incluir resumen con contadores de estados', async () => {
      const result = await inventarioService.obtenerEstadisticasGenerales();

      expect(result.resumen).toHaveProperty('total');
      expect(result.resumen).toHaveProperty('disponible');
      expect(result.resumen).toHaveProperty('enUso');
      expect(result.resumen).toHaveProperty('mantenimiento');
      expect(result.resumen).toHaveProperty('dadoDeBaja');
    });

    it('debe incluir estadísticas porTipo y porSede', async () => {
      const result = await inventarioService.obtenerEstadisticasGenerales();

      expect(result.porTipo).toBeDefined();
      expect(result.porSede).toBeDefined();
      expect(Inventario.findAll).toHaveBeenCalledTimes(3);
    });
  });
});