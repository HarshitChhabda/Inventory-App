import { PrismaClient, Prisma } from '@prisma/client';

export interface StockFormulaResult {
  itemId: number;
  itemName: string;
  itemCode: string;
  openingBalance: number;
  totalReceipts: number;
  totalTransferIn: number;
  totalUninstall: number;
  totalAdjustmentIn: number;
  totalIssues: number;
  totalTransferOut: number;
  totalInstall: number;
  totalDamage: number;
  totalVendorReturn: number;
  totalAdjustmentOut: number;
  calculatedStock: number;
  ledgerStock: number;
  isMatch: boolean;
  discrepancy: number;
}

/**
 * Stock Formula Validation Service
 *
 * Validates that the stock formula is always correct:
 * Opening + Receipts + TransferIn + Uninstall + AdjustmentIn
 * - Issues - TransferOut - Install - Damage - VendorReturn - AdjustmentOut
 * = Current Available Stock
 *
 * This service reads from the ledger (LedgerEntry) and compares
 * the calculated balance with the stored balanceQty to detect discrepancies.
 */
export class StockValidationFormulaService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validate stock formula for a single item at a specific location.
   */
  async validateItemStock(
    companyId: number,
    financialYearId: number,
    itemId: number,
    storeId: number | null,
    locationId: number | null,
  ): Promise<StockFormulaResult> {
    const whereClause: any = { companyId, financialYearId, itemId };
    if (storeId) whereClause.storeId = storeId;
    if (locationId) whereClause.locationId = locationId;

    const entries = await this.prisma.ledgerEntry.findMany({
      where: whereClause,
      orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
      select: {
        movementType: true,
        quantityIn: true,
        quantityOut: true,
        balanceQty: true,
        condition: true,
      },
    });

    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: { itemName: true, itemCode: true },
    });

    let openingBalance = 0;
    let totalReceipts = 0;
    let totalTransferIn = 0;
    let totalUninstall = 0;
    let totalAdjustmentIn = 0;
    let totalIssues = 0;
    let totalTransferOut = 0;
    let totalInstall = 0;
    let totalDamage = 0;
    let totalVendorReturn = 0;
    let totalAdjustmentOut = 0;
    let totalConsumption = 0;
    let totalScrap = 0;

    for (const entry of entries) {
      const qtyIn = Number(entry.quantityIn);
      const qtyOut = Number(entry.quantityOut);

      switch (entry.movementType) {
        case 'OPENING_BALANCE':
        case 'OPENING_STOCK':
          openingBalance += qtyIn;
          break;
        case 'PURCHASE_RECEIPT':
          totalReceipts += qtyIn;
          break;
        case 'TRANSFER_IN':
          totalTransferIn += qtyIn;
          break;
        case 'SHIFT_IN':
          totalUninstall += qtyIn;
          break;
        case 'ADJUSTMENT_PLUS':
          totalAdjustmentIn += qtyIn;
          break;
        case 'ISSUE_OUT':
          totalIssues += qtyOut;
          break;
        case 'TRANSFER_OUT':
          totalTransferOut += qtyOut;
          break;
        case 'INSTALL_OUT':
          totalInstall += qtyOut;
          break;
        case 'DAMAGE_OUT':
          totalDamage += qtyOut;
          break;
        case 'VENDOR_RETURN':
          totalVendorReturn += qtyOut;
          break;
        case 'ADJUSTMENT_MINUS':
          totalAdjustmentOut += qtyOut;
          break;
        case 'CONSUMPTION_OUT':
          totalConsumption += qtyOut;
          break;
        case 'CONSUMPTION_REVERSAL':
          totalReceipts += qtyIn;
          break;
        case 'SCRAP_OUT':
          totalScrap += qtyOut;
          break;
        case 'REVERSAL':
          // Reversals can be either in or out
          if (qtyIn > 0) totalReceipts += qtyIn;
          if (qtyOut > 0) totalIssues += qtyOut;
          break;
        case 'CARRY_FORWARD':
          openingBalance += qtyIn;
          break;
      }
    }

    const calculatedStock =
      openingBalance + totalReceipts + totalTransferIn + totalUninstall + totalAdjustmentIn
      - totalIssues - totalTransferOut - totalInstall - totalDamage - totalVendorReturn - totalAdjustmentOut
      - totalConsumption - totalScrap;

    // Get the stored balance from the last entry
    const lastEntry = entries[entries.length - 1];
    const ledgerStock = lastEntry ? Number(lastEntry.balanceQty) : 0;

    return {
      itemId,
      itemName: item?.itemName || `Item #${itemId}`,
      itemCode: item?.itemCode || '',
      openingBalance,
      totalReceipts,
      totalTransferIn,
      totalUninstall,
      totalAdjustmentIn,
      totalIssues,
      totalTransferOut,
      totalInstall,
      totalDamage,
      totalVendorReturn,
      totalAdjustmentOut,
      calculatedStock,
      ledgerStock,
      isMatch: Math.abs(calculatedStock - ledgerStock) < 0.01,
      discrepancy: calculatedStock - ledgerStock,
    };
  }

  /**
   * Validate stock formula for all items in a financial year.
   * Returns only items with discrepancies.
   */
  async validateAllStock(
    companyId: number,
    financialYearId: number,
  ): Promise<StockFormulaResult[]> {
    const items = await this.prisma.item.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const discrepancies: StockFormulaResult[] = [];

    for (const item of items) {
      const result = await this.validateItemStock(companyId, financialYearId, item.id, null, null);
      if (!result.isMatch) {
        discrepancies.push(result);
      }
    }

    return discrepancies;
  }

  /**
   * Get a complete stock summary for an item across all locations.
   */
  async getItemStockSummary(
    companyId: number,
    financialYearId: number,
    itemId: number,
  ) {
    // Get all unique store+location combinations for this item
    const locations = await this.prisma.ledgerEntry.findMany({
      where: { companyId, financialYearId, itemId },
      select: { storeId: true, locationId: true },
      distinct: ['storeId', 'locationId'],
    });

    const summaries = [];
    for (const loc of locations) {
      const result = await this.validateItemStock(
        companyId, financialYearId, itemId, loc.storeId, loc.locationId,
      );
      summaries.push({
        ...result,
        storeId: loc.storeId,
        locationId: loc.locationId,
      });
    }

    return summaries;
  }
}
