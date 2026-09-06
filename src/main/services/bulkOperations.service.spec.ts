import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkOperationsService } from './bulkOperations.service';

function createMockPrisma() {
  return {
    voucherSequence: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  } as any;
}

function createMockEngine() {
  return { createBulkMovements: vi.fn() };
}

describe('BulkOperationsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let engine: ReturnType<typeof createMockEngine>;
  let service: BulkOperationsService;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = createMockEngine();
    service = new BulkOperationsService(prisma);
    (service as any).engine = engine;
  });

  describe('bulkUninstall', () => {
    it('should use TransactionEngine with movementType UN', async () => {
      engine.createBulkMovements.mockResolvedValue({
        results: [{ success: true, transactionId: 1, voucherNo: 'UN-000001' }],
        failedIndex: -1,
        error: '',
      });

      const result = await service.bulkUninstall({
        companyId: 1,
        financialYearId: 1,
        storeId: 5,
        transactionDate: new Date(),
        items: [{ itemId: 10, quantity: 3 }],
        createdBy: 'admin',
      });

      expect(engine.createBulkMovements).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: 'UN',
            fromStoreId: 5,
            items: [{ itemId: 10, quantity: 3 }],
          }),
        ]),
      );
      expect(result.processedItems).toBe(1);
      expect(result.failedItems).toBe(0);
    });

    it('should require storeId in input', async () => {
      engine.createBulkMovements.mockResolvedValue({
        results: [{ success: true, transactionId: 1 }],
        failedIndex: -1,
        error: '',
      });

      const result = await service.bulkUninstall({
        companyId: 1,
        financialYearId: 1,
        storeId: 5,
        transactionDate: new Date(),
        items: [{ itemId: 10, quantity: 3 }],
        createdBy: 'admin',
      });

      expect(result.success).toBe(true);
    });

    it('should report failures when engine returns failure', async () => {
      engine.createBulkMovements.mockResolvedValue({
        results: [],
        failedIndex: 0,
        error: 'Insufficient stock',
      });

      const result = await service.bulkUninstall({
        companyId: 1,
        financialYearId: 1,
        storeId: 5,
        transactionDate: new Date(),
        items: [{ itemId: 10, quantity: 3 }],
        createdBy: 'admin',
      });

      expect(result.failedItems).toBe(1);
      expect(result.errors[0].error).toBe('Insufficient stock');
    });
  });

  describe('bulkTransfer', () => {
    it('should use TransactionEngine with movementType TC', async () => {
      engine.createBulkMovements.mockResolvedValue({
        results: [{ success: true, transactionId: 2, voucherNo: 'TR-000001' }],
        failedIndex: -1,
        error: '',
      });

      const result = await service.bulkTransfer({
        companyId: 1,
        financialYearId: 1,
        fromStoreId: 1,
        toStoreId: 2,
        transactionDate: new Date(),
        items: [{ itemId: 10, quantity: 5 }],
        createdBy: 'admin',
      });

      expect(engine.createBulkMovements).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: 'TC',
            fromStoreId: 1,
            toStoreId: 2,
          }),
        ]),
      );
      expect(result.processedItems).toBe(1);
    });
  });

  describe('bulkDamage', () => {
    it('should use TransactionEngine with movementType DM', async () => {
      engine.createBulkMovements.mockResolvedValue({
        results: [{ success: true, transactionId: 3 }],
        failedIndex: -1,
        error: '',
      });

      const result = await service.bulkDamage({
        companyId: 1,
        financialYearId: 1,
        storeId: 1,
        transactionDate: new Date(),
        items: [{ itemId: 10, quantity: 2, reason: 'Broken', damageType: 'BROKEN' }],
        createdBy: 'admin',
      });

      expect(engine.createBulkMovements).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: 'DM',
            fromStoreId: 1,
          }),
        ]),
      );
      expect(result.processedItems).toBe(1);
    });
  });
});
