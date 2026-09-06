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

describe('StockValidationFormulaService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: StockValidationFormulaService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new StockValidationFormulaService(prisma);
  });

  describe('validateItemStock', () => {
    it('should calculate opening balance correctly', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.openingBalance).toBe(100);
      expect(result.calculatedStock).toBe(100);
      expect(result.ledgerStock).toBe(100);
      expect(result.isMatch).toBe(true);
    });

    it('should aggregate receipts from PURCHASE_RECEIPT type', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 50, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
        { movementType: 'PURCHASE_RECEIPT', quantityIn: 30, quantityOut: 0, balanceQty: 80, condition: 'GOOD' },
        { movementType: 'PURCHASE_RECEIPT', quantityIn: 20, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.totalReceipts).toBe(50);
      expect(result.calculatedStock).toBe(100);
    });

    it('should aggregate all outflow types correctly', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 200, quantityOut: 0, balanceQty: 200, condition: 'GOOD' },
        { movementType: 'ISSUE_OUT', quantityIn: 0, quantityOut: 30, balanceQty: 170, condition: 'GOOD' },
        { movementType: 'TRANSFER_OUT', quantityIn: 0, quantityOut: 20, balanceQty: 150, condition: 'GOOD' },
        { movementType: 'INSTALL_OUT', quantityIn: 0, quantityOut: 10, balanceQty: 140, condition: 'GOOD' },
        { movementType: 'DAMAGE_OUT', quantityIn: 0, quantityOut: 5, balanceQty: 135, condition: 'DAMAGED' },
        { movementType: 'VENDOR_RETURN', quantityIn: 0, quantityOut: 15, balanceQty: 120, condition: 'GOOD' },
        { movementType: 'ADJUSTMENT_MINUS', quantityIn: 0, quantityOut: 10, balanceQty: 110, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.totalIssues).toBe(30);
      expect(result.totalTransferOut).toBe(20);
      expect(result.totalInstall).toBe(10);
      expect(result.totalDamage).toBe(5);
      expect(result.totalVendorReturn).toBe(15);
      expect(result.totalAdjustmentOut).toBe(10);
      expect(result.calculatedStock).toBe(110);
      expect(result.ledgerStock).toBe(110);
      expect(result.isMatch).toBe(true);
    });

    it('should handle TRANSFER_IN, SHIFT_IN, and ADJUSTMENT_PLUS', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
        { movementType: 'TRANSFER_IN', quantityIn: 25, quantityOut: 0, balanceQty: 125, condition: 'GOOD' },
        { movementType: 'SHIFT_IN', quantityIn: 10, quantityOut: 0, balanceQty: 135, condition: 'GOOD' },
        { movementType: 'ADJUSTMENT_PLUS', quantityIn: 5, quantityOut: 0, balanceQty: 140, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.totalTransferIn).toBe(25);
      expect(result.totalUninstall).toBe(10);
      expect(result.totalAdjustmentIn).toBe(5);
      expect(result.calculatedStock).toBe(140);
    });

    it('should handle REVERSAL as receipt when quantityIn > 0', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
        { movementType: 'REVERSAL', quantityIn: 10, quantityOut: 0, balanceQty: 110, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.totalReceipts).toBe(10);
      expect(result.calculatedStock).toBe(110);
    });

    it('should handle REVERSAL as issue when quantityOut > 0', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
        { movementType: 'REVERSAL', quantityIn: 0, quantityOut: 5, balanceQty: 95, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.totalIssues).toBe(5);
      expect(result.calculatedStock).toBe(95);
    });

    it('should detect discrepancy when calculated and ledger stock differ', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([
        { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
        { movementType: 'ISSUE_OUT', quantityIn: 0, quantityOut: 20, balanceQty: 85, condition: 'GOOD' },
      ]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.isMatch).toBe(false);
      expect(result.discrepancy).toBe(-5);
    });

    it('should use storeId in where clause when provided', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      await service.validateItemStock(1, 1, 1, 42, null);

      expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ storeId: 42 }),
        }),
      );
    });

    it('should use locationId in where clause when provided', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      await service.validateItemStock(1, 1, 1, null, 7);

      expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locationId: 7 }),
        }),
      );
    });

    it('should default item name and code when item not found', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([]);
      prisma.item.findUnique.mockResolvedValue(null);

      const result = await service.validateItemStock(1, 1, 99, null, null);

      expect(result.itemName).toBe('Item #99');
      expect(result.itemCode).toBe('');
    });

    it('should handle empty transactions gracefully', async () => {
      prisma.ledgerEntry.findMany.mockResolvedValue([]);
      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.validateItemStock(1, 1, 1, null, null);

      expect(result.calculatedStock).toBe(0);
      expect(result.ledgerStock).toBe(0);
      expect(result.isMatch).toBe(true);
      expect(result.discrepancy).toBe(0);
    });
  });

  describe('validateAllStock', () => {
    it('should return only items with discrepancies', async () => {
      prisma.item.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

      // Item 1: match
      prisma.ledgerEntry.findMany
        .mockResolvedValueOnce([
          { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
        ]);
      // Item 2: mismatch
      prisma.ledgerEntry.findMany
        .mockResolvedValueOnce([
          { movementType: 'OPENING_BALANCE', quantityIn: 100, quantityOut: 0, balanceQty: 100, condition: 'GOOD' },
          { movementType: 'ISSUE_OUT', quantityIn: 0, quantityOut: 10, balanceQty: 95, condition: 'GOOD' },
        ]);
      // Item 3: match
      prisma.ledgerEntry.findMany
        .mockResolvedValueOnce([
          { movementType: 'OPENING_BALANCE', quantityIn: 50, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
        ]);

      prisma.item.findUnique
        .mockResolvedValueOnce({ itemName: 'A', itemCode: 'A01' })
        .mockResolvedValueOnce({ itemName: 'B', itemCode: 'B01' })
        .mockResolvedValueOnce({ itemName: 'C', itemCode: 'C01' });

      const result = await service.validateAllStock(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe(2);
    });
  });

  describe('getItemStockSummary', () => {
    it('should return summary per store+location combination', async () => {
      prisma.ledgerEntry.findMany
        .mockResolvedValueOnce([
          { storeId: 1, locationId: 10 },
          { storeId: 1, locationId: 20 },
        ])
        .mockResolvedValueOnce([
          { movementType: 'OPENING_BALANCE', quantityIn: 50, quantityOut: 0, balanceQty: 50, condition: 'GOOD' },
        ])
        .mockResolvedValueOnce([
          { movementType: 'OPENING_BALANCE', quantityIn: 30, quantityOut: 0, balanceQty: 30, condition: 'GOOD' },
        ]);

      prisma.item.findUnique.mockResolvedValue({ itemName: 'Widget', itemCode: 'W001' });

      const result = await service.getItemStockSummary(1, 1, 1);

      expect(result).toHaveLength(2);
      expect(result[0].storeId).toBe(1);
      expect(result[0].locationId).toBe(10);
      expect(result[1].storeId).toBe(1);
      expect(result[1].locationId).toBe(20);
    });
  });
});
