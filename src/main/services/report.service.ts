import { PrismaClient, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

type TransactionWhereInput = Prisma.TransactionHeaderWhereInput;

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  // ─── PARAMETERIZED REPORT GENERATOR ─────────────
  // Eliminates 6 near-duplicate report methods (receipt, issue, damage, transfer, vendorReturn, adjustment)

  /**
   * Generate a transaction report by voucher type.
   * Supports optional date range and entity-specific filters.
   */
  private async getTransactionReport(
    companyId: number,
    financialYearId: number,
    voucherType: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      vendorId?: number;
      fromStoreId?: number;
      toStoreId?: number;
      itemId?: number;
      orderBy?: 'asc' | 'desc';
    } = {},
  ) {
    const where: TransactionWhereInput = {
      companyId,
      financialYearId,
      voucherType,
      approvalStatus: 'POSTED',
    };
    if (options.startDate && options.endDate) {
      where.transactionDate = { gte: options.startDate, lte: options.endDate };
    }
    if (options.vendorId) where.vendorId = options.vendorId;
    if (options.fromStoreId) where.fromStoreId = options.fromStoreId;
    if (options.toStoreId) where.toStoreId = options.toStoreId;
    if (options.itemId) where.details = { some: { itemId: options.itemId } };

    return this.prisma.transactionHeader.findMany({
      where,
      include: {
        details: { include: { item: true } },
        vendor: true,
        fromStore: true,
        toStore: true,
      },
      orderBy: { transactionDate: options.orderBy || 'desc' },
    });
  }

  async getReceiptReport(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, vendorId?: number) {
    return this.getTransactionReport(companyId, financialYearId, 'RC', { startDate, endDate, vendorId });
  }

  async getIssueReport(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, fromStoreId?: number, toStoreId?: number) {
    return this.getTransactionReport(companyId, financialYearId, 'IC', { startDate, endDate, fromStoreId, toStoreId });
  }

  async getDamageReport(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, itemId?: number) {
    return this.getTransactionReport(companyId, financialYearId, 'DM', { startDate, endDate, itemId, orderBy: 'desc' });
  }

  async getTransferReport(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, fromStoreId?: number, toStoreId?: number) {
    return this.getTransactionReport(companyId, financialYearId, 'TC', { startDate, endDate, fromStoreId, toStoreId });
  }

  async getVendorReturnReport(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, vendorId?: number) {
    return this.getTransactionReport(companyId, financialYearId, 'VR', { startDate, endDate, vendorId });
  }

  async getStockAdjustmentReport(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date) {
    return this.getTransactionReport(companyId, financialYearId, 'AD', { startDate, endDate });
  }

  async getStockLedger(companyId: number, financialYearId: number, itemId?: number, storeId?: number) {
    const where: Prisma.LedgerEntryWhereInput = { companyId, financialYearId };
    if (itemId) where.itemId = itemId;
    if (storeId) where.storeId = storeId;
    return this.prisma.ledgerEntry.findMany({
      where,
      include: {
        item: { include: { category: true, unit: true } },
        store: true,
      },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async getStockSummary(companyId: number, financialYearId: number) {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId', 'storeId'],
      where: { companyId, financialYearId },
      _sum: { quantityIn: true, quantityOut: true },
      _count: true,
    });

    // Batch: fetch all items and stores in 2 queries instead of 2N
    const itemIds = [...new Set(grouped.map((g) => g.itemId))];
    const storeIds = [...new Set(grouped.map((g) => g.storeId))];
    const [items, stores] = await Promise.all([
      this.prisma.item.findMany({ where: { id: { in: itemIds } }, include: { category: true, unit: true } }),
      this.prisma.store.findMany({ where: { id: { in: storeIds } } }),
    ]);
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    return grouped.map((g) => ({
      ...g,
      item: itemMap.get(g.itemId) || null,
      store: storeMap.get(g.storeId) || null,
      balance: Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0),
    }));
  }

  async exportToExcel(data: any[], columns: Array<{ header: string; key: string; width?: number }>, filename: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    for (const row of data) worksheet.addRow(row);
    worksheet.eachRow((row) => { row.eachCell((cell) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; }); });
    const filePath = require('path').join(require('electron').app.getPath('userData'), 'InventoryData', 'exports', `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }
}
