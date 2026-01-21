// src/__tests__/modules/personal/personalService.test.js
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mocks de sequelize
const mockTransaction = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined)
};

const mockSequelize = {
  transaction: jest.fn().mockResolvedValue(mockTransaction),
  query: jest.fn(),
  QueryTypes: { SELECT: 'SELECT' }
};

// Mock de Op (Sequelize operators)
const Op = {
  iLike: Symbol('iLike'),
  or: Symbol('or'),
  ne: Symbol('ne'),
  in: Symbol('in'),
  and: Symbol('and')
};

// Definir rutas absolutas ANTES del mock
const modelsPath = resolve(__dirname, '../../../models/index.js');
const loggerPath = resolve(__dirname, '../../../shared/utils/logger.js');
const sistemasRolePath = resolve(__dirname, '../../../shared/utils/sistemasRoleAssignment.js');
const commonValidatorsPath = resolve(__dirname, '../../../shared/validators/commonValidators.js');
const servicePath = resolve(__dirname, '../../../modules/personal/services/personalService.js');

// Mock de modelos
await jest.unstable_mockModule(modelsPath, () => ({
  Personal: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  Sede: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn()
  },
  Rol: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn()
  },
  PersonalSede: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn()
  },
  Remito: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn()
  },
  sequelize: mockSequelize
}));

// Mock de logger
await jest.unstable_mockModule(loggerPath, () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock de sistemasRoleAssignment
await jest.unstable_mockModule(sistemasRolePath, () => ({
  assignSistemasRoleIfAuthorized: jest.fn().mockResolvedValue(null)
}));

// Mock de CommonValidators
await jest.unstable_mockModule(commonValidatorsPath, () => ({
  default: {
    validarSedeActiva: jest.fn().mockResolvedValue({ id: 'uuid-sede', activo: true }),
    validarTipoArticuloActivo: jest.fn().mockResolvedValue({ id: 'uuid-tipo', activo: true }),
    validarPersonalActivo: jest.fn().mockResolvedValue({ id: 'uuid-personal', activo: true }),
    validarRolActivo: jest.fn().mockResolvedValue({ id: 'uuid-rol', activo: true }),
    validarEmpresaActiva: jest.fn().mockResolvedValue({ id: 'uuid-empresa', activo: true })
  }
}));

// Importar DESPUÉS de los mocks
const { Personal, Sede, Rol, PersonalSede, Remito, sequelize } = await import(modelsPath);
const { assignSistemasRoleIfAuthorized } = await import(sistemasRolePath);
const { default: CommonValidators } = await import(commonValidatorsPath);
const { default: personalService } = await import(servicePath);

describe('PersonalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSequelize.transaction.mockResolvedValue(mockTransaction);
    mockTransaction.commit.mockResolvedValue(undefined);
    mockTransaction.rollback.mockResolvedValue(undefined);
  });

  describe('validarEmailUnico()', () => {
    it('debe pasar si el email es único', async () => {
      Personal.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        personalService.validarEmailUnico('nuevo@test.com')
      ).resolves.not.toThrow();

      expect(Personal.findOne).toHaveBeenCalledWith({
        where: { email: 'nuevo@test.com' }
      });
    });

    it('debe lanzar error si el email ya existe', async () => {
      Personal.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-existente',
        email: 'existente@test.com'
      });

      await expect(
        personalService.validarEmailUnico('existente@test.com')
      ).rejects.toThrow('El email "existente@test.com" ya está registrado en el sistema');
    });

    it('debe pasar si el email existe pero es del mismo usuario (excluir)', async () => {
      const personalId = 'uuid-mismo-usuario';

      Personal.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        personalService.validarEmailUnico('mismo@test.com', personalId)
      ).resolves.not.toThrow();

      expect(Personal.findOne).toHaveBeenCalledWith({
        where: {
          email: 'mismo@test.com',
          id: expect.objectContaining({})
        }
      });
    });
  });

  // NOTA: validarSedesActivas() y validarRolActivo() fueron movidos a CommonValidators
  // Las validaciones se testean indirectamente a través de crear() y actualizar()

  describe('listar()', () => {
    const createMockPersonal = (data) => ({
      ...data,
      toJSON: function() { return this; }
    });

    beforeEach(() => {
      Personal.findAndCountAll = jest.fn().mockResolvedValue({
        rows: [
          createMockPersonal({ id: '1', nombre: 'Juan', apellido: 'Pérez', activo: true }),
          createMockPersonal({ id: '2', nombre: 'María', apellido: 'González', activo: true })
        ],
        count: 2
      });
    });

    it('debe listar personal con paginación por defecto', async () => {
      const result = await personalService.listar({});

      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2
      });
    });

    it('debe aplicar paginación personalizada', async () => {
      await personalService.listar({ page: 2, limit: 5 });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });

    it('debe filtrar por search (nombre, apellido, email)', async () => {
      await personalService.listar({ search: 'Juan' });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({})
        })
      );
    });

    it('debe filtrar por activo=true', async () => {
      await personalService.listar({ activo: true });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true })
        })
      );
    });

    it('debe filtrar por activo=false', async () => {
      await personalService.listar({ activo: false });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: false })
        })
      );
    });

    it('debe filtrar por rol_id', async () => {
      await personalService.listar({ rol_id: 'uuid-rol' });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ rol_id: 'uuid-rol' })
        })
      );
    });

    it('debe filtrar por personal_id (UUID válido)', async () => {
      const personalId = '12345678-1234-1234-1234-123456789abc';

      await personalService.listar({ personal_id: personalId });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: personalId })
        })
      );
    });

    it('debe mostrar solo activos por defecto', async () => {
      await personalService.listar({});

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true })
        })
      );
    });

    it('debe ordenar por apellido y nombre ASC', async () => {
      await personalService.listar({});

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['apellido', 'ASC'], ['nombre', 'ASC']]
        })
      );
    });
  });

  describe('obtenerConDetalles()', () => {
    it('debe obtener personal con detalles completos', async () => {
      const mockPersonal = {
        id: 'uuid-personal',
        nombre: 'Juan',
        apellido: 'Pérez',
        rol: { id: 'uuid-rol', nombre: 'Support' },
        sede: { id: 'uuid-sede', nombre_sede: 'Sede A' },
        sedesAsignadas: []
      };

      Personal.findByPk = jest.fn().mockResolvedValue(mockPersonal);

      const result = await personalService.obtenerConDetalles('uuid-personal');

      expect(result).toEqual(mockPersonal);
      expect(Personal.findByPk).toHaveBeenCalledWith('uuid-personal', expect.objectContaining({
        include: expect.any(Array)
      }));
    });

    it('debe retornar null si el personal no existe', async () => {
      Personal.findByPk = jest.fn().mockResolvedValue(null);

      const result = await personalService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('calcularEstadisticasRemitos()', () => {
    it('debe calcular estadísticas de remitos correctamente', async () => {
      const persona = { id: 'uuid-personal' };

      Remito.count = jest.fn()
        .mockResolvedValueOnce(5) // remitosSolicitados
        .mockResolvedValueOnce(3); // remitosAsignados

      const result = await personalService.calcularEstadisticasRemitos(persona);

      expect(result).toEqual({
        remitosSolicitados: 5,
        remitosAsignados: 3,
        total: 8
      });
    });

    it('debe manejar persona sin remitos', async () => {
      const persona = { id: 'uuid-personal' };

      Remito.count = jest.fn().mockResolvedValue(0);

      const result = await personalService.calcularEstadisticasRemitos(persona);

      expect(result).toEqual({
        remitosSolicitados: 0,
        remitosAsignados: 0,
        total: 0
      });
    });
  });

  describe('obtenerRemitos()', () => {
    const mockRemitos = {
      rows: [{ id: 'rem-1' }, { id: 'rem-2' }],
      count: 2
    };

    beforeEach(() => {
      Remito.findAndCountAll = jest.fn().mockResolvedValue(mockRemitos);
    });

    it('debe obtener remitos solicitados', async () => {
      await personalService.obtenerRemitos('uuid-personal', { tipo: 'solicitados' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ solicitante_id: 'uuid-personal' })
        })
      );
    });

    it('debe obtener remitos asignados', async () => {
      await personalService.obtenerRemitos('uuid-personal', { tipo: 'asignados' });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tecnico_asignado_id: 'uuid-personal' })
        })
      );
    });

    it('debe obtener todos los remitos', async () => {
      await personalService.obtenerRemitos('uuid-personal', { tipo: 'todos' });

      expect(Remito.findAndCountAll).toHaveBeenCalled();
    });

    it('debe filtrar por estado', async () => {
      await personalService.obtenerRemitos('uuid-personal', {
        tipo: 'solicitados',
        estado: 'en_transito'
      });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'en_transito' })
        })
      );
    });

    it('debe aplicar paginación', async () => {
      await personalService.obtenerRemitos('uuid-personal', {
        tipo: 'todos',
        page: 2,
        limit: 5
      });

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5
        })
      );
    });
  });

  describe('crear()', () => {
    const datosNueva = {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan.perez@test.com',
      telefono: '123456789',
      sedes: ['uuid-sede-1', 'uuid-sede-2'],
      rol_id: 'uuid-rol',
      color: '#007bff'
    };
    const usuarioEmail = 'admin@test.com';

    beforeEach(() => {
      Personal.findOne = jest.fn().mockResolvedValue(null);
      Sede.count = jest.fn().mockResolvedValue(2);
      Rol.findOne = jest.fn().mockResolvedValue({ id: 'uuid-rol', activo: true });
      Rol.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-rol', nombre: 'Support' });

      Personal.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo-personal',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan.perez@test.com',
        rol_id: 'uuid-rol',
        sede_id: 'uuid-sede-1',
        reload: jest.fn().mockResolvedValue(undefined)
      });

      PersonalSede.create = jest.fn().mockResolvedValue({
        id: 'uuid-personal-sede'
      });

      assignSistemasRoleIfAuthorized.mockResolvedValue(null);

      // Resetear mocks de CommonValidators
      CommonValidators.validarSedesActivas = jest.fn().mockResolvedValue(undefined);
      CommonValidators.validarRolActivo = jest.fn().mockResolvedValue({ id: 'uuid-rol', activo: true });
    });

    it('debe crear personal exitosamente', async () => {
      const result = await personalService.crear(datosNueva, usuarioEmail);

      expect(result).toBeDefined();
      expect(result.id).toBe('uuid-nuevo-personal');
      expect(Personal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan.perez@test.com',
          rol_id: 'uuid-rol',
          sede_id: 'uuid-sede-1',
          activo: true
        }),
        expect.objectContaining({ transaction: mockTransaction })
      );
    });

    it('debe lanzar error si el email no es único', async () => {
      Personal.findOne = jest.fn().mockResolvedValue({
        id: 'uuid-existente',
        email: 'juan.perez@test.com'
      });

      await expect(
        personalService.crear(datosNueva, usuarioEmail)
      ).rejects.toThrow('El email "juan.perez@test.com" ya está registrado en el sistema');
    });

    it('debe lanzar error si las sedes no son válidas', async () => {
      CommonValidators.validarSedesActivas = jest.fn().mockRejectedValue(
        new Error('1 de las sedes seleccionadas no existen o están inactivas')
      );

      await expect(
        personalService.crear(datosNueva, usuarioEmail)
      ).rejects.toThrow('1 de las sedes seleccionadas no existen o están inactivas');
    });

    it('debe lanzar error si el rol no es válido', async () => {
      CommonValidators.validarRolActivo = jest.fn().mockRejectedValue(
        new Error('El rol seleccionado no existe o no está disponible')
      );

      await expect(
        personalService.crear(datosNueva, usuarioEmail)
      ).rejects.toThrow('El rol seleccionado no existe o no está disponible');
    });

    it('debe crear asignaciones a todas las sedes', async () => {
      await personalService.crear(datosNueva, usuarioEmail);

      expect(PersonalSede.create).toHaveBeenCalledTimes(2);
    });

    it('debe normalizar email a lowercase', async () => {
      const datosConEmailMayusculas = {
        ...datosNueva,
        email: 'JUAN.PEREZ@TEST.COM'
      };

      await personalService.crear(datosConEmailMayusculas, usuarioEmail);

      expect(Personal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'juan.perez@test.com'
        }),
        expect.any(Object)
      );
    });

    it('debe trimear strings', async () => {
      const datosConEspacios = {
        ...datosNueva,
        nombre: '  Juan  ',
        apellido: '  Pérez  ',
        email: '  juan.perez@test.com  '
      };

      await personalService.crear(datosConEspacios, usuarioEmail);

      expect(Personal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan.perez@test.com'
        }),
        expect.any(Object)
      );
    });

    it('debe asignar la primera sede como principal', async () => {
      await personalService.crear(datosNueva, usuarioEmail);

      expect(Personal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sede_id: 'uuid-sede-1'
        }),
        expect.any(Object)
      );
    });

    it('debe hacer commit si no hay transaction externa', async () => {
      await personalService.crear(datosNueva, usuarioEmail);

      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe usar transaction externa si se proporciona', async () => {
      const transactionExterna = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      await personalService.crear(datosNueva, usuarioEmail, {
        transaction: transactionExterna
      });

      expect(transactionExterna.commit).not.toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('debe hacer rollback en caso de error', async () => {
      Personal.create = jest.fn().mockRejectedValue(new Error('Error de DB'));

      await expect(
        personalService.crear(datosNueva, usuarioEmail)
      ).rejects.toThrow('Error de DB');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('actualizar()', () => {
    const personalId = 'uuid-personal';
    const datosActualizacion = {
      nombre: 'Juan Carlos',
      email: 'nuevo@test.com',
      rol_id: 'uuid-nuevo-rol',
      sedes: ['uuid-sede-nueva']
    };
    const usuarioEmail = 'admin@test.com';

    let mockPersona;

    beforeEach(() => {
      mockPersona = {
        id: personalId,
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'viejo@test.com',
        rol_id: 'uuid-rol-viejo',
        update: jest.fn().mockResolvedValue(undefined)
      };

      Personal.findByPk = jest.fn().mockResolvedValue(mockPersona);
      Personal.findOne = jest.fn().mockResolvedValue(null);
      Sede.count = jest.fn().mockResolvedValue(1);

      PersonalSede.update = jest.fn().mockResolvedValue([1]);
      PersonalSede.create = jest.fn().mockResolvedValue({ id: 'uuid-ps' });

      // Resetear mocks de CommonValidators
      CommonValidators.validarSedesActivas = jest.fn().mockResolvedValue(undefined);
      CommonValidators.validarRolActivo = jest.fn().mockResolvedValue({ id: 'uuid-nuevo-rol', activo: true });
    });

    it('debe actualizar personal exitosamente', async () => {
      const result = await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(result).toBeDefined();
      expect(mockPersona.update).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si personal no existe', async () => {
      Personal.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        personalService.actualizar(personalId, datosActualizacion, usuarioEmail)
      ).rejects.toThrow('Personal no encontrado');
    });

    it('debe validar email si se actualiza', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(Personal.findOne).toHaveBeenCalled();
    });

    it('debe validar rol si se actualiza', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(CommonValidators.validarRolActivo).toHaveBeenCalledWith('uuid-nuevo-rol');
    });

    it('debe validar sedes si se actualizan', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(CommonValidators.validarSedesActivas).toHaveBeenCalledWith(['uuid-sede-nueva']);
    });

    it('debe actualizar sedes correctamente', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(PersonalSede.create).toHaveBeenCalledWith(
        expect.objectContaining({
          personal_id: personalId,
          sede_id: 'uuid-sede-nueva',
          activo: true
        }),
        expect.objectContaining({ transaction: mockTransaction })
      );
    });

    it('debe desactivar sedes previas al actualizar sedes', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(PersonalSede.update).toHaveBeenCalledWith(
        { activo: false, fecha_fin: expect.any(Date) },
        expect.objectContaining({
          where: { personal_id: personalId, activo: true },
          transaction: mockTransaction
        })
      );
    });

    it('debe actualizar sede principal a primera sede de la lista', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(mockPersona.update).toHaveBeenCalledWith(
        expect.objectContaining({ sede_id: 'uuid-sede-nueva' }),
        { transaction: mockTransaction }
      );
    });

    it('debe normalizar datos (email lowercase, trim)', async () => {
      const datosConEspacios = {
        nombre: '  Juan Carlos  ',
        email: '  NUEVO@TEST.COM  '
      };

      await personalService.actualizar(personalId, datosConEspacios, usuarioEmail);

      expect(mockPersona.update).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan Carlos',
          email: 'nuevo@test.com'
        }),
        expect.any(Object)
      );
    });

    it('debe convertir telefono vacío a null', async () => {
      const datosConTelefonoVacio = {
        telefono: ''
      };

      await personalService.actualizar(personalId, datosConTelefonoVacio, usuarioEmail);

      expect(mockPersona.update).toHaveBeenCalledWith(
        expect.objectContaining({
          telefono: null
        }),
        expect.any(Object)
      );
    });

    it('debe hacer commit si no hay transaction externa', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe usar transaction externa si se proporciona', async () => {
      const transactionExterna = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail, {
        transaction: transactionExterna
      });

      expect(transactionExterna.commit).not.toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('debe hacer rollback en caso de error', async () => {
      mockPersona.update = jest.fn().mockRejectedValue(new Error('Error de DB'));

      await expect(
        personalService.actualizar(personalId, datosActualizacion, usuarioEmail)
      ).rejects.toThrow('Error de DB');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('verificarRemitosPendientes()', () => {
    it('debe pasar si no hay remitos pendientes', async () => {
      Remito.count = jest.fn().mockResolvedValue(0);

      await expect(
        personalService.verificarRemitosPendientes('uuid-personal')
      ).resolves.not.toThrow();
    });

    it('debe lanzar error si hay remitos pendientes', async () => {
      Remito.count = jest.fn().mockResolvedValue(3);

      await expect(
        personalService.verificarRemitosPendientes('uuid-personal')
      ).rejects.toThrow('No se puede eliminar el personal. Existen 3 remito(s) pendiente(s)');
    });
  });

  describe('eliminar()', () => {
    const personalId = 'uuid-personal';
    const usuarioEmail = 'admin@test.com';

    let mockPersona;

    beforeEach(() => {
      mockPersona = {
        id: personalId,
        nombre: 'Juan',
        email: 'juan@test.com',
        update: jest.fn().mockResolvedValue(undefined)
      };

      Personal.findByPk = jest.fn().mockResolvedValue(mockPersona);
      Remito.count = jest.fn().mockResolvedValue(0);
      PersonalSede.update = jest.fn().mockResolvedValue([1]);
    });

    it('debe eliminar personal exitosamente (soft delete)', async () => {
      const result = await personalService.eliminar(personalId, usuarioEmail);

      expect(result).toBe(true);
      expect(mockPersona.update).toHaveBeenCalledWith(
        { activo: false },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe lanzar error si personal no existe', async () => {
      Personal.findByPk = jest.fn().mockResolvedValue(null);

      await expect(
        personalService.eliminar(personalId, usuarioEmail)
      ).rejects.toThrow('Personal no encontrado');
    });

    it('debe lanzar error si hay remitos pendientes', async () => {
      Remito.count = jest.fn().mockResolvedValue(2);

      await expect(
        personalService.eliminar(personalId, usuarioEmail)
      ).rejects.toThrow('No se puede eliminar el personal. Existen 2 remito(s) pendiente(s)');
    });

    it('debe desactivar asignaciones de sedes', async () => {
      await personalService.eliminar(personalId, usuarioEmail);

      expect(PersonalSede.update).toHaveBeenCalledWith(
        { activo: false, fecha_fin: expect.any(Date) },
        expect.objectContaining({
          where: { personal_id: personalId },
          transaction: mockTransaction
        })
      );
    });

    it('debe marcar activo como false', async () => {
      await personalService.eliminar(personalId, usuarioEmail);

      expect(mockPersona.update).toHaveBeenCalledWith(
        { activo: false },
        expect.objectContaining({ transaction: mockTransaction })
      );
    });

    it('debe hacer commit si no hay transaction externa', async () => {
      await personalService.eliminar(personalId, usuarioEmail);

      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe usar transaction externa si se proporciona', async () => {
      const transactionExterna = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      await personalService.eliminar(personalId, usuarioEmail, {
        transaction: transactionExterna
      });

      expect(transactionExterna.commit).not.toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('debe hacer rollback en caso de error', async () => {
      mockPersona.update = jest.fn().mockRejectedValue(new Error('Error de DB'));

      await expect(
        personalService.eliminar(personalId, usuarioEmail)
      ).rejects.toThrow('Error de DB');

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('buscar()', () => {
    const mockResultados = [
      { id: '1', nombre: 'Juan', apellido: 'Pérez' },
      { id: '2', nombre: 'María', apellido: 'González' }
    ];

    beforeEach(() => {
      Personal.findAll = jest.fn().mockResolvedValue(mockResultados);
    });

    it('debe buscar por nombre', async () => {
      const result = await personalService.buscar('Juan');

      expect(Personal.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockResultados);
    });

    it('debe filtrar por rol_id', async () => {
      await personalService.buscar('Juan', { rol_id: 'uuid-rol' });

      expect(Personal.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rol_id: 'uuid-rol'
          })
        })
      );
    });
  });

  describe('obtenerEstadisticasPorSede()', () => {
    const mockEstadisticas = [
      { id: 'sede-1', nombre_sede: 'Sede A', total_personal: '10' },
      { id: 'sede-2', nombre_sede: 'Sede B', total_personal: '5' }
    ];

    beforeEach(() => {
      mockSequelize.query = jest.fn().mockResolvedValue(mockEstadisticas);
    });

    it('debe obtener estadísticas por sede', async () => {
      const result = await personalService.obtenerEstadisticasPorSede();

      expect(result).toEqual(mockEstadisticas);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Object)
      );
    });

    it('debe ordenar por total_personal DESC', async () => {
      await personalService.obtenerEstadisticasPorSede();

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_personal DESC'),
        expect.any(Object)
      );
    });
  });

  describe('obtenerEstadisticasGenerales()', () => {
    beforeEach(() => {
      Personal.count = jest.fn().mockResolvedValue(25);
      Sede.count = jest.fn().mockResolvedValue(10);
      mockSequelize.query = jest.fn().mockResolvedValue([{ total_roles: '5' }]);
    });

    it('debe obtener estadísticas generales completas', async () => {
      const result = await personalService.obtenerEstadisticasGenerales();

      expect(result).toBeDefined();
      expect(result.totalPersonal).toBe(25);
      expect(result.totalSedesUnicas).toBe(10);
    });
  });

  describe('autoProvisionarPersonal()', () => {
    const azureUser = {
      id: 'azure-id-12345',
      email: 'nuevo@test.com',
      name: 'Juan Pérez'
    };
    const roleInfo = {
      role: 'support'
    };

    beforeEach(() => {
      Personal.findOne = jest.fn().mockResolvedValue(null);
      Personal.create = jest.fn().mockResolvedValue({
        id: 'uuid-nuevo',
        email: 'nuevo@test.com',
        privilegio_app: 'support'
      });
    });

    it('debe retornar personal existente si ya está activo', async () => {
      const personalExistente = {
        id: 'uuid-existente',
        email: 'nuevo@test.com',
        activo: true,
        privilegio_app: 'support'
      };

      Personal.findOne = jest.fn().mockResolvedValue(personalExistente);

      const result = await personalService.autoProvisionarPersonal(azureUser, roleInfo);

      expect(result).toEqual(personalExistente);
      expect(Personal.create).not.toHaveBeenCalled();
    });

    it('debe reactivar personal inactivo', async () => {
      const personalInactivo = {
        id: 'uuid-inactivo',
        email: 'nuevo@test.com',
        activo: false,
        privilegio_app: 'user',
        update: jest.fn().mockResolvedValue(undefined)
      };

      Personal.findOne = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(personalInactivo);

      const result = await personalService.autoProvisionarPersonal(azureUser, roleInfo);

      expect(result).toEqual(personalInactivo);
      expect(personalInactivo.update).toHaveBeenCalledWith(
        { activo: true, privilegio_app: 'support' },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe crear nuevo personal si no existe', async () => {
      const result = await personalService.autoProvisionarPersonal(azureUser, roleInfo);

      expect(result.email).toBe('nuevo@test.com');
      expect(Personal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'nuevo@test.com',
          privilegio_app: 'support',
          activo: true,
          sede_id: null,
          rol_id: null
        }),
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('debe asignar privilegio_app del rol Azure AD', async () => {
      const roleInfoAdmin = { role: 'super_admin' };

      await personalService.autoProvisionarPersonal(azureUser, roleInfoAdmin);

      expect(Personal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          privilegio_app: 'super_admin'
        }),
        expect.any(Object)
      );
    });

    it('debe generar UUID válido para id', async () => {
      await personalService.autoProvisionarPersonal(azureUser, roleInfo);

      const createCall = Personal.create.mock.calls[0][0];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(createCall.id)).toBe(true);
    });

    it('debe manejar errores sin fallar autenticación', async () => {
      Personal.create = jest.fn().mockRejectedValue(new Error('Error de DB'));

      const result = await personalService.autoProvisionarPersonal(azureUser, roleInfo);

      expect(result).toBeNull();
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });
});
