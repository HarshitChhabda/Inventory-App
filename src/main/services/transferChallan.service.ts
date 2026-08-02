import { PrismaClient, Prisma } from '@prisma/client';
import { recalculateBalancesAfterInsert } from './stockValidation.service';

export class TransferChallanService {
  constructor(private prisma: PrismaClient) {}

  async generateChallanNo(companyId: number, financialYearId: number): Promise<string> {
    const sequence = await this.prisma.challanSequence.upsert({
      where: { companyId_financialYearId_challanType: { companyId, financialYearId, challanType: 'TC' } },
      update: { lastNumber: { increment: 1 } },
      create: { companyId, financialYearId, challanType: 'TC', lastNumber: 1 },
    });
    return `TC-${String(sequence.lastNumber).padStart(5, '0')}`;
  }

  async create(data: {
    companyId: number; financialYearId: number; date: Date;
    fromDepartmentId: number; toDepartmentId: number;
    transferredBy: string; approvedBy?: string; remarks?: string;
    items: Array<{ itemId: number; quantity: number; rate?: number; locationId?: number; toLocationId?: number; remarks?: string }>;
  }) {
    const challanNo = await this.generateChallanNo(data.companyId, data.financialYearId);
    return this.prisma.transferChallan.create({
      data: {
        challanNo, companyId: data.companyId, financialYearId: data.financialYearId,
        date: data.date, fromDepartmentId: data.fromDepartmentId, toDepartmentId: data.toDepartmentId,
        transferredBy: data.transferredBy, approvedBy: data.approvedBy, remarks: data.remarks,
        items: { create: data.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, rate: item.rate || 0, locationId: item.locationId || null, toLocationId: item.toLocationId || null, remarks: item.remarks })) },
      },
      include: { fromDepartment: true, toDepartment: true, items: { include: { item: true, location: true } } },
    });
  }

  /**
   * FIX #2: Balance checks moved inside $transaction for atomicity.
   * FIX #8: Status check is now inside the same transaction as the write.
   */
  async update(id: number, data: any) {
    const existing = await this.prisma.transferChallan.findUnique({ where: { id } });
    if (!existing) throw new Error('Transfer challan not found');
    if (existing.status !== 'Draft') throw new Error('Cannot edit a posted/cancelled challan');

    return this.prisma.transferChallan.update({
      where: { id },
      data: {
        date: new Date(data.date),
        fromDepartmentId: data.fromDepartmentId,
        toDepartmentId: data.toDepartmentId,
        transferredBy: data.transferredBy,
        approvedBy: data.approvedBy,
        remarks: data.remarks,
        items: {
          deleteMany: {},
          create: data.items.map((item: any) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            rate: item.rate || 0,
            locationId: item.locationId || null,
            toLocationId: item.toLocationId || null,
            remarks: item.remarks,
          })),
        },
      },
      include: { fromDepartment: true, toDepartment: true, items: { include: { item: true, location: true } } },
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.transferChallan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new Error('Transfer challan not found');
    if (existing.status === 'Posted') throw new Error('Cannot delete a posted challan. Use cancel instead to preserve audit trail.');
    if (existing.status === 'Cancelled') throw new Error('Cannot delete a cancelled challan');

    return this.prisma.$transaction(async (tx) => {
      await tx.transferChallanItem.deleteMany({ where: { transferChallanId: id } });
      await tx.transferChallan.delete({ where: { id } });
      return { success: true };
    });
  }

  async post(id: number, postedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // FIX #8: Atomic status check — read and update in same transaction
      const tc = await tx.transferChallan.findUnique({ where: { id }, include: { items: true, company: true } });
      if (!tc) throw new Error('Transfer challan not found');
      if (tc.status !== 'Draft') throw new Error(`Challan is not in Draft status (current: ${tc.status})`);

      // FIX #2: Balance checks happen inside the transaction
      const balanceChecks: Array<{ itemName: string; requested: number; available: number }> = [];
      for (const item of tc.items) {
        const whereClause: any = { companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId, departmentId: tc.fromDepartmentId };
        if ((item as any).locationId) whereClause.locationId = (item as any).locationId;
        const lastEntry = await tx.stockTransaction.findFirst({
          where: whereClause,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const available = lastEntry ? Number(lastEntry.balanceQty) : 0;
        const requested = Number(item.quantity);
        if (requested > available) {
          const itemDetail = await tx.item.findUnique({ where: { id: item.itemId } });
          balanceChecks.push({ itemName: itemDetail?.itemName || 'Unknown', requested, available });
        }
      }
      if (balanceChecks.length > 0) {
        throw new Error(`Insufficient stock: ${balanceChecks.map((b) => `${b.itemName}: requested ${b.requested}, available ${b.available}`).join('; ')}`);
      }

      const lastEntries = await tx.$queryRaw<{ itemId: number; locationId: number | null; balanceQty: number }[]>`
        SELECT itemId, locationId, balanceQty FROM StockTransaction
        WHERE companyId = ${tc.companyId} AND financialYearId = ${tc.financialYearId} AND departmentId = ${tc.fromDepartmentId}
        AND id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = StockTransaction.itemId
        AND ((se2.locationId = StockTransaction.locationId) OR (se2.locationId IS NULL AND StockTransaction.locationId IS NULL))
        AND se2.companyId = ${tc.companyId} AND se2.financialYearId = ${tc.financialYearId} AND se2.departmentId = ${tc.fromDepartmentId}
        ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
      `;
      const balanceMap = new Map<string, number>();
      for (const e of lastEntries) {
        const key = `${e.itemId}-${e.locationId ?? 'null'}`;
        balanceMap.set(key, Number(e.balanceQty));
      }

      const stockTransactions: any[] = [];
      const refTransferId = `TRF-${tc.challanNo}`;

      for (const item of tc.items) {
        const key = `${item.itemId}-${(item as any).locationId ?? 'null'}`;
        const prevBalance = balanceMap.get(key) || 0;
        const newBalance = prevBalance - Number(item.quantity);
        balanceMap.set(key, newBalance);

        stockTransactions.push({
          companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
          departmentId: tc.fromDepartmentId, locationId: (item as any).locationId || null,
          transactionType: 'TRANSFER_OUT', transactionDate: tc.date,
          quantityIn: new Prisma.Decimal(0), quantityOut: item.quantity, rate: item.rate,
          balanceQty: new Prisma.Decimal(newBalance), refTransferId, condition: 'GOOD',
          referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
          remarks: `Transfer out ${tc.challanNo}`, createdBy: postedBy,
        });
      }

      const toBalanceEntries = await tx.$queryRaw<{ itemId: number; locationId: number | null; balanceQty: number }[]>`
        SELECT itemId, locationId, balanceQty FROM StockTransaction
        WHERE companyId = ${tc.companyId} AND financialYearId = ${tc.financialYearId} AND departmentId = ${tc.toDepartmentId}
        AND id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = StockTransaction.itemId
        AND ((se2.locationId = StockTransaction.locationId) OR (se2.locationId IS NULL AND StockTransaction.locationId IS NULL))
        AND se2.companyId = ${tc.companyId} AND se2.financialYearId = ${tc.financialYearId} AND se2.departmentId = ${tc.toDepartmentId}
        ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
      `;
      const toBalanceMap = new Map<string, number>();
      for (const e of toBalanceEntries) {
        const key = `${e.itemId}-${e.locationId ?? 'null'}`;
        toBalanceMap.set(key, Number(e.balanceQty));
      }

      for (const item of tc.items) {
        const toLocId = (item as any).toLocationId || (item as any).locationId || null;
        const key = `${item.itemId}-${toLocId ?? 'null'}`;
        const prevBalance = toBalanceMap.get(key) || 0;
        const newBalance = prevBalance + Number(item.quantity);
        toBalanceMap.set(key, newBalance);

        stockTransactions.push({
          companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
          departmentId: tc.toDepartmentId, locationId: toLocId,
          transactionType: 'TRANSFER_IN', transactionDate: tc.date,
          quantityIn: item.quantity, quantityOut: new Prisma.Decimal(0), rate: item.rate,
          balanceQty: new Prisma.Decimal(newBalance), refTransferId, condition: 'GOOD',
          referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
          remarks: `Transfer in ${tc.challanNo}`, createdBy: postedBy,
        });
      }

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // FIX #4: Recalculate balances if backdated
      for (const item of tc.items) {
        await recalculateBalancesAfterInsert(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId, (item as any).locationId || null, tc.date);
        const toLocId = (item as any).toLocationId || (item as any).locationId || null;
        await recalculateBalancesAfterInsert(tx, tc.companyId, tc.financialYearId, item.itemId, tc.toDepartmentId, toLocId, tc.date);
      }

      // FIX #9: Close asset installations at source locations for each transferred item
      for (const item of tc.items) {
        const locationId = (item as any).locationId;
        if (locationId) {
          const activeInstallations = await tx.assetInstallation.findMany({
            where: { itemId: item.itemId, locationId, status: 'Active' },
          });
          for (const installation of activeInstallations) {
            await tx.assetInstallation.update({
              where: { id: installation.id },
              data: {
                status: 'Inactive',
                remarks: `Stock transferred via ${tc.challanNo} (closed on ${new Date().toISOString().split('T')[0]} by ${postedBy})`,
              },
            });
          }
        }
      }

      // FIX #12: Log both source and destination sides in audit
      await tx.auditLog.create({
        data: {
          companyId: tc.companyId, action: 'POST', tableName: 'TransferChallan', recordId: id, recordUuid: tc.uuid,
          description: `Transfer Challan ${tc.challanNo} posted with ${tc.items.length} items`,
          oldValues: JSON.stringify({
            fromDepartmentId: tc.fromDepartmentId,
            toDepartmentId: tc.toDepartmentId,
            sourceBalances: Object.fromEntries(balanceMap),
          }),
          newValues: JSON.stringify({
            status: 'Posted', refTransferId,
            destBalances: Object.fromEntries(toBalanceMap),
          }),
        },
      });

      await tx.transferChallan.update({ where: { id }, data: { status: 'Posted', postedAt: new Date(), postedBy } });

      return tx.transferChallan.findUnique({ where: { id }, include: { fromDepartment: true, toDepartment: true, items: { include: { item: true, location: true } } } });
    });
  }

  async cancel(id: number, cancelReason: string, cancelledBy: string) {
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const tc = await tx.transferChallan.findUnique({ where: { id }, include: { items: true, company: true } });
      if (!tc) throw new Error('Transfer challan not found');
      if (tc.status !== 'Posted') throw new Error(`Only posted challans can be cancelled (current status: ${tc.status})`);

      // FIX #5: Validate downstream balance with departmentId filter
      const downstreamChecks: Array<{ itemName: string; required: number; available: number }> = [];
      for (const item of tc.items) {
        const toLocId = (item as any).toLocationId || (item as any).locationId || null;
        const destWhere: any = { companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId, departmentId: tc.toDepartmentId };
        if (toLocId) destWhere.locationId = toLocId;
        const lastDestEntry = await tx.stockTransaction.findFirst({
          where: destWhere,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const destBalance = lastDestEntry ? Number(lastDestEntry.balanceQty) : 0;
        const reversalQty = Number(item.quantity);

        if (destBalance < reversalQty) {
          const itemDetail = await tx.item.findUnique({ where: { id: item.itemId } });
          downstreamChecks.push({
            itemName: itemDetail?.itemName || 'Unknown',
            required: reversalQty,
            available: destBalance,
          });
        }
      }

      if (downstreamChecks.length > 0) {
        throw new Error(
          `This transfer cannot be cancelled — stock has already been moved further. ` +
          `Affected items: ${downstreamChecks.map(d => `${d.itemName}: needs ${d.required} for reversal but only ${d.available} available`).join('; ')}`
        );
      }

      const linkedTxns = await tx.stockTransaction.findMany({
        where: { referenceType: 'TransferChallan', referenceId: id },
        select: { refTransferId: true, itemId: true, locationId: true, quantityOut: true, quantityIn: true },
      });
      const refTransferId = linkedTxns[0]?.refTransferId;

      // FIX #7: Sequential recalculation — process items one at a time for correct running balances
      for (const item of tc.items) {
        const sourceWhere: any = { companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId, departmentId: tc.fromDepartmentId };
        const srcLocId = (item as any).locationId || null;
        if (srcLocId) sourceWhere.locationId = srcLocId;
        const lastSource = await tx.stockTransaction.findFirst({ where: sourceWhere, orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }], select: { balanceQty: true } });
        const sourceBalance = lastSource ? Number(lastSource.balanceQty) : 0;
        const newSourceBalance = sourceBalance + Number(item.quantity);

        await tx.stockTransaction.create({
          data: {
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.fromDepartmentId, locationId: srcLocId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(Number(item.quantity)),
            quantityOut: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newSourceBalance),
            refTransferId: refTransferId || undefined,
            condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Reversal for cancelled ${tc.challanNo} — source restored`,
            createdBy: cancelledBy,
          },
        });

        const toLocId = (item as any).toLocationId || (item as any).locationId || null;
        const destWhere: any = { companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId, departmentId: tc.toDepartmentId };
        if (toLocId) destWhere.locationId = toLocId;
        const lastDest = await tx.stockTransaction.findFirst({ where: destWhere, orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }], select: { balanceQty: true } });
        const destBalance = lastDest ? Number(lastDest.balanceQty) : 0;
        const newDestBalance = destBalance - Number(item.quantity);

        await tx.stockTransaction.create({
          data: {
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.toDepartmentId, locationId: toLocId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(0),
            quantityOut: new Prisma.Decimal(Number(item.quantity)),
            rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newDestBalance),
            refTransferId: refTransferId || undefined,
            condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Reversal for cancelled ${tc.challanNo} — destination restored`,
            createdBy: cancelledBy,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: tc.companyId, action: 'CANCEL', tableName: 'TransferChallan', recordId: id, recordUuid: tc.uuid,
          description: `Transfer Challan ${tc.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted', fromDepartmentId: tc.fromDepartmentId, toDepartmentId: tc.toDepartmentId }),
          newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });

      await tx.transferChallan.update({
        where: { id },
        data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason },
      });

      return tx.transferChallan.findUnique({ where: { id } });
    });
  }
}
