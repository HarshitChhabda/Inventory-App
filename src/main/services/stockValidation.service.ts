import { PrismaClient } from '@prisma/client';
import { StockEngine } from './stockEngine.service';

export interface StockValidationResult {
  sufficient: boolean;
  available: number;
  requested: number;
  itemName: string;
  itemId: number;
}

/**
 * Centralized stock sufficiency validation.
 * Uses StockEngine which derives all stock from ledger entries.
 */
export async function validateSufficientStock(
  prisma: PrismaClient,
  companyId: number,
  financialYearId: number,
  itemId: number,
  storeId: number,
  qty: number,
): Promise<StockValidationResult> {
  const engine = new StockEngine(prisma);
  const available = await engine.getStockBalance(companyId, financialYearId, itemId, storeId);

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { itemName: true } });

  return {
    sufficient: available >= qty,
    available,
    requested: qty,
    itemName: item?.itemName || `Item #${itemId}`,
    itemId,
  };
}

/**
 * Validates sufficient stock for all items in a batch.
 * Returns array of failures only (empty = all sufficient).
 */
export async function validateBatchStock(
  prisma: PrismaClient,
  companyId: number,
  financialYearId: number,
  items: Array<{ itemId: number; storeId: number; qty: number }>,
): Promise<StockValidationResult[]> {
  const failures: StockValidationResult[] = [];

  const uniqueChecks = new Map<string, { itemId: number; storeId: number; qty: number }>();
  for (const item of items) {
    const key = `${item.itemId}-${item.storeId}`;
    const existing = uniqueChecks.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      uniqueChecks.set(key, { ...item });
    }
  }

  for (const check of uniqueChecks.values()) {
    const result = await validateSufficientStock(
      prisma, companyId, financialYearId, check.itemId, check.storeId, check.qty,
    );
    if (!result.sufficient) {
      failures.push(result);
    }
  }

  return failures;
}

/**
 * Gets the latest balance for an item at a store.
 * Uses StockEngine which derives balance from ledger entries.
 */
export async function getLatestBalance(
  prisma: PrismaClient,
  companyId: number,
  financialYearId: number,
  itemId: number,
  storeId: number,
): Promise<number> {
  const engine = new StockEngine(prisma);
  return engine.getStockBalance(companyId, financialYearId, itemId, storeId);
}

/**
 * No-op. The ledger-based system doesn't need balance recalculation
 * since balances are derived from ledger entries (append-only).
 */
export async function recalculateBalancesAfterInsert(
  _tx: PrismaClient,
  _companyId: number,
  _financialYearId: number,
  _itemId: number,
  _storeId: number,
  _date: Date,
): Promise<void> {
  // No-op: ledger entries are append-only, balances are derived
}

/**
 * No-op. The ledger-based system doesn't need balance recalculation
 * since balances are derived from ledger entries (append-only).
 */
export async function recalculateBalancesAfterDelete(
  _tx: PrismaClient,
  _companyId: number,
  _financialYearId: number,
  _itemLocations: Array<{ itemId: number; storeId: number }>,
): Promise<void> {
  // No-op: ledger entries are append-only, balances are derived
}
