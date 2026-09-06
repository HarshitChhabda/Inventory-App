/**
 * MAHAVEERJI INVENTORY v1.7.0
 * DS (Dharmshala Shift) & DP (Department Shift) — Targeted Unit Tests
 *
 * Tests:
 * 1. Movement registry: DS and DP are registered correctly in BUILT_IN_MOVEMENT_TYPES
 * 2. Stock effects: DS/DP use SHIFT_OUT/SHIFT_IN
 * 3. Serialized status: DS/DP map to INSTALLED
 * 4. Valid source/destination types
 * 5. Bidirectional direction
 * 6. Cross-validation: DS ≠ DP ≠ TC
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BUILT_IN_MOVEMENT_TYPES, type MovementTypeConfig } from './movementRegistry.service';
import { TransactionEngine } from './transactionEngine.service';
import { ShiftChallanService } from './shiftChallan.service';
import { StockEngine } from './stockEngine.service';

function getMovement(code: string): MovementTypeConfig | undefined {
  return BUILT_IN_MOVEMENT_TYPES.find((m) => m.code === code);
}

// ─── MOCK PRISMA ──────────────────────────────────────

function createMockPrisma() {
  return {
    $transaction: vi.fn((fn: any) => fn({
      transactionHeader: {
        create: vi.fn().mockResolvedValue({ id: 1, voucherNo: 'DS-00001' }),
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      transactionDetail: { createMany: vi.fn(), deleteMany: vi.fn() },
      ledgerEntry: { createMany: vi.fn() },
      serializedItem: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
      serialMovement: { create: vi.fn() },
      auditLog: { create: vi.fn() },
      item: { findMany: vi.fn().mockResolvedValue([]) },
      assetInstallation: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
      notification: { create: vi.fn() },
    })),
    ledgerEntry: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantityIn: 0, quantityOut: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    serializedItem: { findMany: vi.fn().mockResolvedValue([]) },
    item: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    store: { findUnique: vi.fn().mockResolvedValue({ id: 1, storeType: 'DHARMSHALA_STORE' }) },
    financialYear: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: 1, username: 'test', isActive: true, role: 'ADMIN' }) },
    voucherSequence: { findFirst: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    systemConfiguration: { findFirst: vi.fn().mockResolvedValue(null) },
    approvalWorkflow: { findFirst: vi.fn().mockResolvedValue(null) },
  } as any;
}

// ─── DS MOVEMENT REGISTRY TESTS ───────────────────────

describe('MovementRegistry — DS (Dharmshala Shift) Registration', () => {
  let ds: MovementTypeConfig | undefined;

  beforeEach(() => {
    ds = getMovement('DS');
  });

  it('should be registered in BUILT_IN_MOVEMENT_TYPES', () => {
    expect(ds).toBeDefined();
  });

  it('should have code DS', () => {
    expect(ds!.code).toBe('DS');
  });

  it('should have name Dharmshala Shift', () => {
    expect(ds!.name).toBe('Dharmshala Shift');
  });

  it('should have voucherPrefix DS', () => {
    expect(ds!.voucherPrefix).toBe('DS');
  });

  it('should have BIDIRECTIONAL direction', () => {
    expect(ds!.direction).toBe('BIDIRECTIONAL');
  });

  it('should accept DHARMSHALA_STORE as source type', () => {
    expect(ds!.validSourceTypes).toContain('DHARMSHALA_STORE');
  });

  it('should accept ROOM as source type', () => {
    expect(ds!.validSourceTypes).toContain('ROOM');
  });

  it('should accept DHARMSHALA_STORE as destination type', () => {
    expect(ds!.validDestinationTypes).toContain('DHARMSHALA_STORE');
  });

  it('should accept ROOM as destination type', () => {
    expect(ds!.validDestinationTypes).toContain('ROOM');
  });

  it('should have DECREASE stock effect at source', () => {
    expect(ds!.stockEffect.source).toBe('DECREASE');
  });

  it('should have INCREASE stock effect at destination', () => {
    expect(ds!.stockEffect.destination).toBe('INCREASE');
  });

  it('should have SHIFT category', () => {
    expect(ds!.category).toBe('SHIFT');
  });

  it('should not require approval', () => {
    expect(ds!.requiresApproval).toBe(false);
  });

  it('should allow backdated entries', () => {
    expect(ds!.allowBackdated).toBe(true);
  });

  it('should allow partial quantities', () => {
    expect(ds!.allowPartial).toBe(true);
  });

  it('should be active', () => {
    expect(ds!.isActive).toBe(true);
  });
});

// ─── DP MOVEMENT REGISTRY TESTS ───────────────────────

describe('MovementRegistry — DP (Department Shift) Registration', () => {
  let dp: MovementTypeConfig | undefined;

  beforeEach(() => {
    dp = getMovement('DP');
  });

  it('should be registered in BUILT_IN_MOVEMENT_TYPES', () => {
    expect(dp).toBeDefined();
  });

  it('should have code DP', () => {
    expect(dp!.code).toBe('DP');
  });

  it('should have name Department Shift', () => {
    expect(dp!.name).toBe('Department Shift');
  });

  it('should have voucherPrefix DP', () => {
    expect(dp!.voucherPrefix).toBe('DP');
  });

  it('should have BIDIRECTIONAL direction', () => {
    expect(dp!.direction).toBe('BIDIRECTIONAL');
  });

  it('should accept DEPARTMENT_STORE as source type', () => {
    expect(dp!.validSourceTypes).toContain('DEPARTMENT_STORE');
  });

  it('should accept DEPARTMENT_LOCATION as source type', () => {
    expect(dp!.validSourceTypes).toContain('DEPARTMENT_LOCATION');
  });

  it('should accept DEPARTMENT_STORE as destination type', () => {
    expect(dp!.validDestinationTypes).toContain('DEPARTMENT_STORE');
  });

  it('should accept DEPARTMENT_LOCATION as destination type', () => {
    expect(dp!.validDestinationTypes).toContain('DEPARTMENT_LOCATION');
  });

  it('should have DECREASE stock effect at source', () => {
    expect(dp!.stockEffect.source).toBe('DECREASE');
  });

  it('should have INCREASE stock effect at destination', () => {
    expect(dp!.stockEffect.destination).toBe('INCREASE');
  });

  it('should have SHIFT category', () => {
    expect(dp!.category).toBe('SHIFT');
  });

  it('should not require approval', () => {
    expect(dp!.requiresApproval).toBe(false);
  });

  it('should allow backdated entries', () => {
    expect(dp!.allowBackdated).toBe(true);
  });

  it('should allow partial quantities', () => {
    expect(dp!.allowPartial).toBe(true);
  });

  it('should be active', () => {
    expect(dp!.isActive).toBe(true);
  });
});

// ─── SERIALIZED STATUS MAPPING ────────────────────────

describe('TransactionEngine — DS/DP Serialized Status', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let engine: TransactionEngine;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = new TransactionEngine(prisma);
  });

  it('DS should map to INSTALLED for serialized items', () => {
    const status = (engine as any).getSerializedStatus('DS');
    expect(status).toBe('INSTALLED');
  });

  it('DP should map to INSTALLED for serialized items', () => {
    const status = (engine as any).getSerializedStatus('DP');
    expect(status).toBe('INSTALLED');
  });
});

// ─── TRANSACTION ENGINE — SHIFT MAPPING ───────────────

describe('TransactionEngine — DS/DP Movement Mapping', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let engine: TransactionEngine;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = new TransactionEngine(prisma);
  });

  it('DS should map to SHIFT_OUT for source-side ledger', () => {
    const movements = (engine as any).getMovements('DS');
    expect(movements.source).toBe('SHIFT_OUT');
  });

  it('DS should map to SHIFT_IN for destination-side ledger', () => {
    const movements = (engine as any).getMovements('DS');
    expect(movements.destination).toBe('SHIFT_IN');
  });

  it('DP should map to SHIFT_OUT for source-side ledger', () => {
    const movements = (engine as any).getMovements('DP');
    expect(movements.source).toBe('SHIFT_OUT');
  });

  it('DP should map to SHIFT_IN for destination-side ledger', () => {
    const movements = (engine as any).getMovements('DP');
    expect(movements.destination).toBe('SHIFT_IN');
  });
});

// ─── CROSS-VALIDATION: DS ≠ DP ≠ TC ──────────────────

describe('MovementRegistry — DS vs DP vs TC Distinction', () => {
  it('DS and DP should have different codes', () => {
    const ds = getMovement('DS');
    const dp = getMovement('DP');
    expect(ds!.code).not.toBe(dp!.code);
  });

  it('DS and DP should have different names', () => {
    const ds = getMovement('DS');
    const dp = getMovement('DP');
    expect(ds!.name).not.toBe(dp!.name);
  });

  it('DS should not accept MAIN_STORE as source', () => {
    const ds = getMovement('DS');
    expect(ds!.validSourceTypes).not.toContain('MAIN_STORE');
  });

  it('DP should not accept MAIN_STORE as source', () => {
    const dp = getMovement('DP');
    expect(dp!.validSourceTypes).not.toContain('MAIN_STORE');
  });

  it('TC should be a different category than DS and DP', () => {
    const tc = getMovement('TC');
    const ds = getMovement('DS');
    const dp = getMovement('DP');
    expect(tc!.category).not.toBe(ds!.category);
    expect(tc!.category).not.toBe(dp!.category);
  });

  it('DS and DP should have different voucherPrefix', () => {
    const ds = getMovement('DS');
    const dp = getMovement('DP');
    expect(ds!.voucherPrefix).not.toBe(dp!.voucherPrefix);
  });
});

// ─── BUSINESS RULE: Store→Store Rejection ──────────────

describe('ShiftChallanService — Store→Store Rejection', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      store: {
        findUnique: vi.fn(),
      },
    };
  });

  it('DS should reject DHARMSHALA_STORE → DHARMSHALA_STORE without locations', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'DhA', isActive: true })
      .mockResolvedValueOnce({ id: 2, storeType: 'DHARMSHALA_STORE', name: 'DhB', isActive: true });

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DS',
      fromStoreId: 1,
      toStoreId: 2,
      items: [{ itemId: 1, quantity: 1 }],
    })).rejects.toThrow('Transfer Challan (TC)');
  });

  it('DP should reject DEPARTMENT_STORE → DEPARTMENT_STORE without locations', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({ id: 3, storeType: 'DEPARTMENT_STORE', name: 'DeptA', isActive: true })
      .mockResolvedValueOnce({ id: 4, storeType: 'DEPARTMENT_STORE', name: 'DeptB', isActive: true });

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DP',
      fromStoreId: 3,
      toStoreId: 4,
      items: [{ itemId: 1, quantity: 1 }],
    })).rejects.toThrow('Transfer Challan (TC)');
  });

  it('DS should accept same DHARMSHALA_STORE with location IDs', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'DhA', isActive: true })
      .mockResolvedValueOnce({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'DhA', isActive: true });

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DS',
      fromStoreId: 1,
      toStoreId: 1,
      items: [{ itemId: 1, quantity: 1, toLocationId: 10 }],
    })).resolves.toBeUndefined();
  });

  it('DS should accept DHARMSHALA_STORE → ROOM', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'DhA', isActive: true })
      .mockResolvedValueOnce({ id: 5, storeType: 'ROOM', name: 'Room A', isActive: true });

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DS',
      fromStoreId: 1,
      toStoreId: 5,
    })).resolves.toBeUndefined();
  });

  it('DP should accept DEPARTMENT_STORE → DEPARTMENT_LOCATION', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({ id: 3, storeType: 'DEPARTMENT_STORE', name: 'DeptA', isActive: true })
      .mockResolvedValueOnce({ id: 6, storeType: 'DEPARTMENT_LOCATION', name: 'Loc A', isActive: true });

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DP',
      fromStoreId: 3,
      toStoreId: 6,
    })).resolves.toBeUndefined();
  });

  it('DS should reject inactive store', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'DhA', isActive: false })
      .mockResolvedValueOnce({ id: 2, storeType: 'DHARMSHALA_STORE', name: 'DhB', isActive: true });

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DS',
      fromStoreId: 1,
      toStoreId: 2,
    })).rejects.toThrow('inactive');
  });

  it('DS should reject non-existent store', async () => {
    prisma.store.findUnique.mockResolvedValueOnce(null);

    const service = new (await import('./shiftChallan.service')).ShiftChallanService(prisma);
    await expect((service as any).validateShift({
      shiftType: 'DS',
      fromStoreId: 999,
      toStoreId: 1,
    })).rejects.toThrow('not found');
  });
});

// ─── LOCATION ID VALIDATION ────────────────────────────

describe('ShiftChallanService — validateLocationIds', () => {
  function createService(overrides: any = {}) {
    const prisma = {
      location: {
        findMany: vi.fn().mockResolvedValue(overrides.locations || [
          { id: 100, storeId: 1, locationType: 'Room', name: 'Room 101', isActive: true },
          { id: 200, storeId: 1, locationType: 'Room', name: 'Room 102', isActive: true },
        ]),
      },
    };
    return new ShiftChallanService(prisma);
  }

  it('should validate valid Location IDs (Location.id ≠ Room.id)', async () => {
    const service = createService();
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
    ];
    const result = await (service as any).validateLocationIds(items, 1, 1);
    expect(result[0].fromLocationId).toBe(100);
    expect(result[0].toLocationId).toBe(200);
  });

  it('should pass through items unchanged when no Location IDs provided', async () => {
    const service = createService();
    const items = [
      { itemId: 1, quantity: 2 },
    ];
    const result = await (service as any).validateLocationIds(items, 1, 1);
    expect(result[0].fromLocationId).toBeUndefined();
    expect(result[0].toLocationId).toBeUndefined();
  });

  it('should throw when Location ID does not exist', async () => {
    const service = createService({ locations: [] });
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 999, toLocationId: 200 },
    ];
    await expect(
      (service as any).validateLocationIds(items, 1, 1)
    ).rejects.toThrow('Location(s) not found: 999');
  });

  it('should throw when Location is inactive', async () => {
    const service = createService({
      locations: [
        { id: 100, storeId: 1, locationType: 'Room', name: 'Inactive Room', isActive: false },
        { id: 200, storeId: 1, locationType: 'Room', name: 'Room 102', isActive: true },
      ],
    });
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
    ];
    await expect(
      (service as any).validateLocationIds(items, 1, 1)
    ).rejects.toThrow('inactive');
  });

  it('should throw when Location is not of type Room', async () => {
    const service = createService({
      locations: [
        { id: 100, storeId: 1, locationType: 'Dharamshala', name: 'Building A', isActive: true },
        { id: 200, storeId: 1, locationType: 'Room', name: 'Room 102', isActive: true },
      ],
    });
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
    ];
    await expect(
      (service as any).validateLocationIds(items, 1, 1)
    ).rejects.toThrow('Expected Room-type locations');
  });

  it('should throw when source Location does not belong to source Store', async () => {
    const service = createService({
      locations: [
        { id: 100, storeId: 999, locationType: 'Room', name: 'Wrong Store Room', isActive: true },
        { id: 200, storeId: 1, locationType: 'Room', name: 'Room 102', isActive: true },
      ],
    });
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
    ];
    await expect(
      (service as any).validateLocationIds(items, 1, 1)
    ).rejects.toThrow('does not belong to source store');
  });

  it('should throw when destination Location does not belong to destination Store', async () => {
    const service = createService({
      locations: [
        { id: 100, storeId: 1, locationType: 'Room', name: 'Room 101', isActive: true },
        { id: 200, storeId: 999, locationType: 'Room', name: 'Wrong Store Room', isActive: true },
      ],
    });
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
    ];
    await expect(
      (service as any).validateLocationIds(items, 1, 1)
    ).rejects.toThrow('does not belong to destination store');
  });

  it('should handle mixed: some items with Location IDs, some without', async () => {
    const service = createService();
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
      { itemId: 2, quantity: 3 },
    ];
    const result = await (service as any).validateLocationIds(items, 1, 1);
    expect(result[0].fromLocationId).toBe(100);
    expect(result[0].toLocationId).toBe(200);
    expect(result[1].fromLocationId).toBeUndefined();
    expect(result[1].toLocationId).toBeUndefined();
  });
});

// ─── SAME-ROOM VALIDATION ──────────────────────────────

describe('ShiftChallanService — Same-Room Validation', () => {
  function createService() {
    const prisma = {
      store: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'Store A', isActive: true }),
      },
    };
    return new ShiftChallanService(prisma);
  }

  it('should reject same source and destination Room ID', async () => {
    const service = createService();
    await expect(
      (service as any).validateShift({
        shiftType: 'DS',
        fromStoreId: 1,
        toStoreId: 1,
        items: [{ itemId: 1, quantity: 2, fromLocationId: 10, toLocationId: 10 }],
      })
    ).rejects.toThrow('cannot be the same');
  });

  it('should accept different Room IDs', async () => {
    const service = createService();
    await expect(
      (service as any).validateShift({
        shiftType: 'DS',
        fromStoreId: 1,
        toStoreId: 1,
        items: [{ itemId: 1, quantity: 2, fromLocationId: 10, toLocationId: 20 }],
      })
    ).resolves.toBeUndefined();
  });
});

// ─── QUANTITY VALIDATION ───────────────────────────────

describe('ShiftChallanService — Quantity Validation', () => {
  function createService() {
    const prisma = {
      store: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, storeType: 'DHARMSHALA_STORE', name: 'Store A', isActive: true }),
      },
    };
    return new ShiftChallanService(prisma);
  }

  it('should reject zero quantity', async () => {
    const service = createService();
    await expect(
      (service as any).validateShift({
        shiftType: 'DS',
        fromStoreId: 1,
        toStoreId: 1,
        items: [{ itemId: 1, quantity: 0, fromLocationId: 10, toLocationId: 20 }],
      })
    ).rejects.toThrow('must be greater than zero');
  });

  it('should reject negative quantity', async () => {
    const service = createService();
    await expect(
      (service as any).validateShift({
        shiftType: 'DS',
        fromStoreId: 1,
        toStoreId: 1,
        items: [{ itemId: 1, quantity: -5, fromLocationId: 10, toLocationId: 20 }],
      })
    ).rejects.toThrow('must be greater than zero');
  });

  it('should accept valid positive quantity', async () => {
    const service = createService();
    await expect(
      (service as any).validateShift({
        shiftType: 'DS',
        fromStoreId: 1,
        toStoreId: 1,
        items: [{ itemId: 1, quantity: 5, fromLocationId: 10, toLocationId: 20 }],
      })
    ).resolves.toBeUndefined();
  });
});

// ─── POST INTEGRITY CHECK ──────────────────────────────

describe('ShiftChallanService — Post Integrity Check', () => {
  function createService(overrides: any = {}) {
    const defaultHeader = {
      id: 1,
      approvalStatus: 'DRAFT',
      voucherNo: 'DS-00001',
      voucherType: 'DS',
      companyId: 1,
      financialYearId: 1,
      fromStoreId: 1,
      toStoreId: 1,
      transactionDate: new Date(),
      createdBy: 'test',
      details: [
        { itemId: 1, quantity: 5, fromLocationId: 10, toLocationId: 20, rate: 0, serialNumber: null, item: { itemType: 'ASSET' } },
      ],
    };
    const mockPostTransaction = vi.fn().mockResolvedValue({ success: true });
    const prisma = {
      transactionHeader: {
        findUnique: vi.fn().mockResolvedValue(overrides.header !== undefined ? overrides.header : defaultHeader),
        update: vi.fn().mockResolvedValue({}),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      item: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, itemType: 'ASSET', isSerialized: false }]),
      },
      store: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'Test Store', isActive: true }),
      },
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            10: { id: 10, locationType: 'Room', name: 'Room 10' },
            20: { id: 20, locationType: 'Room', name: 'Room 20' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);
    (service as any).transactionEngine = { postTransaction: mockPostTransaction };
    return { service, mockPostTransaction };
  }

  it('should call postTransaction then handleAssetInstallations', async () => {
    const { service, mockPostTransaction } = createService();
    const result = await service.post(1);
    expect(result.success).toBe(true);
    expect(mockPostTransaction).toHaveBeenCalledWith(1);
  });

  it('should reject when challan is already POSTED', async () => {
    const { service } = createService({
      header: {
        id: 1, approvalStatus: 'POSTED', voucherNo: 'DS-00001',
        voucherType: 'DS', companyId: 1, financialYearId: 1,
        fromStoreId: 1, toStoreId: 1, transactionDate: new Date(), createdBy: 'test',
        details: [{ itemId: 1, quantity: 5, fromLocationId: 10, toLocationId: 20, rate: 0, serialNumber: null, item: { itemType: 'ASSET' } }],
      },
    });
    await expect(service.post(1)).rejects.toThrow('Only draft');
  });

  it('should reject when challan not found', async () => {
    const { service } = createService({ header: null });
    await expect(service.post(999)).rejects.toThrow('not found');
  });
});

// ─── REVERSAL PROTECTION ───────────────────────────────

describe('ShiftChallanService — Reversal Protection', () => {
  function createService() {
    const prisma = {
      transactionHeader: {
        findUnique: vi.fn(),
      },
      transactionDetail: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    return {
      service: new ShiftChallanService(prisma),
      prisma,
    };
  }

  it('should reject cancelling a REVERSED transaction', async () => {
    const { service, prisma } = createService();
    prisma.transactionHeader.findUnique.mockResolvedValue({
      id: 1, voucherType: 'DS', approvalStatus: 'REVERSED',
    });
    await expect(service.cancel(1, 'reason', 'admin')).rejects.toThrow('Only posted');
  });

  it('should reject cancelling a CANCELLED transaction', async () => {
    const { service, prisma } = createService();
    prisma.transactionHeader.findUnique.mockResolvedValue({
      id: 1, voucherType: 'DS', approvalStatus: 'CANCELLED',
    });
    await expect(service.cancel(1, 'reason', 'admin')).rejects.toThrow('Only posted');
  });

  it('should reject cancelling a reversal (RV) transaction', async () => {
    const { service, prisma } = createService();
    prisma.transactionHeader.findUnique.mockResolvedValue({
      id: 1, voucherType: 'RV', approvalStatus: 'POSTED',
    });
    await expect(service.cancel(1, 'reason', 'admin')).rejects.toThrow('Cannot cancel a reversal');
  });

  it('should reject cancelling a DRAFT transaction', async () => {
    const { service, prisma } = createService();
    prisma.transactionHeader.findUnique.mockResolvedValue({
      id: 1, voucherType: 'DS', approvalStatus: 'DRAFT',
    });
    await expect(service.cancel(1, 'reason', 'admin')).rejects.toThrow('Only posted');
  });
});

// ─── DELETE PROTECTION ─────────────────────────────────

describe('ShiftChallanService — Delete Protection', () => {
  function createService(approvalStatus: string) {
    const prisma = {
      transactionHeader: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1, approvalStatus,
        }),
      },
      transactionDetail: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return new ShiftChallanService(prisma);
  }

  it('should reject deleting a POSTED challan', async () => {
    const service = createService('POSTED');
    await expect(service.delete(1)).rejects.toThrow('Cannot delete a posted challan');
  });

  it('should reject deleting a REVERSED challan', async () => {
    const service = createService('REVERSED');
    await expect(service.delete(1)).rejects.toThrow('Cannot delete a reversed challan');
  });

  it('should reject deleting a CANCELLED challan', async () => {
    const service = createService('CANCELLED');
    await expect(service.delete(1)).rejects.toThrow('Cannot delete a cancelled challan');
  });
});

// ─── ASSET INSTALLATION INTEGRITY ──────────────────────

describe('ShiftChallanService — AssetInstallation Integrity', () => {
  it('should handle source deactivation and destination creation for ASSET items', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            10: { id: 10, locationType: 'Room', name: 'Room 10' },
            20: { id: 20, locationType: 'Room', name: 'Room 20' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 100, locationId: 10 }, { id: 200, locationId: 20 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([{ id: 10, itemId: 1, roomId: 100, storeId: 1, quantity: 5, status: 'ACTIVE' }]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 1, quantity: 2, fromLocationId: 10, toLocationId: 20 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.assetInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: { decrement: 2 } }),
      }),
    );

    expect(prisma.assetInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 1,
          roomId: 200,
          storeId: 1,
          quantity: 2,
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('should process non-asset items data-driven (no installations = no-op on source, creates on destination)', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            10: { id: 10, locationType: 'Room', name: 'Room 10' },
            20: { id: 20, locationType: 'Room', name: 'Room 20' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 100, locationId: 10 }, { id: 200, locationId: 20 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 1, quantity: 2, fromLocationId: 10, toLocationId: 20 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.assetInstallation.findMany).toHaveBeenCalled();
    expect(prisma.assetInstallation.create).toHaveBeenCalled();
  });

  it('should increment existing destination installation', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          return Promise.resolve({ id: 20, locationType: 'Room', name: 'Room 20' });
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 200, locationId: 20 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: 20, itemId: 1, roomId: 200, storeId: 1, quantity: 3, status: 'ACTIVE' }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn(),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 1, quantity: 2, toLocationId: 20 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.assetInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: { increment: 2 } }),
      }),
    );
    expect(prisma.assetInstallation.create).not.toHaveBeenCalled();
  });
});

// ─── TEST 1: Location.id ≠ Room.id ──────────────────────

describe('ShiftChallanService — Location.id ≠ Room.id (Bug Fix)', () => {
  it('should correctly resolve Location.id → Room.id via handleAssetInstallations', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            100: { id: 100, locationType: 'Room', name: 'Room 100' },
            200: { id: 200, locationType: 'Room', name: 'Room 200' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 25, locationId: 100 }, { id: 30, locationId: 200 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([{ id: 10, itemId: 1, roomId: 25, storeId: 1, quantity: 5, status: 'ACTIVE' }]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { locationId: { in: [100, 200] } },
      }),
    );

    expect(prisma.assetInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: { decrement: 2 } }),
      }),
    );

    expect(prisma.assetInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 1,
          roomId: 30,
          storeId: 1,
          quantity: 2,
          status: 'ACTIVE',
        }),
      }),
    );
  });
});

// ─── TEST 2: Room-to-Room Shift with Different IDs ─────

describe('ShiftChallanService — Room-to-Room Shift (Location.id ≠ Room.id)', () => {
  it('should correctly shift when Location.id=100 maps to Room.id=25 and Location.id=150 maps to Room.id=30', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            100: { id: 100, locationType: 'Room', name: 'Room 100' },
            150: { id: 150, locationType: 'Room', name: 'Room 150' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { id: 25, locationId: 100 },
          { id: 30, locationId: 150 },
        ]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 10, itemId: 1, roomId: 25, storeId: 1, quantity: 5, status: 'ACTIVE' },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 1, quantity: 3, fromLocationId: 100, toLocationId: 150 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { locationId: { in: [100, 150] } },
      }),
    );

    expect(prisma.assetInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ quantity: { decrement: 3 } }),
      }),
    );

    expect(prisma.assetInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 1,
          roomId: 30,
          storeId: 1,
          quantity: 3,
          status: 'ACTIVE',
        }),
      }),
    );
  });
});

// ─── TEST 6: DS and DP Both Work ───────────────────────

describe('ShiftChallanService — DS and DP Both Use Same validateLocationIds', () => {
  it('DS should validate Location IDs correctly', async () => {
    const prisma = {
      location: {
        findMany: vi.fn().mockResolvedValue([
          { id: 100, storeId: 1, locationType: 'Room', name: 'Room 101', isActive: true },
          { id: 200, storeId: 1, locationType: 'Room', name: 'Room 102', isActive: true },
        ]),
      },
    };
    const service = new ShiftChallanService(prisma);
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 100, toLocationId: 200 },
    ];
    const result = await (service as any).validateLocationIds(items, 1, 1);
    expect(result[0].fromLocationId).toBe(100);
    expect(result[0].toLocationId).toBe(200);
  });

  it('DP should validate Location IDs correctly', async () => {
    const prisma = {
      location: {
        findMany: vi.fn().mockResolvedValue([
          { id: 300, storeId: 3, locationType: 'Room', name: 'Dept Room A', isActive: true },
          { id: 400, storeId: 3, locationType: 'Room', name: 'Dept Room B', isActive: true },
        ]),
      },
    };
    const service = new ShiftChallanService(prisma);
    const items = [
      { itemId: 1, quantity: 2, fromLocationId: 300, toLocationId: 400 },
    ];
    const result = await (service as any).validateLocationIds(items, 3, 3);
    expect(result[0].fromLocationId).toBe(300);
    expect(result[0].toLocationId).toBe(400);
  });
});

// ─── LEDGER ENTRY VERIFICATION ─────────────────────────

describe('TransactionEngine — DS/DP Ledger Entry Creation', () => {
  let prisma: any;
  let engine: TransactionEngine;

  beforeEach(() => {
    prisma = createMockPrisma();
    engine = new TransactionEngine(prisma);
  });

  it('DS creates both SHIFT_OUT and SHIFT_IN entries', () => {
    const movements = (engine as any).getMovements('DS');
    expect(movements.source).toBe('SHIFT_OUT');
    expect(movements.destination).toBe('SHIFT_IN');
  });

  it('DP creates both SHIFT_OUT and SHIFT_IN entries', () => {
    const movements = (engine as any).getMovements('DP');
    expect(movements.source).toBe('SHIFT_OUT');
    expect(movements.destination).toBe('SHIFT_IN');
  });

  it('SH also creates SHIFT_OUT and SHIFT_IN entries', () => {
    const movements = (engine as any).getMovements('SH');
    expect(movements.source).toBe('SHIFT_OUT');
    expect(movements.destination).toBe('SHIFT_IN');
  });
});

// ─── COMPUTE BREAKDOWN VERIFICATION ────────────────────

describe('StockEngine — computeBreakdown for Shift Movements', () => {
  function createEngine() {
    const prisma = {};
    return new StockEngine(prisma);
  }

  it('SHIFT_OUT without locationId should decrease available (store-level stock-out)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 5, movementType: 'SHIFT_OUT', locationId: null },
    ]);
    expect(result.available).toBe(0);
    expect(result.installed).toBe(0);
  });

  it('SHIFT_OUT with locationId should decrease installed (room-level shift)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 5, movementType: 'SHIFT_OUT', locationId: 37 },
    ]);
    expect(result.installed).toBe(0);
    expect(result.available).toBe(0);
  });

  it('SHIFT_IN without locationId should increase available (returning from room)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 5, quantityOut: 0, movementType: 'SHIFT_IN', locationId: null },
    ]);
    expect(result.available).toBe(5);
  });

  it('SHIFT_IN with locationId should increase installed (arriving at room)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 5, quantityOut: 0, movementType: 'SHIFT_IN', locationId: 37 },
    ]);
    expect(result.installed).toBe(5);
    expect(result.available).toBe(0);
  });

  it('DS Store→Room: available decreases, installed increases', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 2, movementType: 'SHIFT_OUT', locationId: null },
      { quantityIn: 2, quantityOut: 0, movementType: 'SHIFT_IN', locationId: 37 },
    ]);
    expect(result.available).toBe(0);
    expect(result.installed).toBe(2);
  });

  it('DS Room→Store: installed decreases, available increases', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 2, movementType: 'SHIFT_OUT', locationId: 37 },
      { quantityIn: 2, quantityOut: 0, movementType: 'SHIFT_IN', locationId: null },
    ]);
    expect(result.available).toBe(2);
    expect(result.installed).toBe(0);
  });

  it('DS Room→Room: installed unchanged (source decreases, dest increases)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 2, movementType: 'SHIFT_OUT', locationId: 37 },
      { quantityIn: 2, quantityOut: 0, movementType: 'SHIFT_IN', locationId: 38 },
    ]);
    expect(result.installed).toBe(0);
    expect(result.available).toBe(0);
  });

  it('Same-store no-location shift: available unchanged (leave + return)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 5, movementType: 'SHIFT_OUT', locationId: null },
      { quantityIn: 5, quantityOut: 0, movementType: 'SHIFT_IN', locationId: null },
    ]);
    expect(result.available).toBe(0);
    expect(result.installed).toBe(0);
  });

  it('TRANSFER_OUT should decrease available (clamped to 0 by Math.max)', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 3, movementType: 'TRANSFER_OUT' },
    ]);
    expect(result.available).toBe(0);
  });

  it('TRANSFER_IN should increase available', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 3, quantityOut: 0, movementType: 'TRANSFER_IN' },
    ]);
    expect(result.available).toBe(3);
  });

  it('REVERSAL should reverse previous movement effect', () => {
    const engine = createEngine();
    const result = (engine as any).computeBreakdown([
      { quantityIn: 0, quantityOut: 5, movementType: 'SHIFT_OUT', locationId: null },
      { quantityIn: 5, quantityOut: 0, movementType: 'SHIFT_IN', locationId: null },
      { quantityIn: 5, quantityOut: 0, movementType: 'REVERSAL' },
    ]);
    expect(result.available).toBe(5);
  });
});

// ─── REGRESSION TESTS: Bug A — Popup shows blank locations ─────

describe('Bug A Regression — TransactionDetail fromLocation/toLocation relations', () => {
  it('should include fromLocation and toLocation in findById', async () => {
    const prisma = {
      transactionHeader: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          fromStoreId: 1,
          toStoreId: 2,
          details: [
            {
              itemId: 10,
              quantity: 5,
              fromLocationId: 100,
              toLocationId: 200,
              fromLocation: { id: 100, name: 'Room A', locationType: 'Room' },
              toLocation: { id: 200, name: 'Room B', locationType: 'Room' },
            },
          ],
        }),
      },
    };
    const service = new ShiftChallanService(prisma);
    const result = await service.findById(1);

    expect(result.details[0].fromLocation).toBeDefined();
    expect(result.details[0].fromLocation.name).toBe('Room A');
    expect(result.details[0].toLocation).toBeDefined();
    expect(result.details[0].toLocation.name).toBe('Room B');
  });

  it('should include fromLocation and toLocation in findAll', async () => {
    const prisma = {
      transactionHeader: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            details: [
              {
                fromLocation: { name: 'Room A' },
                toLocation: { name: 'Room B' },
              },
            ],
          },
        ]),
      },
    };
    const service = new ShiftChallanService(prisma);
    const result = await service.findAll(1, 1, 'DS');

    expect(result[0].details[0].fromLocation).toBeDefined();
    expect(result[0].details[0].toLocation).toBeDefined();
  });
});

// ─── REGRESSION TESTS: Bug B — Same-store Room→Room ledger suppression ─────

describe('Bug B Regression — Same-store Room→Room ledger suppression', () => {
  it('should detect same-store Room→Room when both locations are Room type', async () => {
    const prisma = {
      transactionDetail: {
        findMany: vi.fn().mockResolvedValue([
          { fromLocationId: 100, toLocationId: 200 },
        ]),
      },
      location: {
        findMany: vi.fn().mockResolvedValue([
          { id: 100, locationType: 'Room' },
          { id: 200, locationType: 'Room' },
        ]),
      },
    };
    const engine = new TransactionEngine(prisma, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    const result = await (engine as any).isSameStoreRoomToRoom(1, 1, 1, 10, 10);
    expect(result).toBe(true);
  });

  it('should NOT detect same-store Room→Room when stores differ', async () => {
    const engine = new TransactionEngine({}, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    const result = await (engine as any).isSameStoreRoomToRoom(1, 1, 1, 10, 20);
    expect(result).toBe(false);
  });

  it('should NOT detect same-store Room→Room when one location is not Room type', async () => {
    const prisma = {
      transactionDetail: {
        findMany: vi.fn().mockResolvedValue([
          { fromLocationId: 100, toLocationId: 200 },
        ]),
      },
      location: {
        findMany: vi.fn().mockResolvedValue([
          { id: 100, locationType: 'Room' },
          { id: 200, locationType: 'Store' },
        ]),
      },
    };
    const engine = new TransactionEngine(prisma, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    const result = await (engine as any).isSameStoreRoomToRoom(1, 1, 1, 10, 10);
    expect(result).toBe(false);
  });

  it('should NOT detect same-store Room→Room when detail has no fromLocationId', async () => {
    const prisma = {
      transactionDetail: {
        findMany: vi.fn().mockResolvedValue([
          { fromLocationId: null, toLocationId: 200 },
        ]),
      },
      location: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const engine = new TransactionEngine(prisma, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    const result = await (engine as any).isSameStoreRoomToRoom(1, 1, 1, 10, 10);
    expect(result).toBe(false);
  });
});

// ─── REGRESSION TESTS: Bug C — AssetInstallation moves for all item types ─────

describe('Bug C Regression — AssetInstallation data-driven movement', () => {
  it('should deactivate source installations for CONSUMABLE items if ACTIVE installation exists', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            10: { id: 10, locationType: 'Room', name: 'Room 10' },
            20: { id: 20, locationType: 'Room', name: 'Room 20' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 100, locationId: 10 }, { id: 200, locationId: 20 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 10, itemId: 5, roomId: 100, storeId: 1, quantity: 3, status: 'ACTIVE' },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 5, quantity: 2, fromLocationId: 10, toLocationId: 20 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.assetInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ quantity: { decrement: 2 } }),
      }),
    );
  });

  it('should create destination installation for CONSUMABLE items when no existing installation', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            10: { id: 10, locationType: 'Room', name: 'Room 10' },
            20: { id: 20, locationType: 'Room', name: 'Room 20' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 200, locationId: 20 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 5, quantity: 4, fromLocationId: 10, toLocationId: 20 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.assetInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 5,
          roomId: 200,
          storeId: 1,
          quantity: 4,
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('should do nothing on source when no ACTIVE installation exists', async () => {
    const prisma = {
      location: {
        findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
          const locs: Record<number, any> = {
            10: { id: 10, locationType: 'Room', name: 'Room 10' },
            20: { id: 20, locationType: 'Room', name: 'Room 20' },
          };
          return Promise.resolve(locs[id] || null);
        }),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 100, locationId: 10 }, { id: 200, locationId: 20 }]),
        create: vi.fn().mockResolvedValue({}),
      },
      assetInstallation: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new ShiftChallanService(prisma);

    await (service as any).handleAssetInstallations(
      1, 1, 1,
      [{ itemId: 99, quantity: 1, fromLocationId: 10, toLocationId: 20 }],
      1, new Date(), 'admin', 1,
    );

    expect(prisma.assetInstallation.update).not.toHaveBeenCalled();
    expect(prisma.assetInstallation.create).toHaveBeenCalled();
  });
});
