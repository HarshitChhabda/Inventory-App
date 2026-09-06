import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionEngine } from './transactionEngine.service';

function createMockPrisma() {
  return {
    $transaction: vi.fn((fn: any) => fn({
      transactionHeader: { create: vi.fn().mockResolvedValue({ id: 1, voucherNo: 'IC-001' }), update: vi.fn() },
      transactionDetail: { createMany: vi.fn() },
      ledgerEntry: { createMany: vi.fn() },
      serializedItem: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      serialMovement: { create: vi.fn() },
      auditLog: { create: vi.fn() },
      item: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { create: vi.fn() },
    })),
    ledgerEntry: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantityIn: 0, quantityOut: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    serializedItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    item: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    store: { findUnique: vi.fn().mockResolvedValue({ id: 1, storeType: 'MAIN_STORE' }) },
    financialYear: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: 1, username: 'test', isActive: true, role: 'ADMIN' }) },
    voucherSequence: { findFirst: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    systemConfiguration: { findFirst: vi.fn().mockResolvedValue(null) },
    approvalWorkflow: { findFirst: vi.fn().mockResolvedValue(null) },
  } as any;
}

describe('TransactionEngine — Serialized Item Status Mapping', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let engine: TransactionEngine;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = new TransactionEngine(prisma);
  });

  describe('getSerializedStatus (private method)', () => {
    it('IC should map to AVAILABLE (not INSTALLED)', () => {
      const status = (engine as any).getSerializedStatus('IC');
      expect(status).toBe('AVAILABLE');
    });

    it('IS should map to INSTALLED', () => {
      const status = (engine as any).getSerializedStatus('IS');
      expect(status).toBe('INSTALLED');
    });

    it('TC should map to AVAILABLE', () => {
      const status = (engine as any).getSerializedStatus('TC');
      expect(status).toBe('AVAILABLE');
    });

    it('SH should map to INSTALLED', () => {
      const status = (engine as any).getSerializedStatus('SH');
      expect(status).toBe('INSTALLED');
    });

    it('DS should map to INSTALLED', () => {
      const status = (engine as any).getSerializedStatus('DS');
      expect(status).toBe('INSTALLED');
    });

    it('DP should map to INSTALLED', () => {
      const status = (engine as any).getSerializedStatus('DP');
      expect(status).toBe('INSTALLED');
    });

    it('DM should map to DAMAGED', () => {
      const status = (engine as any).getSerializedStatus('DM');
      expect(status).toBe('DAMAGED');
    });

    it('RO should map to UNDER_REPAIR', () => {
      const status = (engine as any).getSerializedStatus('RO');
      expect(status).toBe('UNDER_REPAIR');
    });

    it('UN should map to AVAILABLE', () => {
      const status = (engine as any).getSerializedStatus('UN');
      expect(status).toBe('AVAILABLE');
    });

    it('RV should map to AVAILABLE', () => {
      const status = (engine as any).getSerializedStatus('RV');
      expect(status).toBe('AVAILABLE');
    });

    it('unknown movement should default to AVAILABLE', () => {
      const status = (engine as any).getSerializedStatus('UNKNOWN_CODE');
      expect(status).toBe('AVAILABLE');
    });
  });
});
