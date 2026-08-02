import { PrismaClient, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async getReceiptRegister(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, vendorId?: number) {
    const where: any = { companyId, financialYearId, status: 'Posted' };
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };
    if (vendorId) where.vendorId = vendorId;
    return this.prisma.receiptChallan.findMany({ where, include: { vendor: true, items: { include: { item: true, unit: true } } }, orderBy: { date: 'asc' } });
  }

  async getIssueRegister(companyId: number, financialYearId: number, startDate?: Date, endDate?: Date, departmentId?: number) {
    const where: any = { companyId, financialYearId, status: 'Posted' };
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.issueChallan.findMany({ where, include: { department: true, items: { include: { item: true, unit: true, location: true } } }, orderBy: { date: 'asc' } });
  }

  async getCurrentStockReport(companyId: number, financialYearId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT i.id, i.itemCode, i.itemName, c.name as categoryName, u.name as unitName,
        i.minimumStockLevel, COALESCE(lastSE.balanceQty, 0) as currentStock
      FROM Item i
      INNER JOIN ItemCategory c ON c.id = i.categoryId
      INNER JOIN Unit u ON u.id = i.unitId
      LEFT JOIN (
        SELECT se.itemId, se.balanceQty FROM StockTransaction se
        WHERE se.companyId = ${companyId} AND se.financialYearId = ${financialYearId}
        AND se.id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = se.itemId AND se2.companyId = ${companyId} AND se2.financialYearId = ${financialYearId} ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
      ) lastSE ON lastSE.itemId = i.id
      WHERE i.isActive = 1 ORDER BY i.itemName ASC
    `;
  }

  async getLowStockReport(companyId: number, financialYearId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT i.id, i.itemCode, i.itemName, c.name as categoryName, u.name as unitName,
        i.minimumStockLevel, COALESCE(lastSE.balanceQty, 0) as currentStock
      FROM Item i
      INNER JOIN ItemCategory c ON c.id = i.categoryId
      INNER JOIN Unit u ON u.id = i.unitId
      LEFT JOIN (
        SELECT se.itemId, se.balanceQty FROM StockTransaction se
        WHERE se.companyId = ${companyId} AND se.financialYearId = ${financialYearId}
        AND se.id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = se.itemId AND se2.companyId = ${companyId} AND se2.financialYearId = ${financialYearId} ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
      ) lastSE ON lastSE.itemId = i.id
      WHERE i.isActive = 1 AND COALESCE(lastSE.balanceQty, 0) < i.minimumStockLevel
      ORDER BY i.itemName ASC
    `;
  }

  async getDeadStockReport(companyId: number, financialYearId: number, months = 6) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    return this.prisma.$queryRaw<any[]>`
      SELECT i.id, i.itemCode, i.itemName, c.name as categoryName, u.name as unitName,
        COALESCE(lastSE.balanceQty, 0) as currentStock, MAX(se.transactionDate) as lastMovementDate
      FROM Item i
      INNER JOIN ItemCategory c ON c.id = i.categoryId
      INNER JOIN Unit u ON u.id = i.unitId
      LEFT JOIN StockTransaction se ON se.itemId = i.id AND se.companyId = ${companyId} AND se.financialYearId = ${financialYearId}
      LEFT JOIN (
        SELECT se2.itemId, se2.balanceQty FROM StockTransaction se2
        WHERE se2.companyId = ${companyId} AND se2.financialYearId = ${financialYearId}
        AND se2.id = (SELECT se3.id FROM StockTransaction se3 WHERE se3.itemId = se2.itemId AND se3.companyId = ${companyId} AND se3.financialYearId = ${financialYearId} ORDER BY se3.transactionDate DESC, se3.id DESC LIMIT 1)
      ) lastSE ON lastSE.itemId = i.id
      WHERE i.isActive = 1 AND COALESCE(lastSE.balanceQty, 0) > 0
      GROUP BY i.id, i.itemCode, i.itemName, c.name, u.name, lastSE.balanceQty
      HAVING MAX(se.transactionDate) < ${cutoffDate.toISOString()} OR MAX(se.transactionDate) IS NULL
      ORDER BY i.itemName ASC
    `;
  }

  async getDepartmentWiseStock(companyId: number, financialYearId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT d.name as departmentName, i.itemName, i.itemCode, u.name as unitName,
        SUM(se.quantityIn) as totalIn, SUM(se.quantityOut) as totalOut,
        (SUM(se.quantityIn) - SUM(se.quantityOut)) as balance
      FROM StockTransaction se
      INNER JOIN Department d ON d.id = se.departmentId
      INNER JOIN Item i ON i.id = se.itemId
      INNER JOIN Unit u ON u.id = i.unitId
      WHERE se.companyId = ${companyId} AND se.financialYearId = ${financialYearId} AND se.departmentId IS NOT NULL
      GROUP BY d.name, i.itemName, i.itemCode, u.name HAVING balance > 0
      ORDER BY d.name, i.itemName
    `;
  }

  async getLocationWiseReport(companyId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT l.locationType, l.locationName, i.itemName, i.itemCode, u.name as unitName,
        ai.quantity, ai.installedDate, ai.status
      FROM AssetInstallation ai
      INNER JOIN Location l ON l.id = ai.locationId
      INNER JOIN Item i ON i.id = ai.itemId
      INNER JOIN Unit u ON u.id = i.unitId
      WHERE ai.status = 'Active'
      ORDER BY l.locationType, l.locationName, i.itemName
    `;
  }

  async getInstallationReport(companyId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT l.locationType, l.locationName, i.itemName, i.itemCode, u.name as unitName,
        ai.quantity, ai.installedDate, ai.installedBy, ai.status
      FROM AssetInstallation ai
      INNER JOIN Location l ON l.id = ai.locationId
      INNER JOIN Item i ON i.id = ai.itemId
      INNER JOIN Unit u ON u.id = i.unitId
      ORDER BY l.locationType, l.locationName, ai.installedDate DESC
    `;
  }

  async getDamageReport(companyId?: number, startDate?: Date, endDate?: Date, itemId?: number) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };
    if (itemId) where.itemId = itemId;
    return this.prisma.damageEntry.findMany({ where, include: { item: true, location: true }, orderBy: { date: 'desc' } });
  }

  async getVendorPurchaseReport(companyId: number, financialYearId: number, vendorId?: number) {
    const where: any = { companyId, financialYearId, status: 'Posted', sourceType: 'Vendor' };
    if (vendorId) where.vendorId = vendorId;
    return this.prisma.receiptChallan.findMany({ where, include: { vendor: true, items: { include: { item: true, unit: true } } }, orderBy: { date: 'asc' } });
  }

  async getAuditReport(companyId: number, startDate?: Date, endDate?: Date, userId?: number, action?: string) {
    const where: any = { companyId };
    if (startDate && endDate) where.createdAt = { gte: startDate, lte: endDate };
    if (userId) where.userId = userId;
    if (action) where.action = action;
    return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getConsumptionReport(companyId: number, financialYearId: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT strftime('%Y-%m', se.transactionDate) as month,
        i.itemName, i.itemCode, u.name as unitName, SUM(se.quantityOut) as consumed
      FROM StockTransaction se
      INNER JOIN Item i ON i.id = se.itemId
      INNER JOIN Unit u ON u.id = i.unitId
      WHERE se.companyId = ${companyId} AND se.financialYearId = ${financialYearId} AND se.transactionType = 'ISSUE'
      GROUP BY strftime('%Y-%m', se.transactionDate), i.itemName, i.itemCode, u.name
      ORDER BY month DESC, i.itemName ASC
    `;
  }

  async getMaterialMovementReport(companyId: number, financialYearId: number, itemId: number) {
    return this.prisma.stockTransaction.findMany({
      where: { companyId, financialYearId, itemId },
      include: { department: true, location: true },
      orderBy: { transactionDate: 'asc' },
    });
  }

  async getTransferRegister(companyId: number, financialYearId: number) {
    return this.prisma.transferChallan.findMany({
      where: { companyId, financialYearId, status: 'Posted' },
      include: { fromDepartment: true, toDepartment: true, items: { include: { item: true } } },
      orderBy: { date: 'asc' },
    });
  }

  async getVendorReturnRegister(companyId: number, financialYearId: number) {
    return this.prisma.vendorReturnChallan.findMany({
      where: { companyId, financialYearId, status: 'Posted' },
      include: { vendor: true, items: { include: { item: true } } },
      orderBy: { date: 'asc' },
    });
  }

  async getStockAdjustmentReport(companyId: number, financialYearId: number) {
    return this.prisma.stockAdjustment.findMany({
      where: { companyId, financialYearId },
      include: { item: true },
      orderBy: { date: 'asc' },
    });
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
