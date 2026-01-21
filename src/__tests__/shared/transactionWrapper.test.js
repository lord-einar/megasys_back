
import { jest } from '@jest/globals';

// Use unstable_mockModule for ESM mocking support without babel
// This must be done BEFORE importing the modules under test

const mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
};

await jest.unstable_mockModule('../../shared/utils/database.js', () => ({
    sequelize: {
        transaction: jest.fn(() => Promise.resolve(mockTransaction)),
    },
}));

await jest.unstable_mockModule('../../shared/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

await jest.unstable_mockModule('../../shared/services/auditService.js', () => ({
    default: {
        registrarActividad: jest.fn(),
        registrarAccion: jest.fn(),
    },
}));

// Dynamic import after mocking
const { default: TransactionWrapper } = await import('../../shared/utils/transactionWrapper.js');
const { sequelize } = await import('../../shared/utils/database.js');
const { default: AuditService } = await import('../../shared/services/auditService.js');

describe('TransactionWrapper', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockTransaction.commit.mockClear();
        mockTransaction.rollback.mockClear();
        sequelize.transaction.mockClear();
    });

    describe('execute', () => {
        it('should execute operation and commit transaction on success', async () => {
            const mockResult = { success: true };
            const operation = jest.fn().mockResolvedValue(mockResult);

            const result = await TransactionWrapper.execute({
                operation,
                usuarioEmail: 'test@test.com',
                modulo: 'test',
                accion: 'test',
                recurso: 'test'
            });

            expect(sequelize.transaction).toHaveBeenCalled();
            expect(operation).toHaveBeenCalledWith(expect.anything());
            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(mockTransaction.rollback).not.toHaveBeenCalled();

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockResult);
        });

        it('should rollback transaction and throw error on failure', async () => {
            const error = new Error('Database error');
            const operation = jest.fn().mockRejectedValue(error);

            await expect(
                TransactionWrapper.execute({
                    operation,
                    usuarioEmail: 'test@test.com',
                    modulo: 'test',
                    accion: 'test',
                    recurso: 'test'
                })
            ).rejects.toThrow('Database error');

            expect(mockTransaction.commit).not.toHaveBeenCalled();
            expect(mockTransaction.rollback).toHaveBeenCalled();
        });

        it('should register audit log when transaction succeeds', async () => {
            const operation = jest.fn().mockResolvedValue({ id: 1 });
            const auditParams = {
                usuarioEmail: 'user@test.com',
                modulo: 'inventario',
                accion: 'crear',
                recurso: 'Inventario',
                recursoId: 1,
                descripcion: 'Test'
            };

            await TransactionWrapper.execute({ operation, ...auditParams });

            expect(AuditService.registrarAccion).toHaveBeenCalledWith(
                expect.objectContaining({
                    usuario_email: 'user@test.com',
                    modulo: 'inventario',
                    accion: 'crear',
                    recurso: 'Inventario'
                })
            );
        });
    });
});
