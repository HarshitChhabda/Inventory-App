import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';

export interface DashboardFilter {
  companyId: number;
  financialYearId?: number;
  storeId?: number;
  departmentId?: number;
  locationId?: number;
}

export class DashboardService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  private static async getCurrentFY(companyId: number) {
    const fy = await this.prisma.financialYear.findFirst({ where: { companyId, isClosed: false } });
    return fy?.id;
  }

  static async getSuperAdminDashboard(filter: DashboardFilter) {
    const { companyId } = filter;
    const fy = filter.financialYearId || await this.getCurrentFY(companyId);
    const now = new Date();

    const [
      totalItems, totalAssets, totalStores, totalDepartments,
      totalVendors, totalTransactions, todayTransactions,
      installedAssets, pendingRequests, pendingApprovals,
      pendingPO, pendingWO,
      repairStock, damagedStock, scrapStock, totalUsers,
    ] = await Promise.all([
      this.prisma.item.count(),
      this.prisma.assetProfile.count({ where: { companyId } }),
      this.prisma.store.count({ where: { companyId } }),
      this.prisma.department.count({ where: { companyId } }),
      this.prisma.vendor.count({ where: { companyId, isActive: true } }),
      this.prisma.transactionHeader.count({ where: { companyId } }),
      this.prisma.transactionHeader.count({ where: { companyId, transactionDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.serviceRequest.count({ where: { companyId, status: { in: ['SUBMITTED', 'ASSIGNED'] } } }),
      this.prisma.requisitionHeader.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } } }),
      this.prisma.workOrder.count({ where: { companyId, status: { in: ['DRAFT', 'APPROVED', 'IN_PROGRESS'] } } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'REPAIR' } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'DAMAGED' } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'SCRAPPED' } }),
      this.prisma.user.count(),
    ]);

    const inventoryAgg = await this.prisma.ledgerEntry.aggregate({
      where: { companyId, financialYearId: fy },
      _sum: { quantityIn: true, quantityOut: true },
    });

    const totalIn = Number(inventoryAgg._sum.quantityIn || 0);
    const totalOut = Number(inventoryAgg._sum.quantityOut || 0);
    const availableQty = totalIn - totalOut;

    const lowStockItems = await this.getLowStockItems(companyId);
    const outOfStockItems = await this.getOutOfStockItems(companyId);

    // Pending drafts (receipts in DRAFT approval status)
    const pendingDrafts = await this.prisma.transactionHeader.count({
      where: { companyId, financialYearId: fy, approvalStatus: 'DRAFT' },
    });

    // Low stock items detail for alerts
    const lowStockItemsDetail = lowStockItems.map(item => ({
      id: item.id,
      itemName: item.itemName,
      currentBalance: item.currentStock,
      minimumStockLevel: Number(item.minimumStockLevel),
      unit: item.unit ? { name: item.unit.name } : null,
    }));

    // Stock trend + Monthly movement: use StockMonthlySummary for O(1) reads
    const sms = new (await import('./stockMonthlySummary.service')).StockMonthlySummaryService(this.prisma);
    const monthlyRows = await sms.getMonthlyTrend(companyId, fy, 12);

    // Build monthlyData from summary results
    const monthlyData = new Map<string, { inbound: number; outbound: number }>();
    for (const row of monthlyRows) {
      monthlyData.set(row.month, { inbound: row.inbound, outbound: row.outbound });
    }

    const stockTrend: Array<{ month: string; value: number }> = [];
    const monthlyMovement: Array<{ month: string; inbound: number; outbound: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const data = monthlyData.get(key) || { inbound: 0, outbound: 0 };
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthLabel = `${monthNames[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`;
      stockTrend.push({ month: monthLabel, value: data.inbound - data.outbound });
      monthlyMovement.push({ month: monthLabel, inbound: data.inbound, outbound: data.outbound });
    }

    // Top consumed items — batch fetch item names instead of findUnique per item
    const topConsumedAgg = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId, financialYearId: fy, quantityOut: { gt: 0 } },
      _sum: { quantityOut: true },
      orderBy: { _sum: { quantityOut: 'desc' } },
      take: 5,
    });
    const topItemIds = topConsumedAgg.map((e) => e.itemId);
    const topItems = topItemIds.length > 0
      ? await this.prisma.item.findMany({ where: { id: { in: topItemIds } }, select: { id: true, itemName: true } })
      : [];
    const topItemMap = new Map(topItems.map((i) => [i.id, i.itemName]));
    const topConsumed = topConsumedAgg.map((entry) => ({
      name: topItemMap.get(entry.itemId) || `Item #${entry.itemId}`,
      consumed: Number(entry._sum.quantityOut || 0),
    }));

    // Category distribution — batch fetch items instead of findUnique per category entry
    const categoryAgg = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId, financialYearId: fy },
      _sum: { quantityIn: true },
    });
    const catItemIds = [...new Set(categoryAgg.map((e) => e.itemId))];
    const catItems = catItemIds.length > 0
      ? await this.prisma.item.findMany({ where: { id: { in: catItemIds } }, select: { id: true, category: { select: { name: true } } } })
      : [];
    const catItemMap = new Map(catItems.map((i) => [i.id, i.category?.name || 'Uncategorized']));
    const categoryMap: Record<string, number> = {};
    for (const entry of categoryAgg) {
      const catName = catItemMap.get(entry.itemId) || 'Uncategorized';
      categoryMap[catName] = (categoryMap[catName] || 0) + Number(entry._sum.quantityIn || 0);
    }
    const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // Department consumption
    const deptWise = await this.getDepartmentConsumption(companyId, fy);

    // Receipt vs Issue — batch query for all 12 months instead of 24 individual count queries
    const rcIcHeaders = await this.prisma.transactionHeader.groupBy({
      by: ['voucherType', 'transactionDate'],
      where: { companyId, financialYearId: fy, voucherType: { in: ['RC', 'IC'] } },
      _count: true,
    });

    // Group by month + type
    const rcIcByMonth = new Map<string, { receipts: number; issues: number }>();
    for (const entry of rcIcHeaders) {
      const d = new Date(entry.transactionDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = rcIcByMonth.get(key) || { receipts: 0, issues: 0 };
      if (entry.voucherType === 'RC') existing.receipts += entry._count;
      else existing.issues += entry._count;
      rcIcByMonth.set(key, existing);
    }

    const receiptVsIssue: Array<{ month: string; receipts: number; issues: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${start.getFullYear()}-${start.getMonth()}`;
      const data = rcIcByMonth.get(key) || { receipts: 0, issues: 0 };
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      receiptVsIssue.push({
        month: `${monthNames[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
        receipts: data.receipts,
        issues: data.issues,
      });
    }

    // Recent transactions
    const recentTxHeaders = await this.prisma.transactionHeader.findMany({
      where: { companyId, financialYearId: fy },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, voucherNo: true, voucherType: true, transactionDate: true,
        department: { select: { name: true } },
      },
    });
    const headerIds = recentTxHeaders.map(h => h.id);
    const allDetails = await this.prisma.transactionDetail.findMany({
      where: { transactionId: { in: headerIds } },
      select: { transactionId: true, itemId: true, quantity: true, item: { select: { itemName: true } } },
    });
    const recentTransactions = recentTxHeaders.map(header => {
      const detail = allDetails.find(d => d.transactionId === header.id);
      return {
        itemId: detail?.itemId || 0,
        item: (detail as any)?.item || null,
        transactionType: header.voucherType,
        transactionDate: header.transactionDate,
        quantityIn: header.voucherType === 'RC' ? Number(detail?.quantity || 0) : 0,
        quantityOut: ['IC', 'CN'].includes(header.voucherType) ? Number(detail?.quantity || 0) : 0,
        department: (header as any).department || null,
      };
    });

    // Total locations & rooms via stores
    const stores = await this.prisma.store.findMany({ where: { companyId }, select: { id: true } });
    const storeIds = stores.map(s => s.id);
    const [totalLocations, totalRooms] = await Promise.all([
      this.prisma.location.count({ where: { storeId: { in: storeIds } } }),
      this.prisma.room.count({ where: { location: { storeId: { in: storeIds } } } }),
    ]);

    return {
      totalItems, totalAssets, totalStores, totalDepartments,
      totalDharmshalas: totalLocations, totalRooms, totalVendors,
      totalTransactions, todayTransactions,
      stockValue: Number(inventoryAgg._sum.quantityIn || 0) - Number(inventoryAgg._sum.quantityOut || 0),
      availableQty,
      inventoryValue: Number(inventoryAgg._sum.quantityIn || 0) - Number(inventoryAgg._sum.quantityOut || 0),
      installedAssets, pendingRequests, pendingApprovals, pendingPO, pendingWO,
      pendingDrafts,
      lowStockItems: lowStockItems.length, outOfStockItems: outOfStockItems.length,
      lowStockItemsDetail,
      repairStock, damagedStock, scrapStock,
      recentActivities: recentTransactions.slice(0, 5),
      recentTransactions,
      totalUsers,
      currentFY: fy,
      stockTrend,
      monthlyMovement,
      topConsumed,
      categoryData,
      deptWise,
      receiptVsIssue,
    };
  }

  static async getStoreManagerDashboard(filter: DashboardFilter) {
    const { companyId, storeId } = filter;
    const fy = filter.financialYearId || await this.getCurrentFY(companyId);
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    const [todayReceipts, todayIssues, todayTransfers, pendingRequests, currentStock] = await Promise.all([
      this.prisma.transactionHeader.count({ where: { companyId, financialYearId: fy, voucherType: 'RC', transactionDate: { gte: today }, ...(storeId ? { fromStoreId: storeId } : {}) } }),
      this.prisma.transactionHeader.count({ where: { companyId, financialYearId: fy, voucherType: 'IC', transactionDate: { gte: today }, ...(storeId ? { fromStoreId: storeId } : {}) } }),
      this.prisma.transactionHeader.count({ where: { companyId, financialYearId: fy, voucherType: 'TC', transactionDate: { gte: today }, ...(storeId ? { fromStoreId: storeId } : {}) } }),
      this.prisma.serviceRequest.count({ where: { companyId, status: { in: ['SUBMITTED', 'ASSIGNED'] } } }),
      this.prisma.ledgerEntry.groupBy({
        by: ['itemId'],
        where: { companyId, financialYearId: fy, ...(storeId ? { storeId } : {}) },
        _sum: { quantityIn: true, quantityOut: true },
      }),
    ]);

    const lowStock = await this.getLowStockItems(companyId, storeId);

    return {
      todayReceipts, todayIssues, todayTransfers, pendingRequests,
      currentStockItems: currentStock.length,
      currentStockValue: currentStock.reduce((sum, s) => sum + (Number(s._sum.quantityIn || 0) - Number(s._sum.quantityOut || 0)), 0),
      lowStockItems: lowStock.length,
    };
  }

  static async getMaintenanceDashboard(filter: DashboardFilter) {
    const { companyId } = filter;

    const [pendingSR, inProgressWO, overdueWO, todayService, assetsUnderRepair] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { companyId, status: { in: ['SUBMITTED', 'ASSIGNED'] } } }),
      this.prisma.workOrder.count({ where: { companyId, status: 'IN_PROGRESS' } }),
      this.prisma.workOrder.count({ where: { companyId, status: { in: ['APPROVED', 'IN_PROGRESS'] }, expectedCompletion: { lt: new Date() } } }),
      this.prisma.serviceRequest.count({ where: { companyId, status: 'COMPLETED', updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'REPAIR' } }),
    ]);

    const [expiringAMCs, expiringWarranties] = await Promise.all([
      this.prisma.aMCAgreement.count({ where: { companyId, status: 'ACTIVE', endDate: { lte: new Date(Date.now() + 30 * 86400000) } } }),
      this.prisma.assetProfile.count({ where: { companyId, warrantyEnd: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() } } }),
    ]);

    return { pendingSR, inProgressWO, overdueWO, todayService, assetsUnderRepair, expiringAMCs, expiringWarranties };
  }

  static async getPurchaseDashboard(filter: DashboardFilter) {
    const { companyId } = filter;
    const [pendingPO, pendingGRN, totalVendors] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { companyId, status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] } } }),
      this.prisma.goodsReceipt.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.vendor.count({ where: { companyId, isActive: true } }),
    ]);
    return { pendingPO, pendingGRN, totalVendors };
  }

  static async getKPIs(filter: DashboardFilter) {
    const { companyId } = filter;
    const fy = filter.financialYearId || await this.getCurrentFY(companyId);

    const [totalStock, totalAssets, repairCount, damagedCount, totalMaintenance] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({ where: { companyId, financialYearId: fy }, _sum: { quantityIn: true, quantityOut: true } }),
      this.prisma.assetProfile.count({ where: { companyId } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'REPAIR' } }),
      this.prisma.assetProfile.count({ where: { companyId, status: 'DAMAGED' } }),
      this.prisma.maintenanceHistory.aggregate({ where: { companyId }, _sum: { totalCost: true } }),
    ]);

    const totalIn = Number(totalStock._sum.quantityIn || 0);
    const totalOut = Number(totalStock._sum.quantityOut || 0);
    const availableStock = totalIn - totalOut;

    return {
      stockAvailability: totalIn > 0 ? Math.round((availableStock / totalIn) * 100) : 100,
      assetUtilization: totalAssets > 0 ? Math.round(((totalAssets - repairCount - damagedCount) / totalAssets) * 100) : 100,
      repairPercent: totalAssets > 0 ? Math.round((repairCount / totalAssets) * 100) : 0,
      damagePercent: totalAssets > 0 ? Math.round((damagedCount / totalAssets) * 100) : 0,
      totalMaintenanceCost: Number(totalMaintenance._sum.totalCost || 0),
    };
  }

  static async getMonthlyTrend(companyId: number, months: number = 12) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Batch: single groupBy query instead of 3N individual count queries
    const headers = await this.prisma.transactionHeader.groupBy({
      by: ['voucherType', 'transactionDate'],
      where: { companyId, voucherType: { in: ['RC', 'IC', 'TC'] }, transactionDate: { gte: startDate } },
      _count: true,
    });

    // Group by month + type
    const byMonth = new Map<string, { receipts: number; issues: number; transfers: number }>();
    for (const entry of headers) {
      const d = new Date(entry.transactionDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = byMonth.get(key) || { receipts: 0, issues: 0, transfers: 0 };
      if (entry.voucherType === 'RC') existing.receipts += entry._count;
      else if (entry.voucherType === 'IC') existing.issues += entry._count;
      else if (entry.voucherType === 'TC') existing.transfers += entry._count;
      byMonth.set(key, existing);
    }

    const results: Array<{ month: string; receipts: number; issues: number; transfers: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${start.getFullYear()}-${start.getMonth()}`;
      const data = byMonth.get(key) || { receipts: 0, issues: 0, transfers: 0 };
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      results.push({ month: `${monthNames[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`, ...data });
    }
    return results;
  }

  static async getLowStockItems(companyId: number, storeId?: number) {
    const items = await this.prisma.item.findMany({ where: { isActive: true }, include: { category: true, unit: true } });
    if (items.length === 0) return [];

    // Batch: single groupBy query instead of N individual aggregate queries
    const balances = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId, ...(storeId ? { storeId } : {}) },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const balanceMap = new Map(balances.map((b) => [
      b.itemId,
      Number(b._sum.quantityIn || 0) - Number(b._sum.quantityOut || 0),
    ]));

    const lowStock: any[] = [];
    for (const item of items) {
      const qty = balanceMap.get(item.id) || 0;
      if (qty <= Number(item.minimumStockLevel)) {
        lowStock.push({ ...item, currentStock: qty, minStock: Number(item.minimumStockLevel) });
      }
    }
    return lowStock;
  }

  static async getOutOfStockItems(companyId: number) {
    const items = await this.prisma.item.findMany({ where: { isActive: true } });
    if (items.length === 0) return [];

    // Batch: single groupBy query instead of N individual aggregate queries
    const balances = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const balanceMap = new Map(balances.map((b) => [
      b.itemId,
      Number(b._sum.quantityIn || 0) - Number(b._sum.quantityOut || 0),
    ]));

    const outOfStock: any[] = [];
    for (const item of items) {
      const qty = balanceMap.get(item.id) || 0;
      if (qty <= 0) outOfStock.push({ ...item, currentStock: qty });
    }
    return outOfStock;
  }

  static async getTopProblematicAssets(companyId: number, limit: number = 5) {
    return this.prisma.assetProfile.findMany({ where: { companyId }, orderBy: { repairCount: 'desc' }, take: limit });
  }

  static async getEngineerWorkload(companyId: number) {
    const workOrders = await this.prisma.workOrder.findMany({
      where: { companyId, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
      select: { engineerName: true },
    });
    const workload: Record<string, number> = {};
    for (const wo of workOrders) {
      if (wo.engineerName) workload[wo.engineerName] = (workload[wo.engineerName] || 0) + 1;
    }
    return Object.entries(workload).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  static async getDepartmentConsumption(companyId: number, financialYearId?: number) {
    const fy = financialYearId || await this.getCurrentFY(companyId);
    const departments = await this.prisma.department.findMany({ where: { companyId } });
    if (departments.length === 0) return [];

    // Batch: fetch all stores in one query, build dept→storeIds map
    const allStores = await this.prisma.store.findMany({ where: { companyId }, select: { id: true, departmentId: true } });
    const deptStoreMap = new Map<number, number[]>();
    for (const store of allStores) {
      if (!store.departmentId) continue;
      const ids = deptStoreMap.get(store.departmentId) || [];
      ids.push(store.id);
      deptStoreMap.set(store.departmentId, ids);
    }

    // Batch: single groupBy on all store IDs instead of N individual aggregate queries
    const allStoreIds = [...new Set(allStores.map((s) => s.id))];
    const consumptionByStore = allStoreIds.length > 0
      ? await this.prisma.ledgerEntry.groupBy({
          by: ['storeId'],
          where: { companyId, financialYearId: fy, storeId: { in: allStoreIds } },
          _sum: { quantityOut: true },
        })
      : [];
    const storeConsumptionMap = new Map(consumptionByStore.map((c) => [c.storeId, Number(c._sum.quantityOut || 0)]));

    // Aggregate by department
    const result = departments.map((dept) => {
      const storeIds = deptStoreMap.get(dept.id) || [];
      const consumed = storeIds.reduce((sum, sid) => sum + (storeConsumptionMap.get(sid) || 0), 0);
      return { department: dept.name, consumed };
    });

    return result.sort((a, b) => b.consumed - a.consumed);
  }
}
