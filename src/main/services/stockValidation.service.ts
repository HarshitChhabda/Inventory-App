import { PrismaClient, Prisma } from '@prisma/client';

export interface StockValidationResult {
  sufficient: boolean;
  available: number;
  requested: number;
  itemName: string;
  itemId: number;
}

/**
 * Centralized stock sufficiency validation.
 * Used by every stock-deducting operation (Issue, Transfer Out, Damage, Vendor Return, Adjustment Out).
 * Reads the latest balance for the given item+location within the current transaction context.
 *
 * IMPORTANT: When called from within a $transaction callback, pass the transaction client (`tx`)
 * to ensure the read is part of the same transaction and sees uncommitted writes.
 */
export async function validateSufficientStock(
  prisma: PrismaClient | Prisma.TransactionClient,
  companyId: number,
  financialYearId: number,
  itemId: number,
  departmentId: number | null,
  locationId: number | null,
  qty: number,
  condition?: string,
): Promise<StockValidationResult> {
  const whereClause: any = { companyId, financialYearId, itemId };
  if (departmentId) whereClause.departmentId = departmentId;
  if (locationId) whereClause.locationId = locationId;

  // If filtering by condition (e.g. DAMAGED for vendor returns), add that filter
  if (condition) whereClause.condition = condition;

  const lastEntry = await prisma.stockTransaction.findFirst({
    where: whereClause,
    orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
    select: { balanceQty: true },
  });

  const available = lastEntry ? Number(lastEntry.balanceQty) : 0;
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
  prisma: PrismaClient | Prisma.TransactionClient,
  companyId: number,
  financialYearId: number,
  items: Array<{ itemId: number; departmentId: number | null; locationId: number | null; qty: number; condition?: string }>,
): Promise<StockValidationResult[]> {
  const failures: StockValidationResult[] = [];

  // Group by item+location to avoid duplicate queries
  const uniqueChecks = new Map<string, { itemId: number; departmentId: number | null; locationId: number | null; qty: number; condition?: string }>();
  for (const item of items) {
    const key = `${item.itemId}-${item.departmentId ?? 'null'}-${item.locationId ?? 'null'}-${item.condition ?? 'GOOD'}`;
    const existing = uniqueChecks.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      uniqueChecks.set(key, { ...item });
    }
  }

  for (const check of uniqueChecks.values()) {
    const result = await validateSufficientStock(
      prisma, companyId, financialYearId, check.itemId, check.departmentId, check.locationId, check.qty, check.condition,
    );
    if (!result.sufficient) {
      failures.push(result);
    }
  }

  return failures;
}

/**
 * Gets the latest balance for an item+location.
 * When called within a $transaction, pass the tx client for consistency.
 */
export async function getLatestBalance(
  prisma: PrismaClient | Prisma.TransactionClient,
  companyId: number,
  financialYearId: number,
  itemId: number,
  departmentId: number | null,
  locationId: number | null,
): Promise<number> {
  const whereClause: any = { companyId, financialYearId, itemId };
  if (departmentId) whereClause.departmentId = departmentId;
  if (locationId) whereClause.locationId = locationId;

  const lastEntry = await prisma.stockTransaction.findFirst({
    where: whereClause,
    orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
    select: { balanceQty: true },
  });

  return lastEntry ? Number(lastEntry.balanceQty) : 0;
}

/**
 * FIX #4: After inserting a potentially backdated transaction, recalculate
 * balanceQty for all rows at the same item+department+location, starting from the
 * inserted row onwards. Ordered by (transactionDate, id) for chronological consistency.
 *
 * This must be called inside a $transaction to ensure consistency.
 */
export async function recalculateBalancesAfterInsert(
  tx: Prisma.TransactionClient,
  companyId: number,
  financialYearId: number,
  itemId: number,
  departmentId: number | null,
  locationId: number | null,
  insertedDate: Date,
): Promise<void> {
  const whereClause: any = { companyId, financialYearId, itemId };
  if (departmentId) whereClause.departmentId = departmentId;
  if (locationId) whereClause.locationId = locationId;

  // Get all transactions for this item+department+location, ordered by date then id
  const allTxns = await tx.stockTransaction.findMany({
    where: whereClause,
    orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
    select: { id: true, quantityIn: true, quantityOut: true, transactionDate: true },
  });

  if (allTxns.length === 0) return;

  // Find the index of the first transaction whose date >= insertedDate
  // This is where recalculation needs to start
  const startIdx = allTxns.findIndex(t => t.transactionDate >= insertedDate);
  if (startIdx === -1) return; // All transactions are before the insertion — no recalc needed

  // Compute running balance up to (but not including) the start index
  let runningBalance = 0;
  for (let i = 0; i < startIdx; i++) {
    runningBalance += Number(allTxns[i].quantityIn) - Number(allTxns[i].quantityOut);
  }

  // Recalculate from the start index onwards (includes the inserted row)
  // Sequential to avoid SQLite write contention
  for (let i = startIdx; i < allTxns.length; i++) {
    runningBalance += Number(allTxns[i].quantityIn) - Number(allTxns[i].quantityOut);
    await tx.stockTransaction.update({
      where: { id: allTxns[i].id },
      data: { balanceQty: new Prisma.Decimal(runningBalance) },
    });
  }
}

/**
 * After deleting stock transactions, recalculate all remaining balances
 * for each affected item+department+location from the very beginning.
 * Must be called inside a $transaction.
 */
export async function recalculateBalancesAfterDelete(
  tx: Prisma.TransactionClient,
  companyId: number,
  financialYearId: number,
  itemLocations: Array<{ itemId: number; departmentId: number | null; locationId: number | null }>,
): Promise<void> {
  // Deduplicate by item+department+location
  const unique = new Map<string, { itemId: number; departmentId: number | null; locationId: number | null }>();
  for (const il of itemLocations) {
    unique.set(`${il.itemId}-${il.departmentId ?? 'null'}-${il.locationId ?? 'null'}`, il);
  }

  for (const { itemId, departmentId, locationId } of unique.values()) {
    const whereClause: any = { companyId, financialYearId, itemId };
    if (departmentId) whereClause.departmentId = departmentId;
    if (locationId) whereClause.locationId = locationId;

    const allTxns = await tx.stockTransaction.findMany({
      where: whereClause,
      orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
      select: { id: true, quantityIn: true, quantityOut: true },
    });

    let runningBalance = 0;
    for (const txn of allTxns) {
      runningBalance += Number(txn.quantityIn) - Number(txn.quantityOut);
      await tx.stockTransaction.update({
        where: { id: txn.id },
        data: { balanceQty: new Prisma.Decimal(runningBalance) },
      });
    }
  }
}
