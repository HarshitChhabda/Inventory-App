import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockValidationFormulaService } from './stockFormulaValidation.service';

function createMockPrisma() {
  return {
    ledgerEntry: {
      findMany: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  } as any;
}

describe('StockValidationFormulaService - Consumption Audit', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: StockValidationFormulaService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new StockValidationFormulaService(prisma);
  });

  describe('CONSUMPTION_OUT handling', () => {
    it('should subtract CONSUMPTION_OUT from calculated stock', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 25, quantityOut: 0, balanceQty: 25, condition: 'GOOD' },
        { movementType: 'PURCHASE_RECEIPT', quantityIn: 25, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
        { movementType: 'CONSUMPTION_OUT', quantityIn: 0, quantityOut: 5, balanceQty: 45, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Test Item', itemCode: 'T001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.calculatedStock).toBe(45);
      expect(result.ledgerStock).toBe(45);
      expect(result.isMatch).toBe(true);
      expect(result.discrepancy).toBe(0);
    });

    it('should detect discrepancy when CONSUMPTION_OUT is missing from switch', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 25, quantityOut: 0, balanceQty: 25, condition: 'GOOD' },
        { movementType: 'PURCHASE_RECEIPT', quantityIn: 25, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
        { movementType: 'CONSUMPTION_OUT', quantityIn: 0, quantityOut: 5, balanceQty: 45, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Test Item', itemCode: 'T001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      // BUG: If CONSUMPTION_OUT is not handled in switch, calculatedStock = 50 (ignores consumption)
      // but ledgerStock = 45 (last balanceQty). This creates a false discrepancy of +5.
      // After fix: calculatedStock should be 45, matching ledgerStock.
      if (!result.isMatch) {
        console.error('FALSE DISCREPANCY DETECTED:', {
          calculatedStock: result.calculatedStock,
          ledgerStock: result.ledgerStock,
          discrepancy: result.discrepancy,
        });
      }
      expect(result.isMatch).toBe(true);
    });
  });

  describe('CONSUMPTION_REVERSAL handling', () => {
    it('should add CONSUMPTION_REVERSAL to calculated stock', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 25, quantityOut: 0, balanceQty: 25, condition: 'GOOD' },
        { movementType: 'PURCHASE_RECEIPT', quantityIn: 25, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
        { movementType: 'CONSUMPTION_OUT', quantityIn: 0, quantityOut: 5, balanceQty: 45, condition: 'GOOD' },
        { movementType: 'CONSUMPTION_REVERSAL', quantityIn: 5, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Test Item', itemCode: 'T001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.calculatedStock).toBe(50);
      expect(result.ledgerStock).toBe(50);
      expect(result.isMatch).toBe(true);
    });
  });

  describe('Full consumption lifecycle (receive 25, consume 5, cancel)', () => {
    it('should match ledger stock after full lifecycle', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'PURCHASE_RECEIPT', quantityIn: 25, quantityOut: 0, balanceQty: 25, condition: 'GOOD' },
        { movementType: 'CONSUMPTION_OUT', quantityIn: 0, quantityOut: 5, balanceQty: 20, condition: 'GOOD' },
        { movementType: 'CONSUMPTION_REVERSAL', quantityIn: 5, quantityOut: 0, balanceQty: 25, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Test Item', itemCode: 'T001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      // CONSUMPTION_REVERSAL (qtyIn=5) is added to totalReceipts as an inflow
      expect(result.totalReceipts).toBe(30);
      expect(result.calculatedStock).toBe(25);
      expect(result.ledgerStock).toBe(25);
      expect(result.isMatch).toBe(true);
      expect(result.discrepancy).toBe(0);
    });
  });

  describe('SCRAP_OUT handling (also missing from switch)', () => {
    it('should subtract SCRAP_OUT from calculated stock', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
        { movementType: 'SCRAP_OUT', quantityIn: 0, quantityOut: 10, balanceQty: 90, condition: 'SCRAPPED' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Test Item', itemCode: 'T001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.calculatedStock).toBe(90);
      expect(result.ledgerStock).toBe(90);
      expect(result.isMatch).toBe(true);
    });
  });
});
