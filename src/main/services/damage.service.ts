import { PrismaClient, Prisma } from '@prisma/client';
import { validateSufficientStock, getLatestBalance, recalculateBalancesAfterInsert } from './stockValidation.service';

export class DamageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * FIX #2: Balance check is now inside $transaction (atomic).
   * FIX #9: Closes out asset installations at the damaged location.
   * FIX #6: Accepts financialYearId as parameter; validates it falls within the FY date range.
   */
  async create(data: {
    companyId?: number; itemId: number; departmentId?: number; locationId?: number;
    financialYearId?: number;
    assetInstallationId?: number; date: Date; quantity: number;
    reason: string; reportedBy: string; remarks?: string;
  }) {
    const item = await this.prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw new Error('Item not found');

    if (!data.companyId) throw new Error('Company ID is required for damage entry');
    const companyId = data.companyId;

    return this.prisma.$transaction(async (tx) => {
      let financialYearId = data.financialYearId;

      if (!financialYearId) {
        const matchingFY = await tx.financialYear.findFirst({
          where: {
            companyId,
            startDate: { lte: data.date },
            endDate: { gte: data.date },
            isClosed: false,
          },
        });
        if (!matchingFY) {
          throw new Error(`No open financial year found for date ${data.date.toISOString().split('T')[0]}`);
        }
        financialYearId = matchingFY.id;
      } else {
        const fy = await tx.financialYear.findUnique({ where: { id: financialYearId } });
        if (!fy) throw new Error(`Financial year #${financialYearId} not found`);
        if (data.date < fy.startDate || data.date > fy.endDate) {
          throw new Error(`Damage date ${data.date.toISOString().split('T')[0]} falls outside financial year "${fy.label}" (${fy.startDate.toISOString().split('T')[0]} to ${fy.endDate.toISOString().split('T')[0]})`);
        }
        if (fy.isClosed) {
          throw new Error(`Financial year "${fy.label}" is closed. Cannot create damage entries.`);
        }
      }

      const validation = await validateSufficientStock(tx, companyId, financialYearId, data.itemId, data.departmentId || null, data.locationId || null, data.quantity);
      if (!validation.sufficient) {
        throw new Error(`Insufficient stock for damage. Available: ${validation.available}, Damage: ${data.quantity}`);
      }

      const currentBalance = validation.available;
      const newBalance = currentBalance - data.quantity;

      let originalPurchaseDate: Date | undefined;
      let originalVendorName: string | undefined;
      let originalInvoiceNumber: string | undefined;
      let originalRate: Prisma.Decimal | undefined;

      const firstPurchase = await tx.stockTransaction.findFirst({
        where: { itemId: data.itemId, transactionType: 'PURCHASE' },
        orderBy: { transactionDate: 'asc' },
        select: { referenceId: true, referenceType: true, rate: true, transactionDate: true },
      });

      if (firstPurchase?.referenceType === 'ReceiptChallan' && firstPurchase.referenceId) {
        const rc = await tx.receiptChallan.findUnique({ where: { id: firstPurchase.referenceId }, include: { vendor: true } });
        if (rc) { originalPurchaseDate = rc.date; originalVendorName = rc.vendor?.name || rc.sourceName || undefined; originalInvoiceNumber = rc.invoiceNumber || undefined; }
      }
      originalRate = firstPurchase?.rate;

      const damageEntry = await tx.damageEntry.create({
        data: {
          companyId, itemId: data.itemId, locationId: data.locationId,
          assetInstallationId: data.assetInstallationId, date: data.date, quantity: data.quantity,
          reason: data.reason, reportedBy: data.reportedBy, remarks: data.remarks,
          originalPurchaseDate, originalVendorName, originalInvoiceNumber, originalRate,
          status: 'Posted',
        },
        include: { item: true, location: true },
      });

      await tx.stockTransaction.create({
        data: {
          companyId,
          financialYearId,
          itemId: data.itemId,
          departmentId: data.departmentId || undefined,
          locationId: data.locationId || undefined,
          transactionType: 'DAMAGE',
          transactionDate: data.date,
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(data.quantity),
          rate: originalRate || new Prisma.Decimal(0),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'DamageEntry',
          referenceId: damageEntry.id,
          referenceNo: `DMG-${damageEntry.id}`,
          condition: 'GOOD',
          remarks: `Damage: ${data.reason}`,
          createdBy: data.reportedBy,
        },
      });

      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, data.itemId, data.departmentId || null, data.locationId || null, data.date);

      if (data.locationId) {
        const activeInstallations = await tx.assetInstallation.findMany({
          where: { itemId: data.itemId, locationId: data.locationId, status: 'Active' },
        });
        for (const installation of activeInstallations) {
          await tx.assetInstallation.update({
            where: { id: installation.id },
            data: {
              status: 'Inactive',
              remarks: `Item damaged: ${data.reason} (closed on ${data.date.toISOString().split('T')[0]} by ${data.reportedBy})`,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId,
          action: 'CREATE',
          tableName: 'DamageEntry',
          recordId: damageEntry.id,
          recordUuid: damageEntry.uuid,
          description: `Damage entry created: ${data.quantity} x ${item.itemName} (${data.reason})`,
          oldValues: data.locationId ? JSON.stringify({ locationId: data.locationId, balance: currentBalance }) : undefined,
          newValues: JSON.stringify({ ...data, newBalance, financialYearId }),
        },
      });

      return damageEntry;
    });
  }

  async findAll(companyId?: number, page = 1, pageSize = 50, itemId?: number, startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (itemId) where.itemId = itemId;
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };
    const [data, total] = await Promise.all([
      this.prisma.damageEntry.findMany({ where, include: { item: true, location: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { date: 'desc' } }),
      this.prisma.damageEntry.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(id: number) {
    return this.prisma.damageEntry.findUnique({ where: { id }, include: { item: true, location: true } });
  }
}
