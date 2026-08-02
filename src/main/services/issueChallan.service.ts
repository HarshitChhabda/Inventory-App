import { PrismaClient, Prisma } from '@prisma/client';
import { validateSufficientStock, getLatestBalance, recalculateBalancesAfterInsert, recalculateBalancesAfterDelete } from './stockValidation.service';

export class IssueChallanService {
  constructor(private prisma: PrismaClient) {}

  async generateChallanNo(companyId: number, financialYearId: number): Promise<string> {
    const sequence = await this.prisma.challanSequence.upsert({
      where: {
        companyId_financialYearId_challanType: {
          companyId,
          financialYearId,
          challanType: 'IC',
        },
      },
      update: { lastNumber: { increment: 1 } },
      create: { companyId, financialYearId, challanType: 'IC', lastNumber: 1 },
    });
    return `IC-${String(sequence.lastNumber).padStart(5, '0')}`;
  }

  async create(data: {
    companyId: number;
    financialYearId: number;
    departmentId: number;
    date: Date;
    issuedBy: string;
    approvedBy?: string;
    purpose?: string;
    remarks?: string;
    items: Array<{ itemId: number; unitId: number; quantity: number; locationId?: number; usedAt?: string; purpose?: string; remarks?: string }>;
  }) {
    const challanNo = await this.generateChallanNo(data.companyId, data.financialYearId);
    return this.prisma.issueChallan.create({
      data: {
        challanNo,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        departmentId: data.departmentId,
        date: data.date,
        issuedBy: data.issuedBy,
        approvedBy: data.approvedBy,
        purpose: data.purpose,
        remarks: data.remarks,
        items: {
          create: data.items.map((item) => ({
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            locationId: item.locationId || null,
            usedAt: item.usedAt,
            purpose: item.purpose,
            remarks: item.remarks,
          })),
        },
      },
      include: { department: true, items: { include: { item: true, unit: true, location: true } } },
    });
  }

  async update(id: number, data: any) {
    const existing = await this.prisma.issueChallan.findUnique({ where: { id } });
    if (!existing) throw new Error('Issue challan not found');
    if (existing.status !== 'Draft') throw new Error('Cannot edit a posted/cancelled challan');

    return this.prisma.issueChallan.update({
      where: { id },
      data: {
        departmentId: data.departmentId,
        date: new Date(data.date),
        issuedBy: data.issuedBy,
        approvedBy: data.approvedBy,
        purpose: data.purpose,
        remarks: data.remarks,
        items: {
          deleteMany: {},
          create: data.items.map((item: any) => ({
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            locationId: item.locationId || null,
            usedAt: item.usedAt,
            purpose: item.purpose,
            remarks: item.remarks,
          })),
        },
      },
      include: { department: true, items: { include: { item: true, unit: true, location: true } } },
    });
  }

  async post(id: number, postedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const ic = await tx.issueChallan.findUnique({
        where: { id },
        include: { items: true, company: true, department: true },
      });
      if (!ic) throw new Error('Issue challan not found');
      if (ic.status !== 'Draft') throw new Error(`Challan is not in Draft status (current: ${ic.status})`);

      if (!ic.sourceStoreId) {
        throw new Error('Issue challan must have a source store (sourceStoreId) for double-entry compliance');
      }

      const balanceChecks: Array<{ itemName: string; requested: number; available: number }> = [];
      const qtyPerItemLocation = new Map<string, number>();
      for (const item of ic.items) {
        const key = `${item.itemId}-${(item as any).locationId ?? 'null'}`;
        qtyPerItemLocation.set(key, (qtyPerItemLocation.get(key) || 0) + Number(item.quantity));
      }
      for (const [key, totalRequested] of qtyPerItemLocation) {
        const [itemIdStr, locIdStr] = key.split('-');
        const itemId = Number(itemIdStr);
        const locationId = locIdStr === 'null' ? null : Number(locIdStr);
        const validation = await validateSufficientStock(tx, ic.companyId, ic.financialYearId, itemId, ic.sourceStoreId, locationId, totalRequested);
        if (!validation.sufficient) {
          balanceChecks.push({ itemName: validation.itemName, requested: totalRequested, available: validation.available });
        }
      }
      if (balanceChecks.length > 0) {
        throw new Error(`Insufficient stock: ${balanceChecks.map((b) => `${b.itemName}: requested ${b.requested}, available ${b.available}`).join('; ')}`);
      }

      const lastEntries = await tx.$queryRaw<{ itemId: number; locationId: number | null; balanceQty: number }[]>`
        SELECT itemId, locationId, balanceQty FROM StockTransaction
        WHERE companyId = ${ic.companyId} AND financialYearId = ${ic.financialYearId} AND departmentId = ${ic.sourceStoreId}
        AND id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = StockTransaction.itemId
        AND ((se2.locationId = StockTransaction.locationId) OR (se2.locationId IS NULL AND StockTransaction.locationId IS NULL))
        AND se2.companyId = ${ic.companyId} AND se2.financialYearId = ${ic.financialYearId} AND se2.departmentId = ${ic.sourceStoreId}
        ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
      `;

      const balanceMap = new Map<string, number>();
      for (const entry of lastEntries) {
        const key = `${entry.itemId}-${entry.locationId ?? 'null'}`;
        balanceMap.set(key, Number(entry.balanceQty));
      }

      const stockTransactions: any[] = [];
      ic.items.forEach((item) => {
        const sourceKey = `${item.itemId}-${(item as any).locationId ?? 'null'}`;
        const prevBalance = balanceMap.get(sourceKey) || 0;
        const newBalance = prevBalance - Number(item.quantity);
        balanceMap.set(sourceKey, newBalance);
        const itemRate = Number((item as any).rate) || 0;

        stockTransactions.push({
          companyId: ic.companyId,
          financialYearId: ic.financialYearId,
          itemId: item.itemId,
          departmentId: ic.departmentId,
          locationId: item.locationId || null,
          transactionType: 'ISSUE',
          transactionDate: ic.date,
          quantityIn: item.quantity,
          quantityOut: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(itemRate),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'IssueChallan',
          referenceId: id,
          referenceNo: ic.challanNo,
          condition: 'GOOD',
          remarks: `From ${ic.challanNo}`,
          createdBy: postedBy,
        });

        stockTransactions.push({
          companyId: ic.companyId,
          financialYearId: ic.financialYearId,
          itemId: item.itemId,
          departmentId: ic.sourceStoreId,
          locationId: null,
          transactionType: 'ISSUE',
          transactionDate: ic.date,
          quantityIn: new Prisma.Decimal(0),
          quantityOut: item.quantity,
          rate: new Prisma.Decimal(itemRate),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'IssueChallan',
          referenceId: id,
          referenceNo: ic.challanNo,
          condition: 'GOOD',
          remarks: `From ${ic.challanNo} - Source Store`,
          createdBy: postedBy,
        });
      });

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // FIX #4: Recalculate balances if backdated — both source and destination departments
      for (const item of ic.items) {
        // Recalculate source department (stock deducted from here)
        await recalculateBalancesAfterInsert(tx, ic.companyId, ic.financialYearId, item.itemId, ic.sourceStoreId || null, null, ic.date);
        // Recalculate destination department (stock added here)
        await recalculateBalancesAfterInsert(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId, item.locationId || null, ic.date);
      }

      for (const item of ic.items) {
        if (item.locationId) {
          const existing = await tx.assetInstallation.findFirst({
            where: { itemId: item.itemId, locationId: item.locationId, status: 'Active' },
          });
          if (existing) {
            await tx.assetInstallation.update({ where: { id: existing.id }, data: { quantity: { increment: item.quantity } } });
          } else {
            await tx.assetInstallation.create({
              data: {
                itemId: item.itemId,
                locationId: item.locationId,
                issueChallanId: id,
                installedDate: ic.date,
                quantity: item.quantity,
                installedBy: postedBy,
                status: 'Active',
                remarks: item.usedAt || item.purpose,
              },
            });
          }
        }
      }

      await tx.issueChallan.update({ where: { id }, data: { status: 'Posted', postedAt: new Date(), postedBy } });
      await tx.auditLog.create({
        data: {
          companyId: ic.companyId,
          action: 'POST',
          tableName: 'IssueChallan',
          recordId: id,
          recordUuid: ic.uuid,
          description: `Issue Challan ${ic.challanNo} posted to ${ic.department.name} with ${ic.items.length} items`,
          newValues: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
        },
      });

      return this.prisma.issueChallan.findUnique({
        where: { id },
        include: { department: true, items: { include: { item: true, unit: true, location: true } } },
      });
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.issueChallan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new Error('Issue challan not found');
    if (existing.status === 'Posted') throw new Error('Cannot delete a posted challan. Use cancel instead to preserve audit trail.');
    if (existing.status === 'Cancelled') throw new Error('Cannot delete a cancelled challan');

    return this.prisma.$transaction(async (tx) => {
      await tx.issueChallanItem.deleteMany({ where: { issueChallanId: id } });
      await tx.issueChallan.delete({ where: { id } });
      return { success: true };
    });
  }

  async cancel(id: number, cancelReason: string, cancelledBy: string) {
    // FIX #14: Require cancel reason
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      // FIX #8: Atomic status check inside transaction
      const ic = await tx.issueChallan.findUnique({ where: { id }, include: { items: true } });
      if (!ic) throw new Error('Issue challan not found');
      if (ic.status !== 'Posted') throw new Error(`Only posted challans can be cancelled (current status: ${ic.status})`);

      const reversalEntries: any[] = [];
      for (const item of ic.items) {
        // Get current balance at destination (to reverse the ISSUE_IN)
        const lastTxn = await tx.stockTransaction.findFirst({
          where: { referenceType: 'IssueChallan', referenceId: id, itemId: item.itemId, departmentId: ic.departmentId },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        });
        const destBalance = lastTxn ? Number(lastTxn.balanceQty) : 0;
        const reversalQty = Number(item.quantity);

        // Reversal 1: Remove stock from DESTINATION (undo the ISSUE quantityIn)
        reversalEntries.push({
          companyId: ic.companyId,
          financialYearId: ic.financialYearId,
          itemId: item.itemId,
          departmentId: ic.departmentId,
          locationId: lastTxn?.locationId || item.locationId,
          transactionType: 'REVERSAL',
          transactionDate: new Date(),
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(reversalQty),
          rate: new Prisma.Decimal(0),
          balanceQty: new Prisma.Decimal(destBalance - reversalQty),
          referenceType: 'IssueChallan',
          referenceId: id,
          referenceNo: ic.challanNo,
          remarks: `Reversal for cancelled ${ic.challanNo} — destination: ${cancelReason}`,
          createdBy: cancelledBy,
        });

        // Reversal 2: Add stock back to SOURCE (undo the ISSUE quantityOut)
        const sourceBalance = await tx.stockTransaction.findFirst({
          where: { companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId, departmentId: ic.sourceStoreId },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const srcBal = sourceBalance ? Number(sourceBalance.balanceQty) : 0;

        reversalEntries.push({
          companyId: ic.companyId,
          financialYearId: ic.financialYearId,
          itemId: item.itemId,
          departmentId: ic.sourceStoreId,
          locationId: null,
          transactionType: 'REVERSAL',
          transactionDate: new Date(),
          quantityIn: new Prisma.Decimal(reversalQty),
          quantityOut: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(0),
          balanceQty: new Prisma.Decimal(srcBal + reversalQty),
          referenceType: 'IssueChallan',
          referenceId: id,
          referenceNo: ic.challanNo,
          remarks: `Reversal for cancelled ${ic.challanNo} — source restored: ${cancelReason}`,
          createdBy: cancelledBy,
        });

        // FIX #9: Deactivate any asset installations created by this issue
        const installations = await tx.assetInstallation.findMany({
          where: { issueChallanId: id, itemId: item.itemId, status: 'Active' },
        });
        for (const inst of installations) {
          await tx.assetInstallation.update({
            where: { id: inst.id },
            data: {
              status: 'Inactive',
              remarks: `Issue challan ${ic.challanNo} cancelled (closed on ${new Date().toISOString().split('T')[0]} by ${cancelledBy})`,
            },
          });
        }
      }

      if (reversalEntries.length > 0) {
        await tx.stockTransaction.createMany({ data: reversalEntries });
      }
      await tx.issueChallan.update({ where: { id }, data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason } });
      await tx.auditLog.create({
        data: {
          companyId: ic.companyId,
          action: 'CANCEL',
          tableName: 'IssueChallan',
          recordId: id,
          recordUuid: ic.uuid,
          description: `Issue Challan ${ic.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted' }),
          newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });
    });
    return this.prisma.issueChallan.findUnique({ where: { id } });
  }
}
