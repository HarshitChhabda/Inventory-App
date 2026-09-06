import { PrismaClient } from '@prisma/client';
import { SystemConfigurationService } from './systemConfiguration.service';
import { StockBalanceService } from './stockBalance.service';

export interface StockBalance {
  itemId: number;
  itemName: string;
  itemCode: string;
  storeId: number;
  storeName: string;
  available: number;
  installed: number;
  damaged: number;
  repair: number;
  transit: number;
  scrap: number;
  lost: number;
  total: number;
  consumed: number;
  received: number;
  unitName: string;
  minimumStockLevel: number;
  maximumStockLevel: number | null;
  totalValue: number;
}

export interface ItemStockSummary {
  itemId: number;
  itemName: string;
  itemCode: string;
  stores: Array<{
    storeId: number;
    storeName: string;
    available: number;
    installed: number;
    total: number;
  }>;
  totalAvailable: number;
  totalInstalled: number;
  totalAcrossStores: number;
}

/**
 * STOCK ENGINE
 * 
 * Derives ALL stock from ledger. Never stores stock manually.
 * 
 * Stock = SUM(quantityIn) - SUM(quantityOut) from LedgerEntry
 * 
 * Stock Categories:
 * - Available: In store, ready to use
 * - Installed: At location/room
 * - Reserved: Allocated but not moved
 * - Damaged: Damaged items
 * - Repair: Under repair
 * - Transit: In transit between stores
 * - Scrap: Scrapped items
 * - Blocked: Blocked for any reason
 * - Lost: Lost items
 */
export class StockEngine {
  private configService: SystemConfigurationService;

  constructor(private prisma: PrismaClient) {
    this.configService = new SystemConfigurationService(prisma);
  }

  // ─── PRIVATE HELPERS ───────────────────────────

  /**
   * Sum all breakdown categories into a single total.
   * Extracted to eliminate 5 duplicate calculations across this file.
   */
  private computeTotal(breakdown: {
    available: number; installed: number; damaged: number;
    repair: number; transit: number; scrap: number; lost: number;
  }): number {
    return breakdown.available + breakdown.installed + breakdown.damaged
      + breakdown.repair + breakdown.transit + breakdown.scrap + breakdown.lost;
  }

  /**
   * Group ledger entries by a composite key (e.g., "itemId:storeId").
   * Extracted to eliminate 4 duplicate grouping patterns.
   */
  private groupEntriesByKey<T extends { itemId: number; storeId: number }>(
    entries: T[],
    keyFn: (e: T) => string = (e) => `${e.itemId}:${e.storeId}`,
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const entry of entries) {
      const key = keyFn(entry);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }

  /**
   * Group entries by a single numeric key (e.g., itemId or storeId).
   */
  private groupByKey<T>(entries: T[], keyFn: (e: T) => number): Map<number, T[]> {
    const map = new Map<number, T[]>();
    for (const entry of entries) {
      const key = keyFn(entry);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }

  /**
   * Get stock balance for an item at a store.
   * Always calculated from ledger.
   */
  async getStockBalance(
    companyId: number,
    financialYearId: number,
    itemId: number,
    storeId: number,
  ): Promise<number> {
    const balanceService = new StockBalanceService(this.prisma);
    const balance = await balanceService.getBalance(companyId, financialYearId, storeId, itemId);
    return balance?.total || 0;
  }

  /**
   * Get full stock breakdown for an item at a store.
   */
  async getStockBreakdown(
    companyId: number,
    financialYearId: number,
    itemId: number,
    storeId: number,
  ): Promise<{
    available: number;
    installed: number;
    reserved: number;
    damaged: number;
    repair: number;
    transit: number;
    scrap: number;
    blocked: number;
    lost: number;
  }> {
    const balanceService = new StockBalanceService(this.prisma);
    const balance = await balanceService.getBalance(companyId, financialYearId, storeId, itemId);
    if (!balance) {
      return { available: 0, installed: 0, reserved: 0, damaged: 0, repair: 0, transit: 0, scrap: 0, blocked: 0, lost: 0 };
    }
    return {
      available: Math.max(0, balance.available),
      installed: Math.max(0, balance.installed),
      reserved: 0,
      damaged: Math.max(0, balance.damaged),
      repair: Math.max(0, balance.repair),
      transit: 0,
      scrap: Math.max(0, balance.scrap),
      blocked: 0,
      lost: 0,
    };
  }

  /**
   * Get stock for all items at a store — batch query (no N+1).
   */
  async getStoreStock(
    companyId: number,
    financialYearId: number,
    storeId: number,
  ): Promise<StockBalance[]> {
    const balanceService = new StockBalanceService(this.prisma);
    const balances = await balanceService.getStoreBalances(companyId, financialYearId, storeId);
    if (balances.length === 0) return [];

    const itemIds = balances.map((b) => b.itemId);

    const [items, consumptionRows, receivedRows] = await Promise.all([
      this.prisma.item.findMany({
        where: { id: { in: itemIds } },
        include: { unit: true, category: true },
      }),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT itemId, CAST(SUM(quantityOut) AS TEXT) as totalConsumed
         FROM LedgerEntry
         WHERE companyId = ? AND financialYearId = ? AND storeId = ?
         AND itemId IN (${itemIds.join(',')})
         AND movementType IN ('CONSUMPTION_OUT', 'SCRAP_OUT', 'VENDOR_RETURN', 'ISSUE_OUT')
         GROUP BY itemId`,
        companyId, financialYearId, storeId
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT itemId, CAST(SUM(quantityIn) AS TEXT) as totalReceived
         FROM LedgerEntry
         WHERE companyId = ? AND financialYearId = ? AND storeId = ?
         AND itemId IN (${itemIds.join(',')})
         AND movementType IN ('PURCHASE_RECEIPT', 'OPENING_BALANCE', 'OPENING_STOCK', 'TRANSFER_IN', 'CARRY_FORWARD')
         GROUP BY itemId`,
        companyId, financialYearId, storeId
      ),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const consumptionMap = new Map(consumptionRows.map((r) => [r.itemId, Number(r.totalConsumed) || 0]));
    const receivedMap = new Map(receivedRows.map((r) => [r.itemId, Number(r.totalReceived) || 0]));

    return balances.map((b) => {
      const item = itemMap.get(b.itemId);
      return {
        itemId: b.itemId,
        itemName: item?.itemName || '',
        itemCode: item?.itemCode || '',
        storeId,
        storeName: '',
        ...b,
        consumed: consumptionMap.get(b.itemId) || 0,
        received: receivedMap.get(b.itemId) || 0,
        unitName: item?.unit?.name || '',
        minimumStockLevel: item ? Number(item.minimumStockLevel) : 0,
        maximumStockLevel: item?.maximumStockLevel ? Number(item.maximumStockLevel) : null,
        totalValue: b.totalValue,
      };
    });
  }

  /**
   * Get stock across all stores for an item — batch query (no N+1).
   */
  async getItemStockAcrossStores(
    companyId: number,
    financialYearId: number,
    itemId: number,
  ): Promise<Array<{
    storeId: number;
    storeName: string;
    storeType: string;
    available: number;
    installed: number;
    damaged: number;
    repair: number;
    transit: number;
    scrap: number;
    lost: number;
    total: number;
    consumed: number;
    received: number;
  }>> {
    const balanceService = new StockBalanceService(this.prisma);
    const balances = await balanceService.getItemBalances(companyId, financialYearId, itemId);
    if (balances.length === 0) return [];

    const storeIds = balances.map((b) => b.storeId);

    const [stores, consumptionRows, receivedRows] = await Promise.all([
      this.prisma.store.findMany({ where: { id: { in: storeIds } } }),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT storeId, CAST(SUM(quantityOut) AS TEXT) as totalConsumed
         FROM LedgerEntry
         WHERE companyId = ? AND financialYearId = ? AND itemId = ?
         AND storeId IN (${storeIds.join(',')})
         AND movementType IN ('CONSUMPTION_OUT', 'SCRAP_OUT', 'VENDOR_RETURN', 'ISSUE_OUT')
         GROUP BY storeId`,
        companyId, financialYearId, itemId
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT storeId, CAST(SUM(quantityIn) AS TEXT) as totalReceived
         FROM LedgerEntry
         WHERE companyId = ? AND financialYearId = ? AND itemId = ?
         AND storeId IN (${storeIds.join(',')})
         AND movementType IN ('PURCHASE_RECEIPT', 'OPENING_BALANCE', 'OPENING_STOCK', 'TRANSFER_IN', 'CARRY_FORWARD')
         GROUP BY storeId`,
        companyId, financialYearId, itemId
      ),
    ]);

    const storeMap = new Map(stores.map((s) => [s.id, s]));
    const consumptionMap = new Map(consumptionRows.map((r) => [r.storeId, Number(r.totalConsumed) || 0]));
    const receivedMap = new Map(receivedRows.map((r) => [r.storeId, Number(r.totalReceived) || 0]));

    return balances.map((b) => ({
      storeId: b.storeId,
      storeName: storeMap.get(b.storeId)?.name || 'Unknown',
      storeType: storeMap.get(b.storeId)?.storeType || 'UNKNOWN',
      available: b.available,
      installed: b.installed,
      damaged: b.damaged,
      repair: b.repair,
      transit: 0,
      scrap: b.scrap,
      lost: 0,
      total: b.total,
      consumed: consumptionMap.get(b.storeId) || 0,
      received: receivedMap.get(b.storeId) || 0,
    }));
  }

  /**
   * Get items installed at a specific location (room).
   */
  async getLocationItems(
    companyId: number,
    financialYearId: number,
    roomId: number,
  ): Promise<Array<{
    itemId: number;
    itemName: string;
    itemCode: string;
    installedQty: number;
    condition: string;
    installedDate: Date;
    installedBy: string;
    remarks: string;
  }>> {
    const installations = await this.prisma.assetInstallation.findMany({
      where: { roomId, status: 'ACTIVE' },
      include: { item: true },
    });

    return installations.map((inst) => ({
      itemId: inst.itemId,
      itemName: inst.item?.itemName || 'Unknown',
      itemCode: inst.item?.itemCode || 'N/A',
      installedQty: Number(inst.quantity),
      condition: 'GOOD',
      installedDate: inst.installedDate,
      installedBy: inst.installedBy || 'Unknown',
      remarks: inst.remarks || '',
    }));
  }

  /**
   * Get all locations with their installed items.
   */
  async getAllLocationItems(
    companyId: number,
    financialYearId: number,
  ): Promise<Array<{
    roomId: number;
    roomName: string;
    storeId: number;
    storeName: string;
    locationName: string;
    totalInstalled: number;
    items: Array<{
      itemId: number;
      itemName: string;
      itemCode: string;
      installedQty: number;
      condition: string;
      installedDate: Date;
      installedBy: string;
    }>;
  }>> {
    const installations = await this.prisma.assetInstallation.findMany({
      where: { status: 'ACTIVE', store: { companyId } },
      include: { item: true, room: { include: { location: true } }, store: true },
      take: 5000,
    });

    // Group by room
    const roomMap = new Map<number, {
      roomId: number; roomName: string; storeId: number; storeName: string;
      locationName: string; totalInstalled: number;
      items: Array<{ itemId: number; itemName: string; itemCode: string; installedQty: number; condition: string; installedDate: Date; installedBy: string }>;
    }>();
    for (const inst of installations) {
      if (!roomMap.has(inst.roomId)) {
        roomMap.set(inst.roomId, {
          roomId: inst.roomId,
          roomName: inst.room?.name || 'Unknown',
          storeId: inst.storeId,
          storeName: inst.store?.name || 'Unknown',
          locationName: inst.room?.location?.name || '',
          totalInstalled: 0,
          items: [],
        });
      }
      const room = roomMap.get(inst.roomId);
      room.totalInstalled += Number(inst.quantity);
      room.items.push({
        itemId: inst.itemId,
        itemName: inst.item?.itemName || 'Unknown',
        itemCode: inst.item?.itemCode || 'N/A',
        installedQty: Number(inst.quantity),
        condition: 'GOOD',
        installedDate: inst.installedDate,
        installedBy: inst.installedBy || 'Unknown',
      });
    }

    return Array.from(roomMap.values());
  }

  /**
   * Get low stock alerts — batch query (no N+1).
   */
  async getLowStockAlerts(
    companyId: number,
    financialYearId: number,
  ): Promise<Array<{
    itemId: number;
    itemName: string;
    itemCode: string;
    currentStock: number;
    minimumLevel: number;
    deficit: number;
  }>> {
    const globalThreshold = await this.configService.getNumber(companyId, 'REPORT.LOW_STOCK_THRESHOLD');
    const [items, balanceRows] = await Promise.all([
      this.prisma.item.findMany({
        where: { isActive: true },
        include: { unit: true },
      }),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT itemId, CAST(SUM(availableQty + installedQty + damagedQty + repairQty + scrapQty) AS TEXT) as total
         FROM CurrentStockBalance
         WHERE companyId = ? AND financialYearId = ?
         GROUP BY itemId`,
        companyId, financialYearId
      ),
    ]);

    const stockMap = new Map<number, number>();
    for (const row of balanceRows) {
      stockMap.set(row.itemId, Number(row.total));
    }

    const alerts = [];
    for (const item of items) {
      const totalStock = stockMap.get(item.id) || 0;
      const minLevel = Number(item.minimumStockLevel) || globalThreshold;
      if (minLevel > 0 && totalStock < minLevel) {
        alerts.push({
          itemId: item.id,
          itemName: item.itemName,
          itemCode: item.itemCode,
          currentStock: totalStock,
          minimumLevel: minLevel,
          deficit: minLevel - totalStock,
        });
      }
    }

    return alerts;
  }

  /**
   * Validate stock availability.
   */
  async validateStock(
    companyId: number,
    financialYearId: number,
    itemId: number,
    storeId: number,
    quantity: number,
  ): Promise<{ valid: boolean; available: number; requested: number; message?: string; itemName?: string }> {
    const available = await this.getStockBalance(companyId, financialYearId, itemId, storeId);

    if (available < quantity) {
      const item = await this.prisma.item.findUnique({ where: { id: itemId } });
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      return {
        valid: false,
        available,
        requested: quantity,
        itemName: item?.itemName,
        message: `Insufficient stock: ${item?.itemName} has ${available} at ${store?.name}, requested ${quantity}`,
      };
    }

    return { valid: true, available, requested: quantity };
  }

  /**
   * Get carry-forward balances for all (itemId, storeId) pairs — batch query (no N+1).
   */
  async getCarryForwardBalances(
    companyId: number,
    financialYearId: number,
  ): Promise<Array<{ itemId: number; storeId: number; totalQty: number }>> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, financialYearId },
      select: { itemId: true, storeId: true, quantityIn: true, quantityOut: true, movementType: true, transactionDate: true, id: true, locationId: true },
    });

    // Group entries by (itemId, storeId)
    const entriesByKey = this.groupEntriesByKey(entries);

    const results: Array<{ itemId: number; storeId: number; totalQty: number }> = [];

    for (const [key, pairEntries] of entriesByKey) {
      const [itemId, storeId] = key.split(':').map(Number);
      const breakdown = this.computeBreakdown(pairEntries);
      const totalQty = this.computeTotal(breakdown);

      if (totalQty > 0) {
        results.push({ itemId, storeId, totalQty });
      }
    }

    return results;
  }

  /**
   * Compute stock breakdown from pre-fetched ledger entries (no DB queries).
   *
   * Each LedgerEntry has quantityIn/quantityOut for ONE store.
   * movementType indicates what happened AT THAT STORE:
   *   - *_IN entries: qtyIn > 0 (items arrived at this store)
   *   - *_OUT entries: qtyOut > 0 (items left this store)
   *
   * State transitions:
   *   OPENING_BALANCE / PURCHASE_RECEIPT / TRANSFER_IN / RETURN_IN / CARRY_FORWARD
   *     → available increases (items arrived)
   *   ISSUE_OUT / TRANSFER_OUT / RETURN_OUT / VENDOR_RETURN
   *     → available decreases (items left store)
   *   INSTALL_OUT → available decreases, installed increases (moved to room)
   *   UNINSTALL_OUT / SHIFT_IN → installed decreases, available increases (back from room)
   *   SHIFT_OUT / INSTALL_IN → installed decreases (leaving current room)
   *     Note: for inter-room shifts, the destination entry is SHIFT_IN at dest room
   *     which adds to installed via the UNINSTALL_OUT/SHIFT_IN path
   *   DAMAGE_OUT → available decreases, damaged increases (item became damaged)
   *   REPAIR_OUT → available decreases, repair increases (sent to repair)
   *   REPAIR_IN → available increases (repaired item returned)
   *   SCRAP_OUT → available decreases, scrap increases (scrapped)
   *   REPLACEMENT_OUT → available decreases (old item removed)
   *   REPLACEMENT_IN → available increases (new item received)
   *   ADJUSTMENT_PLUS → available increases
   *   ADJUSTMENT_MINUS → available decreases
   *   REVERSAL → reverses previous movement effect
   */
  private computeBreakdown(entries: Array<{ quantityIn: any; quantityOut: any; movementType: string; locationId?: number | null }>): {
    available: number;
    installed: number;
    reserved: number;
    damaged: number;
    repair: number;
    transit: number;
    scrap: number;
    blocked: number;
    lost: number;
  } {
    let available = 0;
    let installed = 0;
    let damaged = 0;
    let repair = 0;
    let scrap = 0;
    let lost = 0;

    for (const entry of entries) {
      const qtyIn = Number(entry.quantityIn);
      const qtyOut = Number(entry.quantityOut);
      const type = entry.movementType;

      switch (type) {
        // ── INFLOWS: items arrive at this store → available increases ──
        case 'OPENING_BALANCE':
        case 'OPENING_STOCK': // backward-compatible alias
        case 'PURCHASE_RECEIPT':
        case 'TRANSFER_IN':
        case 'RETURN_IN':
        case 'CARRY_FORWARD':
        case 'ADJUSTMENT_PLUS':
        case 'ISSUE_IN':
          available += qtyIn - qtyOut;
          break;

        // ── OUTFLOWS: items leave store → available decreases ──
        case 'ISSUE_OUT':
        case 'TRANSFER_OUT':
        case 'RETURN_OUT':
        case 'VENDOR_RETURN':
        case 'ADJUSTMENT_MINUS':
          available -= qtyOut;
          available += qtyIn;
          break;

        // ── REPLACEMENT: old item out, new item in ──
        case 'REPLACEMENT_OUT':
          available -= qtyOut;
          break;
        case 'REPLACEMENT_IN':
          available += qtyIn;
          break;

        // ── INSTALL: available → installed ──
        case 'INSTALL_OUT':
          available -= qtyOut;
          installed += qtyOut;
          break;

        // ── UNINSTALL_OUT: item leaves room → installed decreases ──
        case 'UNINSTALL_OUT':
          installed -= qtyOut;
          break;

        // ── SHIFT_IN: item arrives at destination ──
        // locationId determines semantics:
        //   - locationId set (Room): item arrived at a room → installed increases
        //   - locationId null (Store): item returned from room to store → available increases
        // Covers: DS Store→Room, DS Room→Store, DS Room→Room, DP, SH, UN
        case 'SHIFT_IN':
          if ((entry as any).locationId) {
            installed += qtyIn;
          } else {
            available += qtyIn;
          }
          break;

        // ── SHIFT_OUT: item leaves source ──
        // locationId determines semantics:
        //   - locationId null (Store): item leaving store pool → available decreases
        //   - locationId set (Room): item leaving a room → installed decreases
        // Covers: DS Store→Room, DS Room→Store, DS Room→Room, DP, SH
        case 'SHIFT_OUT':
          if ((entry as any).locationId) {
            installed -= qtyOut;
          } else {
            available -= qtyOut;
          }
          break;

        // ── INSTALL_IN: item arrives at destination room ──
        // This is the destination-side entry. For initial installation,
        // both INSTALL_OUT and INSTALL_IN are at the same store.
        // INSTALL_OUT already moved stock from available→installed.
        // INSTALL_IN at the SAME store should be ignored (no net change).
        // For inter-room shifts, SHIFT_IN at destination handles the increase.
        case 'INSTALL_IN':
          // Intentionally no-op at store level when locationId is set.
          // The stock movement is already handled by INSTALL_OUT.
          break;

        // ── DAMAGE: available → damaged ──
        case 'DAMAGE_OUT':
          available -= qtyOut;
          damaged += qtyOut;
          break;
        case 'DAMAGE_IN':
          // DAMAGE_IN at destination (e.g., scrap yard) — not counted as available
          // Only relevant if destination is within company; otherwise ignore
          break;

        // ── REPAIR: available → repair ──
        case 'REPAIR_OUT':
          available -= qtyOut;
          repair += qtyOut;
          break;
        case 'REPAIR_IN':
          // Repaired item returns to available
          available += qtyIn;
          repair -= qtyOut;
          break;

        // ── SCRAP: available → scrap (permanent) ──
        case 'SCRAP_OUT':
          available -= qtyOut;
          scrap += qtyOut;
          break;

        // ── CONSUMPTION: available decreases (items physically consumed) ──
        case 'CONSUMPTION_OUT':
          available -= qtyOut;
          break;

        // ── CONSUMPTION REVERSAL: restores available (consumption cancelled) ──
        case 'CONSUMPTION_REVERSAL':
          available += qtyIn;
          break;

        // ── REVERSAL: reverses a previous movement ──
        case 'REVERSAL':
          // Reversal entries mirror the original movement's effect
          available += qtyIn - qtyOut;
          break;
      }
    }

    return {
      available: Math.max(0, available),
      installed: Math.max(0, installed),
      reserved: 0,
      damaged: Math.max(0, damaged),
      repair: Math.max(0, repair),
      transit: 0,
      scrap: Math.max(0, scrap),
      blocked: 0,
      lost: Math.max(0, lost),
    };
  }
}
