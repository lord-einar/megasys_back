// src/__tests__/modules/inventario/inventarioService.test.js
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
  query: jest.fn(),
  QueryTypes: { SELECT: 'SELECT' },
  fn: jest.fn((fn, col) => ({ fn, col })),
  col: jest.fn((col) => ({ col })),
  literal: jest.fn((literal) => ({ literal }))
};

// Mock de modelos - usando ruta absoluta
const modelsPath = resolve(__dirname, '../../../models/index.js');
await jest.unstable_mockModule(modelsPath, () => ({
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
  Personal: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  Rol: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  sequelize: mockSequelize
}));

// Mock de CommonValidators
const commonValidatorsPath = resolve(__dirname, '../../../shared/validators/commonValidators.js');
await jest.unstable_mockModule(commonValidatorsPath, () => ({
  default: {
    validarPersonaActiva: jest.fn(),
    validarSedeActiva: jest.fn(),
    validarTipoArticuloActivo: jest.fn(),
    validarRolActivo: jest.fn(),
    validarSedesActivas: jest.fn(),
    esUuidValido: jest.fn()
  }
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

// Mock de database
const databasePath = resolve(__dirname, '../../../shared/utils/database.js');
await jest.unstable_mockModule(databasePath, () => ({
  sequelize: mockSequelize
}));

// Importar módulos mockeados - usando rutas absolutas
const servicePath = resolve(__dirname, '../../../modules/inventario/services/inventarioService.js');
const { default: inventarioService } = await import(servicePath);
const { Inventario, TipoArticulo, Sede, HistorialMovimiento, RemitoDetalle, Remito, sequelize } = await import(modelsPath);
const { default: TransactionWrapper } = await import(transactionWrapperPath);

// Crear mock de Op manualmente para tests
const Op = {
  ne: Symbol('ne'),
  or: Symbol('or'),
  iLike: Symbol('iLike'),
  gte: Symbol('gte'),
  lte: Symbol('lte'),
  between: Symbol('between'),
  in: Symbol('in')
};

// Importar CommonValidators mockeado para usar en tests
const { default: CommonValidators } = await import(commonValidatorsPath);

describe('InventarioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  // NOTA: Los métodos validarTipoArticuloActivo() y validarSedeActiva()
  // fueron movidos a CommonValidators durante la refactorización.
  // Sus tests están ahora en commonValidators.test.js

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

      expect(Inventario.findOne).toHaveBeenCalled();
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
      // Mockear CommonValidators para que pasen las validaciones
      CommonValidators.validarTipoArticuloActivo = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });
      CommonValidators.validarSedeActiva = jest.fn().mockResolvedValue({ id: 'uuid-sede', activo: true });

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
      CommonValidators.validarTipoArticuloActivo = jest.fn().mockRejectedValue(
        new Error('El tipo de artículo no existe o no está disponible')
      );

      await expect(
        inventarioService.crear(datosNuevo, usuarioEmail)
      ).rejects.toThrow('El tipo de artículo no existe o no está disponible');
    });

    it('debe lanzar error si sede_id es inválida', async () => {
      CommonValidators.validarSedeActiva = jest.fn().mockRejectedValue(
        new Error('La sede no existe o no está disponible')
      );

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
      // Mockear CommonValidators
      CommonValidators.validarTipoArticuloActivo = jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true });
      CommonValidators.validarSedeActiva = jest.fn().mockResolvedValue({ id: 'uuid-sede-nueva', activo: true });
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

      expect(CommonValidators.validarTipoArticuloActivo).toHaveBeenCalledWith('uuid-tipo-nuevo');
    });

    it('debe validar sede_id si cambia', async () => {
      await inventarioService.actualizar(inventarioId, datosActualizacion, usuarioEmail);

      expect(CommonValidators.validarSedeActiva).toHaveBeenCalledWith('uuid-sede-nueva');
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
