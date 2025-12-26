# Análisis de Tests Fallidos - RemitoService

## Resumen
- **Tests totales:** 25
- **Tests pasando:** 11 (44%)
- **Tests fallando:** 14 (56%)

## Categorías de Fallos

### 1. VALIDACIONES - Mocks Incorrectos (6 fallos)

#### Problema: `validarPersonaActiva()` y `validarSedeActiva()`
El servicio usa `findOne({ where: { id, activo: true } })` pero los tests mockeaban solo el valor de retorno sin considerar que cuando no encuentra nada retorna `null`.

**Código Real:**
```javascript
async validarPersonaActiva(personalId, label = 'Personal') {
  const persona = await Personal.findOne({
    where: { id: personalId, activo: true }
  });
  if (!persona) {
    throw new Error(`${label} no existe o no está activo`);
  }
  return persona;
}
```

**Problema en Tests:**
```javascript
// ❌ INCORRECTO - Solo mockea un caso
Personal.findOne = jest.fn().mockResolvedValue({ id: 'uuid', activo: true });
```

**✅ SOLUCIÓN:**
```javascript
// En el test que debe pasar:
it('debe pasar si persona existe y está activa', async () => {
  Personal.findOne = jest.fn().mockResolvedValue({
    id: 'uuid-persona',
    activo: true
  });

  await expect(
    remitoService.validarPersonaActiva('uuid-persona', 'Solicitante')
  ).resolves.not.toThrow();
});

// En el test que debe fallar (persona no existe):
it('debe lanzar error si persona no existe', async () => {
  Personal.findOne = jest.fn().mockResolvedValue(null); // ← Clave: null

  await expect(
    remitoService.validarPersonaActiva('uuid-inexistente', 'Solicitante')
  ).rejects.toThrow('no existe o no está activo'); // ← Mensaje exacto del servicio
});

// En el test persona inactiva:
it('debe lanzar error si persona está inactiva', async () => {
  // findOne con where activo: true retorna null si la persona está inactiva
  Personal.findOne = jest.fn().mockResolvedValue(null);

  await expect(
    remitoService.validarPersonaActiva('uuid-persona', 'Solicitante')
  ).rejects.toThrow('no existe o no está activo');
});
```

---

#### Problema: `validarInventarioDisponible()`
El servicio tiene lógica compleja con múltiples validaciones.

**Código Real:**
```javascript
async validarInventarioDisponible(inventarioId, sedeId) {
  const inventario = await Inventario.findOne({
    where: {
      id: inventarioId,
      sede_id: sedeId,
      activo: true,
      estado: { [Op.notIn]: ['en_uso', 'en_prestamo'] }
    }
  });

  if (!inventario) {
    throw new Error('El artículo no existe en la sede seleccionada o no está disponible');
  }
  // ... más validaciones
}
```

**✅ SOLUCIÓN:**
```javascript
it('debe pasar si inventario está disponible en la sede', async () => {
  Inventario.findOne = jest.fn().mockResolvedValue({
    id: 'uuid-inventario',
    sede_id: 'uuid-sede',
    activo: true,
    estado: 'disponible'  // ← Estado válido
  });

  // Mockear validación de remitos activos
  RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);
  Remito.findByPk = jest.fn(); // No se necesita si no hay detalles

  await expect(
    remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-sede')
  ).resolves.not.toThrow();
});

it('debe lanzar error si inventario está en otra sede', async () => {
  // findOne con where sede_id retorna null si es otra sede
  Inventario.findOne = jest.fn().mockResolvedValue(null);

  await expect(
    remitoService.validarInventarioDisponible('uuid-inventario', 'uuid-otra-sede')
  ).rejects.toThrow('no existe en la sede seleccionada o no está disponible');
});
```

---

### 2. CREAR() - Flujo Completo (6 fallos)

#### Problema: Mock de `obtener()` y flujo de creación
El servicio llama a `this.obtener(remito.id)` después de crear el remito para obtener los datos completos con relaciones, pero este método no estaba mockeado correctamente.

**✅ SOLUCIÓN:**
```javascript
beforeEach(() => {
  // Mock del flujo completo de validaciones
  Personal.findOne = jest.fn()
    .mockResolvedValueOnce({ id: 'uuid-solicitante', activo: true })  // Solicitante
    .mockResolvedValueOnce({ id: 'uuid-tecnico', activo: true });     // Técnico

  Sede.findOne = jest.fn()
    .mockResolvedValueOnce({ id: 'uuid-sede-origen', activo: true })   // Sede origen
    .mockResolvedValueOnce({ id: 'uuid-sede-destino', activo: true }); // Sede destino

  // Mock de validación de inventario (llamado 2 veces, una por artículo)
  Inventario.findOne = jest.fn().mockResolvedValue({
    id: 'uuid-inventario',
    sede_id: 'uuid-sede-origen',
    activo: true,
    estado: 'disponible'
  });

  // Mock de validación de artículo no en tránsito
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

  // ⭐ CRÍTICO: Mock de obtener() que se llama al final
  // Usar jest.spyOn para mockear método de la misma clase
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
```

---

### 3. CAMBIARESTADO() - Mocks de Remito (3 fallos)

#### Problema: El mock de `Remito.findByPk` debe retornar un objeto con método `update()`

**✅ SOLUCIÓN:**
```javascript
it('debe cambiar estado de "preparado" a "en_transito"', async () => {
  const mockRemito = {
    id: remitoId,
    numero_remito: 'REM-2025-001',
    estado: 'preparado',
    tecnico_asignado_id: 'uuid-tecnico',
    update: jest.fn().mockResolvedValue({
      id: remitoId,
      numero_remito: 'REM-2025-001',
      estado: 'en_transito'  // Estado actualizado
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

  const result = await remitoService.cambiarEstado(
    remitoId,
    'en_transito',
    usuarioId,
    options
  );

  expect(result).toBeDefined();
  expect(mockRemito.update).toHaveBeenCalledWith(
    { estado: 'en_transito' },
    expect.objectContaining({ transaction: expect.any(Object) })
  );
  expect(mockTransaction.commit).toHaveBeenCalled();
});
```

---

## Resumen de Cambios Necesarios

### Archivo: `src/__tests__/modules/remitos/remitoService.test.js`

**1. Actualizar describe('validaciones')**
```javascript
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
```

**2. Actualizar beforeEach de crear()**
```javascript
beforeEach(() => {
  // Limpiar todos los mocks
  jest.clearAllMocks();

  // Mock del flujo completo de validaciones con múltiples llamadas
  Personal.findOne = jest.fn()
    .mockResolvedValueOnce({ id: 'uuid-solicitante', activo: true })
    .mockResolvedValueOnce({ id: 'uuid-tecnico', activo: true });

  Sede.findOne = jest.fn()
    .mockResolvedValueOnce({ id: 'uuid-sede-origen', activo: true })
    .mockResolvedValueOnce({ id: 'uuid-sede-destino', activo: true });

  Inventario.findOne = jest.fn().mockResolvedValue({
    id: 'uuid-inventario',
    sede_id: 'uuid-sede-origen',
    activo: true,
    estado: 'disponible'
  });

  RemitoDetalle.findAll = jest.fn().mockResolvedValue([]);
  sequelize.query = jest.fn().mockResolvedValue([[{ numero: 1 }]]);

  Remito.create = jest.fn().mockResolvedValue({
    id: 'uuid-remito',
    numero_remito: 'REM-2025-001',
    estado: 'preparado'
  });

  RemitoDetalle.create = jest.fn().mockResolvedValue({
    id: 'uuid-detalle',
    remito_id: 'uuid-remito'
  });

  Inventario.update = jest.fn().mockResolvedValue([1]);
  HistorialMovimiento.create = jest.fn().mockResolvedValue({ id: 'uuid-historial' });

  // Mock de obtener
  jest.spyOn(remitoService, 'obtener').mockResolvedValue({
    id: 'uuid-remito',
    numero_remito: 'REM-2025-001',
    estado: 'preparado',
    detalles: [],
    toJSON: function() { return this; }
  });
});
```

**3. Actualizar tests de cambiarEstado()**
```javascript
describe('cambiarEstado()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockRemito = {
      id: remitoId,
      numero_remito: 'REM-2025-001',
      estado: 'preparado',
      tecnico_asignado_id: 'uuid-tecnico',
      update: jest.fn().mockResolvedValue({
        id: remitoId,
        estado: 'en_transito'
      })
    };

    Remito.findByPk = jest.fn().mockResolvedValue(mockRemito);

    jest.spyOn(remitoService, 'obtener').mockResolvedValue({
      id: remitoId,
      numero_remito: 'REM-2025-001',
      solicitante: { email: 'test@test.com' },
      toJSON: function() { return this; }
    });
  });

  // ... resto de tests
});
```

---

## Comandos para Verificar

```bash
# Ejecutar solo tests de remitos
npm test -- --testPathPattern=remitoService

# Ver detalles de fallos
npm test -- --testPathPattern=remitoService --verbose

# Ver cobertura
npm test -- --testPathPattern=remitoService --coverage
```

---

## Próximos Pasos

1. ✅ Aplicar las correcciones a `remitoService.test.js`
2. ✅ Verificar que los 25 tests pasen
3. ✅ Expandir a 50-70 tests agregando:
   - Tests para `listar()` con filtros
   - Tests para `generarDevolucion()`
   - Tests para `actualizarFechaDevolucion()`
   - Tests de integración de flujo completo
4. ✅ Crear tests similares para Personal e Inventario
