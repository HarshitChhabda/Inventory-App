import { PrismaClient, Prisma } from '@prisma/client';

/**
 * CurrentStockBalance — O(1) stock reads.
 *
 * This service maintains a pre-aggregated CurrentStockBalance table
 * that is updated atomically within the same transaction that creates
 * ledger entries. This eliminates O(N) full-table scans for current stock.
 *
 * LedgerEntry remains the authoritative historical/audit record.
 * CurrentStockBalance is a derived cache that can be rebuilt from LedgerEntry.
 */

interface StockBalanceRow {
  companyId: number;
  financialYearId: number;
  storeId: number;
  itemId: number;
  availableQty: number;
  installedQty: number;
  damagedQty: number;
  repairQty: number;
  scrapQty: number;
  totalValue: number;
}

interface BreakdownDelta {
  availableDelta: number;
  installedDelta: number;
  damagedDelta: number;
  repairDelta: number;
  scrapDelta: number;
  valueDelta: number;
}

export class StockBalanceService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Compute the stock dimension deltas for a single ledger entry.
   * This mirrors the logic in StockEngine.computeBreakdown but returns deltas
   * instead of absolute values.
   */
  computeDelta(
    movementType: string,
    quantityIn: number,
    quantityOut: number,
    locationId?: number | null,
  ): BreakdownDelta {
    let availableDelta = 0;
    let installedDelta = 0;
    let damagedDelta = 0;
    let repairDelta = 0;
    let scrapDelta = 0;

    switch (movementType) {
      case 'OPENING_BALANCE':
      case 'OPENING_STOCK':
      case 'PURCHASE_RECEIPT':
      case 'TRANSFER_IN':
      case 'RETURN_IN':
      case 'CARRY_FORWARD':
      case 'ADJUSTMENT_PLUS':
      case 'ISSUE_IN':
        availableDelta = quantityIn - quantityOut;
        break;

      case 'ISSUE_OUT':
      case 'TRANSFER_OUT':
      case 'RETURN_OUT':
      case 'VENDOR_RETURN':
      case 'ADJUSTMENT_MINUS':
        availableDelta = quantityIn - quantityOut;
        break;

      case 'REPLACEMENT_OUT':
        availableDelta = -quantityOut;
        break;
      case 'REPLACEMENT_IN':
        availableDelta = quantityIn;
        break;

      case 'INSTALL_OUT':
        availableDelta = -quantityOut;
        installedDelta = quantityOut;
        break;

      case 'UNINSTALL_OUT':
        installedDelta = -quantityOut;
        break;

      case 'SHIFT_IN':
        if (locationId) {
          installedDelta = quantityIn;
        } else {
          availableDelta = quantityIn;
        }
        break;

      case 'SHIFT_OUT':
        if (locationId) {
          installedDelta = -quantityOut;
        } else {
          availableDelta = -quantityOut;
        }
        break;

      case 'INSTALL_IN':
        break;

      case 'DAMAGE_OUT':
        availableDelta = -quantityOut;
        damagedDelta = quantityOut;
        break;
      case 'DAMAGE_IN':
        break;

      case 'REPAIR_OUT':
        availableDelta = -quantityOut;
        repairDelta = quantityOut;
        break;
      case 'REPAIR_IN':
        availableDelta = quantityIn;
        repairDelta = -quantityOut;
        break;

      case 'SCRAP_OUT':
        availableDelta = -quantityOut;
        scrapDelta = quantityOut;
        break;

      case 'CONSUMPTION_OUT':
        availableDelta = -quantityOut;
        break;

      case 'CONSUMPTION_REVERSAL':
        availableDelta = quantityIn;
        break;

      case 'REVERSAL':
        availableDelta = quantityIn - quantityOut;
        break;
    }

    const valueDelta = (quantityIn - quantityOut); // net value change (rate applied separately)

    return { availableDelta, installedDelta, damagedDelta, repairDelta, scrapDelta, valueDelta };
  }

  /**
   * Update CurrentStockBalance atomically within an existing transaction.
   * Call this INSIDE the same $transaction that creates ledger entries.
   */
  async updateBalance(
    tx: Prisma.TransactionClient,
    companyId: number,
    financialYearId: number,
    storeId: number,
    itemId: number,
    delta: BreakdownDelta,
  ): Promise<void> {
    // Use UPSERT to create or update the balance row
    const existing = await tx.$queryRawUnsafe<{ availableQty: number; installedQty: number; damagedQty: number; repairQty: number; scrapQty: number; totalValue: number }[]>(
      `SELECT availableQty, installedQty, damagedQty, repairQty, scrapQty, totalValue
       FROM CurrentStockBalance
       WHERE companyId = ? AND financialYearId = ? AND storeId = ? AND itemId = ?`,
      companyId, financialYearId, storeId, itemId
    );

    if (existing.length > 0) {
      const cur = existing[0];
      await tx.$executeRawUnsafe(
        `UPDATE CurrentStockBalance SET
          availableQty = MAX(0, ? + ?),
          installedQty = MAX(0, ? + ?),
          damagedQty = MAX(0, ? + ?),
          repairQty = MAX(0, ? + ?),
          scrapQty = MAX(0, ? + ?),
          totalValue = MAX(0, ? + ?),
          updatedAt = CURRENT_TIMESTAMP
         WHERE companyId = ? AND financialYearId = ? AND storeId = ? AND itemId = ?`,
        cur.availableQty, delta.availableDelta,
        cur.installedQty, delta.installedDelta,
        cur.damagedQty, delta.damagedDelta,
        cur.repairQty, delta.repairDelta,
        cur.scrapQty, delta.scrapDelta,
        cur.totalValue, delta.valueDelta,
        companyId, financialYearId, storeId, itemId
      );
    } else {
      await tx.$executeRawUnsafe(
        `INSERT INTO CurrentStockBalance (companyId, financialYearId, storeId, itemId, availableQty, installedQty, damagedQty, repairQty, scrapQty, totalValue)
         VALUES (?, ?, ?, ?, MAX(0, ?), MAX(0, ?), MAX(0, ?), MAX(0, ?), MAX(0, ?), MAX(0, ?))`,
        companyId, financialYearId, storeId, itemId,
        delta.availableDelta, delta.installedDelta, delta.damagedDelta, delta.repairDelta, delta.scrapDelta, delta.valueDelta
      );
    }
  }

  /**
   * Read current stock for a single item at a single store. O(1).
   */
  async getBalance(
    companyId: number,
    financialYearId: number,
    storeId: number,
    itemId: number,
  ): Promise<{ available: number; installed: number; damaged: number; repair: number; scrap: number; total: number } | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT availableQty, installedQty, damagedQty, repairQty, scrapQty
       FROM CurrentStockBalance
       WHERE companyId = ? AND financialYearId = ? AND storeId = ? AND itemId = ?`,
      companyId, financialYearId, storeId, itemId
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    const total = r.availableQty + r.installedQty + r.damagedQty + r.repairQty + r.scrapQty;
    return { available: r.availableQty, installed: r.installedQty, damaged: r.damagedQty, repair: r.repairQty, scrap: r.scrapQty, total };
  }

  /**
   * Read all stock balances for a store. O(items_at_store).
   */
  async getStoreBalances(
    companyId: number,
    financialYearId: number,
    storeId: number,
  ): Promise<Array<{ itemId: number; available: number; installed: number; damaged: number; repair: number; scrap: number; total: number; totalValue: number }>> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT itemId, availableQty, installedQty, damagedQty, repairQty, scrapQty, totalValue
       FROM CurrentStockBalance
       WHERE companyId = ? AND financialYearId = ? AND storeId = ?
       AND (availableQty + installedQty + damagedQty + repairQty + scrapQty) > 0`,
      companyId, financialYearId, storeId
    );
    return rows.map(r => ({
      itemId: r.itemId,
      available: r.availableQty,
      installed: r.installedQty,
      damaged: r.damagedQty,
      repair: r.repairQty,
      scrap: r.scrapQty,
      total: r.availableQty + r.installedQty + r.damagedQty + r.repairQty + r.scrapQty,
      totalValue: r.totalValue,
    }));
  }

  /**
   * Read all stock balances for an item across all stores. O(stores_with_item).
   */
  async getItemBalances(
    companyId: number,
    financialYearId: number,
    itemId: number,
  ): Promise<Array<{ storeId: number; available: number; installed: number; damaged: number; repair: number; scrap: number; total: number }>> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT storeId, availableQty, installedQty, damagedQty, repairQty, scrapQty
       FROM CurrentStockBalance
       WHERE companyId = ? AND financialYearId = ? AND itemId = ?
       AND (availableQty + installedQty + damagedQty + repairQty + scrapQty) > 0`,
      companyId, financialYearId, itemId
    );
    return rows.map(r => ({
      storeId: r.storeId,
      available: r.availableQty,
      installed: r.installedQty,
      damaged: r.damagedQty,
      repair: r.repairQty,
      scrap: r.scrapQty,
      total: r.availableQty + r.installedQty + r.damagedQty + r.repairQty + r.scrapQty,
    }));
  }

  /**
   * Get total stock for an item across all stores. O(stores_with_item).
   */
  async getTotalItemStock(
    companyId: number,
    financialYearId: number,
    itemId: number,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT CAST(SUM(availableQty + installedQty + damagedQty + repairQty + scrapQty) AS TEXT) as total
       FROM CurrentStockBalance
       WHERE companyId = ? AND financialYearId = ? AND itemId = ?`,
      companyId, financialYearId, itemId
    );
    return Number(rows[0]?.total || 0);
  }

  /**
   * Get low stock alerts. O(items + balances) instead of O(ledger_entries).
   */
  async getLowStockAlerts(
    companyId: number,
    financialYearId: number,
    threshold: number,
  ): Promise<Array<{ itemId: number; totalStock: number }>> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT itemId, CAST(SUM(availableQty + installedQty + damagedQty + repairQty + scrapQty) AS TEXT) as total
       FROM CurrentStockBalance
       WHERE companyId = ? AND financialYearId = ?
       GROUP BY itemId
       HAVING total < ?`,
      companyId, financialYearId, threshold
    );
    return rows.map(r => ({ itemId: r.itemId, totalStock: Number(r.total) }));
  }

  /**
   * Rebuild all balances from LedgerEntry. Used for initial migration or reconciliation.
   * This is O(N) but only called once during migration.
   */
  async rebuildAll(companyId: number, financialYearId: number): Promise<number> {
    // Clear existing balances for this FY
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM CurrentStockBalance WHERE companyId = ? AND financialYearId = ?',
      companyId, financialYearId
    );

    // Get all ledger entries grouped by (itemId, storeId)
    const entries = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT itemId, storeId, locationId, movementType, CAST(quantityIn AS TEXT) as quantityIn, CAST(quantityOut AS TEXT) as quantityOut, CAST(rate AS TEXT) as rate
       FROM LedgerEntry
       WHERE companyId = ? AND financialYearId = ?
       ORDER BY transactionDate ASC, createdAt ASC, id ASC`,
      companyId, financialYearId
    );

    // Group by (itemId, storeId)
    const groups = new Map<string, any[]>();
    for (const e of entries) {
      const key = `${e.itemId}:${e.storeId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    let count = 0;
    for (const [key, pairEntries] of groups) {
      const [itemId, storeId] = key.split(':').map(Number);

      // Compute final balance from all entries
      let available = 0, installed = 0, damaged = 0, repair = 0, scrap = 0, totalValue = 0;
      for (const e of pairEntries) {
        const delta = this.computeDelta(e.movementType, Number(e.quantityIn), Number(e.quantityOut), e.locationId);
        available += delta.availableDelta;
        installed += delta.installedDelta;
        damaged += delta.damagedDelta;
        repair += delta.repairDelta;
        scrap += delta.scrapDelta;
        totalValue += (Number(e.quantityIn) - Number(e.quantityOut)) * Number(e.rate || 0);
      }

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO CurrentStockBalance (companyId, financialYearId, storeId, itemId, availableQty, installedQty, damagedQty, repairQty, scrapQty, totalValue)
         VALUES (?, ?, ?, ?, MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?))`,
        companyId, financialYearId, storeId, itemId,
        available, installed, damaged, repair, scrap, totalValue
      );
      count++;
    }

    return count;
  }
}
