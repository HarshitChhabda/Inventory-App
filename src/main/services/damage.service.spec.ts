import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DamageService } from './damage.service';

function createMockPrisma() {
  return {
    item: { findUnique: vi.fn() },
    financialYear: { findFirst: vi.fn() },
    assetInstallation: { findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((fn: any) => fn({
      assetInstallation: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
      auditLog: { create: vi.fn() },
    })),
  } as any;
}

function createMockStockEngine() {
  return { validateStock: vi.fn() };
}

function createMockTxEngine() {
  return { createTransaction: vi.fn() };
}

describe('DamageService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let stockEngine: ReturnType<typeof createMockStockEngine>;
  let txEngine: ReturnType<typeof createMockTxEngine>;
  let service: DamageService;

  beforeEach(() => {
    prisma = createMockPrisma();
    stockEngine = createMockStockEngine();
    txEngine = createMockTxEngine();
    service = new DamageService(prisma);
    (service as any).stockEngine = stockEngine;
    (service as any).txEngine = txEngine;
  });

  it('should throw when storeId is missing', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 1, itemName: 'LED Bulb', itemCode: 'L001' });
    prisma.financialYear.findFirst.mockResolvedValue({ id: 1 });

    await expect(service.create({
      companyId: 1,
      itemId: 1,
      date: new Date(),
      quantity: 10,
      reason: 'Broken',
      reportedBy: 'admin',
      storeId: undefined as any,
    })).rejects.toThrow('Store ID is required');
  });

  it('should use provided storeId (not fallback to 1)', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 1, itemName: 'LED Bulb', itemCode: 'L001' });
    prisma.financialYear.findFirst.mockResolvedValue({ id: 1 });
    stockEngine.validateStock.mockResolvedValue({ valid: true, available: 100 });
    txEngine.createTransaction.mockResolvedValue({ transactionId: 1, voucherNo: 'DM-001' });

    await service.create({
      companyId: 1,
      itemId: 1,
      date: new Date(),
      quantity: 5,
      reason: 'Broken',
      reportedBy: 'admin',
      storeId: 42,
    });

    expect(stockEngine.validateStock).toHaveBeenCalledWith(1, 1, 1, 42, 5);
    expect(txEngine.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ fromStoreId: 42 }),
    );
  });

  it('should reject when stock is insufficient', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 1, itemName: 'LED Bulb', itemCode: 'L001' });
    prisma.financialYear.findFirst.mockResolvedValue({ id: 1 });
    stockEngine.validateStock.mockResolvedValue({ valid: false, available: 3 });

    await expect(service.create({
      companyId: 1,
      itemId: 1,
      date: new Date(),
      quantity: 10,
      reason: 'Broken',
      reportedBy: 'admin',
      storeId: 1,
    })).rejects.toThrow('Insufficient stock');
  });
});
