import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';

export interface ReportFilter {
  companyId: number;
  financialYearId?: number;
  storeId?: number;
  departmentId?: number;
  locationId?: number;
  itemId?: number;
  vendorId?: number;
  categoryId?: number;
  brandId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  voucherType?: string;
  status?: string;
}

export class ReportService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  // ─── STOCK REPORTS ────────────────────────────────

  static async getOverallStock(filter: ReportFilter) {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId: filter.companyId, financialYearId: filter.financialYearId },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const itemIds = grouped.map((g) => g.itemId);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
      include: { category: true, unit: true, brand: true },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));
    return grouped.map((g) => {
      const item = itemMap.get(g.itemId);
      return {
        itemId: g.itemId, itemCode: item?.itemCode, itemName: item?.itemName,
        category: (item as any)?.category?.name, brand: (item as any)?.brand?.name,
        unit: (item as any)?.unit?.name,
        quantityIn: Number(g._sum.quantityIn || 0), quantityOut: Number(g._sum.quantityOut || 0),
        balance: Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0),
      };
    });
  }

  static async getStoreWiseStock(filter: ReportFilter) {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['storeId', 'itemId'],
      where: { companyId: filter.companyId, financialYearId: filter.financialYearId },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const itemIds = [...new Set(grouped.map((g) => g.itemId))];
    const storeIds = [...new Set(grouped.map((g) => g.storeId))];
    const [items, stores] = await Promise.all([
      this.prisma.item.findMany({ where: { id: { in: itemIds } } }),
      this.prisma.store.findMany({ where: { id: { in: storeIds } } }),
    ]);
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const storeMap = new Map(stores.map((s) => [s.id, s]));
    return grouped.map((g) => {
      const item = itemMap.get(g.itemId);
      const store = storeMap.get(g.storeId);
      return {
        storeName: (store as any)?.name, itemCode: item?.itemCode, itemName: item?.itemName,
        quantityIn: Number(g._sum.quantityIn || 0), quantityOut: Number(g._sum.quantityOut || 0),
        balance: Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0),
      };
    });
  }

  static async getDepartmentWiseStock(filter: ReportFilter) {
    const stores = await this.prisma.store.findMany({ where: { companyId: filter.companyId, departmentId: { not: null } } });
    const storeIds = stores.map(s => s.id);
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['storeId', 'itemId'],
      where: { companyId: filter.companyId, financialYearId: filter.financialYearId, storeId: { in: storeIds } },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const results = [];
    // Batch: fetch all items and stores in 2 queries instead of 2N
    const itemIds = [...new Set(grouped.map((g) => g.itemId))];
    const storeIdSet = [...new Set(grouped.map((g) => g.storeId))];
    const [allItems, allStores] = await Promise.all([
      this.prisma.item.findMany({ where: { id: { in: itemIds } } }),
      this.prisma.store.findMany({ where: { id: { in: storeIdSet } }, include: { department: true } }),
    ]);
    const itemMap = new Map(allItems.map((i) => [i.id, i]));
    const storeMap = new Map(allStores.map((s) => [s.id, s]));

    for (const g of grouped) {
      const item = itemMap.get(g.itemId);
      const store = storeMap.get(g.storeId);
      results.push({
        department: (store as any)?.department?.name || '-',
        itemCode: item?.itemCode, itemName: item?.itemName,
        received: Number(g._sum.quantityIn || 0), issued: Number(g._sum.quantityOut || 0),
        balance: Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0),
      });
    }
    return results;
  }

  static async getItemWiseStock(filter: ReportFilter) {
    const where: any = { companyId: filter.companyId, financialYearId: filter.financialYearId };
    if (filter.itemId) where.itemId = filter.itemId;
    const grouped = await this.prisma.ledgerEntry.groupBy({ by: ['itemId', 'storeId'], where, _sum: { quantityIn: true, quantityOut: true } });
    const results = [];
    // Batch: fetch all items and stores in 2 queries instead of 2N
    const itemIds = [...new Set(grouped.map((g) => g.itemId))];
    const storeIdSet = [...new Set(grouped.map((g) => g.storeId))];
    const [items, stores] = await Promise.all([
      this.prisma.item.findMany({ where: { id: { in: itemIds } }, include: { category: true, unit: true } }),
      this.prisma.store.findMany({ where: { id: { in: storeIdSet } } }),
    ]);
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    for (const g of grouped) {
      const item = itemMap.get(g.itemId);
      const store = storeMap.get(g.storeId);
      results.push({
        itemCode: item?.itemCode, itemName: item?.itemName,
        category: (item as any)?.category?.name, unit: (item as any)?.unit?.name,
        store: (store as any)?.name,
        quantityIn: Number(g._sum.quantityIn || 0), quantityOut: Number(g._sum.quantityOut || 0),
        balance: Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0),
      });
    }
    return results;
  }

  static async getCategoryWiseStock(filter: ReportFilter) {
    const items = await this.prisma.item.findMany({ include: { category: true } });
    if (items.length === 0) return [];

    // Batch: single groupBy instead of N individual aggregate queries
    const balances = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId: filter.companyId, financialYearId: filter.financialYearId },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const balanceMap = new Map(balances.map((b) => [
      b.itemId,
      Number(b._sum.quantityIn || 0) - Number(b._sum.quantityOut || 0),
    ]));

    const categoryMap: Record<string, number> = {};
    for (const item of items) {
      const qty = balanceMap.get(item.id) || 0;
      const cat = (item as any).category?.name || 'Uncategorized';
      categoryMap[cat] = (categoryMap[cat] || 0) + qty;
    }
    return Object.entries(categoryMap).map(([category, quantity]) => ({ category, quantity }));
  }

  // ─── MOVEMENT REPORTS ─────────────────────────────

  static async getMovementReport(filter: ReportFilter, voucherType: string) {
    const where: any = { companyId: filter.companyId, voucherType, approvalStatus: 'POSTED' };
    if (filter.financialYearId) where.financialYearId = filter.financialYearId;
    if (filter.dateFrom || filter.dateTo) {
      where.transactionDate = {};
      if (filter.dateFrom) where.transactionDate.gte = filter.dateFrom;
      if (filter.dateTo) where.transactionDate.lte = filter.dateTo;
    }
    if (filter.storeId) where.fromStoreId = filter.storeId;
    return this.prisma.transactionHeader.findMany({
      where,
      include: { details: { include: { item: true } }, fromStore: true, toStore: true, vendor: true },
      orderBy: { transactionDate: 'desc' },
      take: filter.pageSize || 200,
      skip: filter.page ? (filter.page - 1) * (filter.pageSize || 200) : 0,
    });
  }

  static async getReceiptReport(filter: ReportFilter) { return this.getMovementReport(filter, 'RC'); }
  static async getIssueReport(filter: ReportFilter) { return this.getMovementReport(filter, 'IC'); }
  static async getTransferReport(filter: ReportFilter) { return this.getMovementReport(filter, 'TC'); }
  static async getInstallationReport(filter: ReportFilter) { return this.getMovementReport(filter, 'IN'); }
  static async getUninstallationReport(filter: ReportFilter) { return this.getMovementReport(filter, 'UN'); }
  static async getDamageReport(filter: ReportFilter) { return this.getMovementReport(filter, 'DM'); }
  static async getRepairReport(filter: ReportFilter) { return this.getMovementReport(filter, 'RP'); }
  static async getReplacementReport(filter: ReportFilter) { return this.getMovementReport(filter, 'RM'); }
  static async getReturnReport(filter: ReportFilter) { return this.getMovementReport(filter, 'RT'); }
  static async getAdjustmentReport(filter: ReportFilter) { return this.getMovementReport(filter, 'AD'); }

  // ─── LEDGER REPORTS ───────────────────────────────

  static async getLedgerReport(filter: ReportFilter) {
    const where: any = { companyId: filter.companyId };
    if (filter.financialYearId) where.financialYearId = filter.financialYearId;
    if (filter.itemId) where.itemId = filter.itemId;
    if (filter.storeId) where.storeId = filter.storeId;
    if (filter.locationId) where.locationId = filter.locationId;

    return this.prisma.ledgerEntry.findMany({
      where,
      include: {
        item: { include: { category: true, unit: true } },
        store: true,
        location: true,
        transaction: { select: { voucherNo: true, voucherType: true, transactionDate: true, remarks: true } },
      },
      orderBy: { transactionDate: 'asc' },
      take: filter.pageSize || 200,
      skip: filter.page ? (filter.page - 1) * (filter.pageSize || 200) : 0,
    });
  }

  static async getCompleteLedger(filter: ReportFilter) { return this.getLedgerReport(filter); }
  static async getItemLedger(filter: ReportFilter) { return this.getLedgerReport(filter); }
  static async getStoreLedger(filter: ReportFilter) { return this.getLedgerReport(filter); }
  static async getDepartmentLedger(filter: ReportFilter) { return this.getLedgerReport(filter); }

  // ─── ASSET REPORTS ────────────────────────────────

  static async getAssetRegister(filter: ReportFilter) {
    return this.prisma.assetProfile.findMany({
      where: { companyId: filter.companyId },
      include: { item: true, brand: true, vendor: true, currentStore: true, currentRoom: true, currentDepartment: true },
      orderBy: { assetCode: 'asc' },
    });
  }

  static async getInstalledAssets(filter: ReportFilter) {
    return this.prisma.assetProfile.findMany({
      where: { companyId: filter.companyId, status: 'INSTALLED' },
      include: { item: true, brand: true, currentRoom: true, currentDepartment: true },
      orderBy: { installationDate: 'desc' },
    });
  }

  static async getAssetHealthReport(filter: ReportFilter) {
    return this.prisma.assetProfile.findMany({
      where: { companyId: filter.companyId },
      select: { assetCode: true, assetName: true, healthScore: true, repairCount: true, totalRepairCost: true, status: true, condition: true },
      orderBy: { healthScore: 'asc' },
    });
  }

  static async getWarrantyExpiryReport(filter: ReportFilter) {
    return this.prisma.assetProfile.findMany({
      where: { companyId: filter.companyId, warrantyEnd: { not: null } },
      include: { item: true },
      orderBy: { warrantyEnd: 'asc' },
    });
  }

  static async getAMCExpiryReport(filter: ReportFilter) {
    return this.prisma.aMCAgreement.findMany({
      where: { companyId: filter.companyId, status: 'ACTIVE' },
      include: { asset: true },
      orderBy: { endDate: 'asc' },
    });
  }

  // ─── PURCHASE REPORTS ─────────────────────────────

  static async getPurchaseRegister(filter: ReportFilter) {
    const where: any = { companyId: filter.companyId };
    return this.prisma.purchaseOrder.findMany({
      where,
      include: { details: { include: { item: true } }, goodsReceipts: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getGRNRegister(filter: ReportFilter) {
    return this.prisma.goodsReceipt.findMany({
      where: { companyId: filter.companyId },
      include: { details: { include: { item: true } }, purchaseOrder: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getVendorPerformance(filter: ReportFilter) {
    const vendors = await this.prisma.vendor.findMany({ where: { companyId: filter.companyId, isActive: true } });
    const vendorIds = vendors.map((v) => v.id);
    const [poCounts, grnCounts] = await Promise.all([
      this.prisma.purchaseOrder.groupBy({ by: ['vendorId'], where: { vendorId: { in: vendorIds } }, _count: true }),
      this.prisma.goodsReceipt.groupBy({ by: ['vendorId'], where: { vendorId: { in: vendorIds }, status: 'COMPLETED' }, _count: true }),
    ]);
    const poMap = new Map(poCounts.map((c) => [c.vendorId, c._count]));
    const grnMap = new Map(grnCounts.map((c) => [c.vendorId, c._count]));
    return vendors.map((v) => ({
      vendorCode: v.vendorCode, vendorName: v.vendorName,
      totalPO: poMap.get(v.id) || 0, completedGRN: grnMap.get(v.id) || 0,
      avgRating: Number(v.vendorRating || 0),
    }));
  }

  // ─── MAINTENANCE REPORTS ──────────────────────────

  static async getServiceRegister(filter: ReportFilter) {
    const where: any = { companyId: filter.companyId };
    if (filter.dateFrom || filter.dateTo) {
      where.serviceDate = {};
      if (filter.dateFrom) where.serviceDate.gte = filter.dateFrom;
      if (filter.dateTo) where.serviceDate.lte = filter.dateTo;
    }
    return this.prisma.maintenanceHistory.findMany({ where, include: { asset: true }, orderBy: { serviceDate: 'desc' } });
  }

  static async getWorkOrderRegister(filter: ReportFilter) {
    return this.prisma.workOrder.findMany({
      where: { companyId: filter.companyId },
      include: { asset: true, costs: true, spareParts: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getDowntimeReport(filter: ReportFilter) {
    return this.prisma.breakdownHistory.findMany({
      where: { companyId: filter.companyId },
      include: { asset: true },
      orderBy: { breakdownDate: 'desc' },
    });
  }

  static async getRepairCostReport(filter: ReportFilter) {
    const grouped = await this.prisma.maintenanceHistory.groupBy({
      by: ['assetId'],
      where: { companyId: filter.companyId },
      _sum: { totalCost: true, labourCost: true, materialCost: true, vendorCost: true },
      _count: true,
    });
    const assetIds = grouped.map((g) => g.assetId);
    const assets = await this.prisma.assetProfile.findMany({ where: { id: { in: assetIds } } });
    const assetMap = new Map(assets.map((a) => [a.id, a]));
    return grouped.map((g) => {
      const asset = assetMap.get(g.assetId);
      return {
        assetCode: asset?.assetCode, assetName: asset?.assetName, repairCount: g._count,
        totalCost: Number(g._sum.totalCost || 0), labourCost: Number(g._sum.labourCost || 0),
        materialCost: Number(g._sum.materialCost || 0), vendorCost: Number(g._sum.vendorCost || 0),
      };
    }).sort((a: any, b: any) => b.totalCost - a.totalCost);
  }

  // ─── FINANCIAL REPORTS ────────────────────────────

  static async getInventoryValuation(filter: ReportFilter) {
    const items = await this.prisma.item.findMany({ include: { category: true } });
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where: { companyId: filter.companyId, financialYearId: filter.financialYearId },
      _sum: { quantityIn: true, quantityOut: true },
    });
    const balanceMap = new Map(grouped.map((g) => [
      g.itemId,
      { qtyIn: Number(g._sum.quantityIn || 0), qtyOut: Number(g._sum.quantityOut || 0) },
    ]));
    return items.map((item) => {
      const b = balanceMap.get(item.id) || { qtyIn: 0, qtyOut: 0 };
      const qty = b.qtyIn - b.qtyOut;
      return { itemCode: item.itemCode, itemName: item.itemName, category: item.category?.name, quantity: qty, avgRate: 0, value: 0 };
    });
  }

  // ─── AUDIT REPORTS ────────────────────────────────

  static async getImportHistory(filter: ReportFilter) {
    return this.prisma.importHistory.findMany({ where: { companyId: filter.companyId }, orderBy: { createdAt: 'desc' } });
  }

  static async getTransactionSummary(filter: ReportFilter) {
    const where: any = { companyId: filter.companyId };
    if (filter.financialYearId) where.financialYearId = filter.financialYearId;
    const grouped = await this.prisma.transactionHeader.groupBy({ by: ['voucherType'], where, _count: true });
    return grouped.map(g => ({ voucherType: g.voucherType, count: g._count }));
  }
}
