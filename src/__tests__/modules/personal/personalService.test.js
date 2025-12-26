// src/__tests__/modules/personal/personalService.test.js

// Mock de uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => '12345678-1234-1234-1234-123456789abc')
}));

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
  };
});

// Mock de servicios externos
jest.mock('../../../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../shared/utils/sistemasRoleAssignment', () => ({
  assignSistemasRoleIfAuthorized: jest.fn().mockResolvedValue(null)
}));

const personalService = require('../../../modules/personal/services/personalService');
const { Personal, Sede, Rol, PersonalSede, Remito, sequelize } = require('../../../models');
const { Op } = require('sequelize');

describe('PersonalService', () => {
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
          id: { [Op.ne]: personalId }
        }
      });
    });
  });

  describe('validarSedesActivas()', () => {
    it('debe pasar si todas las sedes son válidas y activas', async () => {
      const sedesIds = ['uuid-sede-1', 'uuid-sede-2'];
      Sede.count = jest.fn().mockResolvedValue(2);

      await expect(
        personalService.validarSedesActivas(sedesIds)
      ).resolves.not.toThrow();

      expect(Sede.count).toHaveBeenCalledWith({
        where: { id: sedesIds, activo: true }
      });
    });

    it('debe lanzar error si el array de sedes está vacío', async () => {
      await expect(
        personalService.validarSedesActivas([])
      ).rejects.toThrow('Debes seleccionar al menos una sede');
    });

    it('debe lanzar error si alguna sede no existe', async () => {
      const sedesIds = ['uuid-sede-1', 'uuid-sede-2', 'uuid-sede-3'];
      Sede.count = jest.fn().mockResolvedValue(2); // Solo 2 de 3 sedes válidas

      await expect(
        personalService.validarSedesActivas(sedesIds)
      ).rejects.toThrow('1 de las sedes seleccionadas no existen o están inactivas');
    });

    it('debe lanzar error si no es un array', async () => {
      await expect(
        personalService.validarSedesActivas(null)
      ).rejects.toThrow('Debes seleccionar al menos una sede');
    });
  });

  describe('validarRolActivo()', () => {
    it('debe pasar si el rol existe y está activo', async () => {
      const mockRol = { id: 'uuid-rol', nombre: 'Support', activo: true };
      Rol.findOne = jest.fn().mockResolvedValue(mockRol);

      const result = await personalService.validarRolActivo('uuid-rol');

      expect(result).toEqual(mockRol);
      expect(Rol.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-rol', activo: true }
      });
    });

    it('debe lanzar error si el rol no existe', async () => {
      Rol.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        personalService.validarRolActivo('uuid-inexistente')
      ).rejects.toThrow('El rol seleccionado no existe o no está disponible');
    });

    it('debe lanzar error si el rol está inactivo', async () => {
      Rol.findOne = jest.fn().mockResolvedValue(null); // findOne con activo: true retorna null

      await expect(
        personalService.validarRolActivo('uuid-rol-inactivo')
      ).rejects.toThrow('El rol seleccionado no existe o no está disponible');
    });
  });

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
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { nombre: { [Op.iLike]: '%Juan%' } },
              { apellido: { [Op.iLike]: '%Juan%' } },
              { email: { [Op.iLike]: '%Juan%' } }
            ])
          })
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

    it('debe ignorar personal_id si no es UUID válido', async () => {
      await personalService.listar({ personal_id: 'invalid-uuid' });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ id: expect.anything() })
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

    it('debe aplicar múltiples filtros simultáneamente', async () => {
      await personalService.listar({
        search: 'Juan',
        activo: true,
        rol_id: 'uuid-rol',
        sede_id: 'uuid-sede'
      });

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            rol_id: 'uuid-rol',
            [Op.or]: expect.any(Array)
          }),
          include: expect.arrayContaining([
            expect.objectContaining({
              model: PersonalSede,
              where: expect.objectContaining({ sede_id: 'uuid-sede' })
            })
          ])
        })
      );
    });

    it('debe incluir todas las relaciones necesarias', async () => {
      await personalService.listar({});

      expect(Personal.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: Rol, as: 'rol' }),
            expect.objectContaining({ model: Sede, as: 'sede' }),
            expect.objectContaining({ model: PersonalSede, as: 'sedesAsignadas' })
          ])
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
        include: expect.arrayContaining([
          expect.objectContaining({ model: Rol, as: 'rol' }),
          expect.objectContaining({ model: Sede, as: 'sede' }),
          expect.objectContaining({ model: PersonalSede, as: 'sedesAsignadas' })
        ])
      }));
    });

    it('debe retornar null si el personal no existe', async () => {
      Personal.findByPk = jest.fn().mockResolvedValue(null);

      const result = await personalService.obtenerConDetalles('uuid-inexistente');

      expect(result).toBeNull();
    });

    it('debe incluir sedesAsignadas activas solamente', async () => {
      Personal.findByPk = jest.fn().mockResolvedValue({});

      await personalService.obtenerConDetalles('uuid-personal');

      expect(Personal.findByPk).toHaveBeenCalledWith('uuid-personal', expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({
            model: PersonalSede,
            as: 'sedesAsignadas',
            where: { activo: true },
            required: false
          })
        ])
      }));
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

      expect(Remito.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              expect.objectContaining({ solicitante_id: 'uuid-personal' }),
              expect.objectContaining({ tecnico_asignado_id: 'uuid-personal' })
            ])
          })
        })
      );
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
      // Mocks de validación
      Personal.findOne = jest.fn().mockResolvedValue(null); // Email único
      Sede.count = jest.fn().mockResolvedValue(2); // Sedes válidas
      Rol.findOne = jest.fn().mockResolvedValue({ id: 'uuid-rol', activo: true });
      Rol.findByPk = jest.fn().mockResolvedValue({ id: 'uuid-rol', nombre: 'Support' });

      // Mock de creación
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

      // Mock de assignSistemasRoleIfAuthorized
      const { assignSistemasRoleIfAuthorized } = require('../../../shared/utils/sistemasRoleAssignment');
      assignSistemasRoleIfAuthorized.mockResolvedValue(null);
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
      Sede.count = jest.fn().mockResolvedValue(1); // Solo 1 de 2 sedes válidas

      await expect(
        personalService.crear(datosNueva, usuarioEmail)
      ).rejects.toThrow('1 de las sedes seleccionadas no existen o están inactivas');
    });

    it('debe lanzar error si el rol no es válido', async () => {
      Rol.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        personalService.crear(datosNueva, usuarioEmail)
      ).rejects.toThrow('El rol seleccionado no existe o no está disponible');
    });

    it('debe crear asignaciones a todas las sedes', async () => {
      await personalService.crear(datosNueva, usuarioEmail);

      expect(PersonalSede.create).toHaveBeenCalledTimes(2);
      expect(PersonalSede.create).toHaveBeenCalledWith(
        expect.objectContaining({
          personal_id: 'uuid-nuevo-personal',
          sede_id: 'uuid-sede-1',
          rol_id: 'uuid-rol',
          activo: true
        }),
        expect.objectContaining({ transaction: mockTransaction })
      );
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

    it('debe manejar rol Sistemas automático si aplica', async () => {
      const { assignSistemasRoleIfAuthorized } = require('../../../shared/utils/sistemasRoleAssignment');
      assignSistemasRoleIfAuthorized.mockResolvedValue({ newRoleId: 'uuid-rol-sistemas' });

      const mockPersona = {
        id: 'uuid-nuevo-personal',
        rol_id: 'uuid-rol-sistemas',
        reload: jest.fn().mockResolvedValue(undefined)
      };

      Personal.create = jest.fn().mockResolvedValue(mockPersona);

      await personalService.crear(datosNueva, usuarioEmail);

      expect(assignSistemasRoleIfAuthorized).toHaveBeenCalledWith(
        'uuid-nuevo-personal',
        'uuid-rol',
        mockTransaction
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
      Personal.findOne = jest.fn().mockResolvedValue(null); // Email único
      Rol.findOne = jest.fn().mockResolvedValue({ id: 'uuid-nuevo-rol', activo: true });
      Sede.count = jest.fn().mockResolvedValue(1); // Sedes válidas

      PersonalSede.update = jest.fn().mockResolvedValue([1]);
      PersonalSede.create = jest.fn().mockResolvedValue({ id: 'uuid-ps' });

      // Mock de obtenerConDetalles
      jest.spyOn(personalService, 'obtenerConDetalles').mockResolvedValue({
        id: personalId,
        nombre: 'Juan Carlos',
        email: 'nuevo@test.com'
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
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

      expect(Personal.findOne).toHaveBeenCalledWith({
        where: {
          email: 'nuevo@test.com',
          id: { [Op.ne]: personalId }
        }
      });
    });

    it('debe validar rol si se actualiza', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(Rol.findOne).toHaveBeenCalledWith({
        where: {
          id: 'uuid-nuevo-rol',
          activo: true
        }
      });
    });

    it('debe validar sedes si se actualizan', async () => {
      await personalService.actualizar(personalId, datosActualizacion, usuarioEmail);

      expect(Sede.count).toHaveBeenCalledWith({
        where: {
          id: ['uuid-sede-nueva'],
          activo: true
        }
      });
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
        { sede_id: 'uuid-sede-nueva' },
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
      Remito.count = jest.fn().mockResolvedValue(0); // Sin remitos pendientes
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
      await personalService.buscar('Juan');

      expect(Personal.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            [Op.or]: expect.arrayContaining([
              { nombre: { [Op.iLike]: '%Juan%' } }
            ])
          })
        })
      );
    });

    it('debe buscar por apellido', async () => {
      await personalService.buscar('Pérez');

      expect(Personal.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { apellido: { [Op.iLike]: '%Pérez%' } }
            ])
          })
        })
      );
    });

    it('debe buscar por email', async () => {
      await personalService.buscar('juan@test.com');

      expect(Personal.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { email: { [Op.iLike]: '%juan@test.com%' } }
            ])
          })
        })
      );
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

    it('debe filtrar por sede_id', async () => {
      await personalService.buscar('Juan', { sede_id: 'uuid-sede' });

      expect(Personal.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              model: PersonalSede,
              as: 'sedesAsignadas',
              where: { sede_id: 'uuid-sede', activo: true },
              required: true
            })
          ])
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
      sequelize.query = jest.fn().mockResolvedValue(mockEstadisticas);
    });

    it('debe obtener estadísticas por sede', async () => {
      const result = await personalService.obtenerEstadisticasPorSede();

      expect(result).toEqual(mockEstadisticas);
      expect(sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        { type: sequelize.QueryTypes.SELECT }
      );
    });

    it('debe ordenar por total_personal DESC', async () => {
      await personalService.obtenerEstadisticasPorSede();

      expect(sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_personal DESC'),
        expect.any(Object)
      );
    });
  });

  describe('obtenerEstadisticasGenerales()', () => {
    beforeEach(() => {
      Personal.count = jest.fn().mockResolvedValue(25);
      Sede.count = jest.fn().mockResolvedValue(10);
      sequelize.query = jest.fn().mockResolvedValue([{ total_roles: '5' }]);

      jest.spyOn(personalService, 'obtenerEstadisticasPorSede').mockResolvedValue([
        { id: 'sede-1', total_personal: '10' }
      ]);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('debe obtener estadísticas generales completas', async () => {
      const result = await personalService.obtenerEstadisticasGenerales();

      expect(result).toEqual({
        totalPersonal: 25,
        totalSedesUnicas: 10,
        totalRolesUnicos: '5',
        personal: { total: 25 },
        resumen: {
          totalPersonal: 25,
          totalSedes: 10,
          totalRoles: '5'
        },
        sedesConMasPersonal: [{ id: 'sede-1', total_personal: '10' }]
      });
    });

    it('debe incluir sedesConMasPersonal del método obtenerEstadisticasPorSede', async () => {
      const result = await personalService.obtenerEstadisticasGenerales();

      expect(result.sedesConMasPersonal).toBeDefined();
      expect(personalService.obtenerEstadisticasPorSede).toHaveBeenCalled();
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
        .mockResolvedValueOnce(null) // Primera consulta: activo
        .mockResolvedValueOnce(personalInactivo); // Segunda consulta: inactivo

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
