import { PrismaClient, Prisma } from '@prisma/client';
import { recalculateBalancesAfterInsert } from './stockValidation.service';

export class ReceiptChallanService {
  constructor(private prisma: PrismaClient) {}

  async generateChallanNo(companyId: number, financialYearId: number): Promise<string> {
    const sequence = await this.prisma.challanSequence.upsert({
      where: {
        companyId_financialYearId_challanType: {
          companyId,
          financialYearId,
          challanType: 'RC',
        },
      },
      update: { lastNumber: { increment: 1 } },
      create: { companyId, financialYearId, challanType: 'RC', lastNumber: 1 },
    });
    return `RC-${String(sequence.lastNumber).padStart(5, '0')}`;
  }

  async create(data: {
    companyId: number;
    financialYearId: number;
    date: Date;
    sourceType: string;
    vendorId?: number;
    sourceName?: string;
    invoiceNumber?: string;
    invoiceDate?: Date;
    vehicleNumber?: string;
    receivedBy: string;
    departmentId?: number;
    remarks?: string;
    items: Array<{ itemId: number; unitId: number; quantity: number; rate: number; remarks?: string }>;
  }) {
    const challanNo = await this.generateChallanNo(data.companyId, data.financialYearId);
    return this.prisma.receiptChallan.create({
      data: {
        challanNo,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        date: data.date,
        sourceType: data.sourceType,
        vendorId: data.vendorId || null,
        sourceName: data.sourceName,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        vehicleNumber: data.vehicleNumber,
        receivedBy: data.receivedBy,
        departmentId: data.departmentId || null,
        remarks: data.remarks,
        items: {
          create: data.items.map((item) => ({
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
            remarks: item.remarks,
          })),
        },
      },
      include: { vendor: true, items: { include: { item: true, unit: true } } },
    });
  }

  async update(id: number, data: any) {
    const existing = await this.prisma.receiptChallan.findUnique({ where: { id } });
    if (!existing) throw new Error('Receipt challan not found');
    if (existing.status !== 'Draft') throw new Error('Cannot edit a posted/cancelled challan');

    return this.prisma.receiptChallan.update({
      where: { id },
      data: {
        date: new Date(data.date),
        sourceType: data.sourceType,
        vendorId: data.vendorId || null,
        sourceName: data.sourceName,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        vehicleNumber: data.vehicleNumber,
        receivedBy: data.receivedBy,
        departmentId: data.departmentId || null,
        remarks: data.remarks,
        items: {
          deleteMany: {},
          create: data.items.map((item: any) => ({
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            rate: item.rate || 0,
            amount: (item.quantity || 0) * (item.rate || 0),
            remarks: item.remarks,
          })),
        },
      },
      include: { vendor: true, items: { include: { item: true, unit: true } } },
    });
  }

  async post(id: number, postedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // FIX #8: Atomic status check — read and update in same transaction
      const rc = await tx.receiptChallan.findUnique({
        where: { id },
        include: { items: true, company: true },
      });
      if (!rc) throw new Error('Receipt challan not found');
      if (rc.status !== 'Draft') throw new Error(`Challan is not in Draft status (current: ${rc.status})`);

      const lastEntries = await tx.$queryRaw<{ itemId: number; locationId: number | null; balanceQty: number }[]>`
        SELECT itemId, locationId, balanceQty FROM StockTransaction
        WHERE companyId = ${rc.companyId} AND financialYearId = ${rc.financialYearId}
        AND id = (
          SELECT se2.id FROM StockTransaction se2
          WHERE se2.itemId = StockTransaction.itemId
          AND ((se2.locationId = StockTransaction.locationId) OR (se2.locationId IS NULL AND StockTransaction.locationId IS NULL))
          AND se2.companyId = ${rc.companyId} AND se2.financialYearId = ${rc.financialYearId}
          ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1
        )
      `;

      const balanceMap = new Map<string, number>();
      for (const entry of lastEntries) {
        const key = `${entry.itemId}-${entry.locationId ?? 'null'}`;
        balanceMap.set(key, Number(entry.balanceQty));
      }

      const stockTransactions = rc.items.map((item) => {
        const key = `${item.itemId}-${(item as any).locationId ?? 'null'}`;
        const prevBalance = balanceMap.get(key) || 0;
        const newBalance = prevBalance + Number(item.quantity);
        balanceMap.set(key, newBalance);

        return {
          companyId: rc.companyId,
          financialYearId: rc.financialYearId,
          itemId: item.itemId,
          departmentId: rc.departmentId,
          locationId: (item as any).locationId || null,
          transactionType: 'PURCHASE',
          transactionDate: rc.date,
          quantityIn: item.quantity,
          quantityOut: new Prisma.Decimal(0),
          rate: item.rate,
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'ReceiptChallan',
          referenceId: id,
          referenceNo: rc.challanNo,
          condition: 'GOOD',
          remarks: `From ${rc.challanNo}`,
          createdBy: postedBy,
        };
      });

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // FIX #4: Recalculate balances if backdated
      for (const item of rc.items) {
        await recalculateBalancesAfterInsert(tx, rc.companyId, rc.financialYearId, item.itemId, rc.departmentId || null, (item as any).locationId || null, rc.date);
      }
      await tx.receiptChallan.update({
        where: { id },
        data: { status: 'Posted', postedAt: new Date(), postedBy },
      });
      await tx.auditLog.create({
        data: {
          companyId: rc.companyId,
          action: 'POST',
          tableName: 'ReceiptChallan',
          recordId: id,
          recordUuid: rc.uuid,
          description: `Receipt Challan ${rc.challanNo} posted with ${rc.items.length} items`,
          newValues: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
        },
      });

      return this.prisma.receiptChallan.findUnique({
        where: { id },
        include: { vendor: true, items: { include: { item: true, unit: true } } },
      });
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.receiptChallan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new Error('Receipt challan not found');
    if (existing.status === 'Posted') throw new Error('Cannot delete a posted challan. Use cancel instead to preserve audit trail.');
    if (existing.status === 'Cancelled') throw new Error('Cannot delete a cancelled challan');

    return this.prisma.$transaction(async (tx) => {
      await tx.receiptChallanItem.deleteMany({ where: { receiptChallanId: id } });
      await tx.receiptChallan.delete({ where: { id } });
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
      const rc = await tx.receiptChallan.findUnique({ where: { id }, include: { items: true } });
      if (!rc) throw new Error('Receipt challan not found');
      if (rc.status !== 'Posted') throw new Error(`Only posted challans can be cancelled (current status: ${rc.status})`);

      const reversalEntries: any[] = [];
      for (const item of rc.items) {
        const lastTxn = await tx.stockTransaction.findFirst({
          where: { referenceType: 'ReceiptChallan', referenceId: id, itemId: item.itemId },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        });
        const currentBalance = lastTxn ? Number(lastTxn.balanceQty) : 0;
        const reversalQty = Number(item.quantity);
        const newBalance = currentBalance - reversalQty;

        reversalEntries.push({
          companyId: rc.companyId,
          financialYearId: rc.financialYearId,
          itemId: item.itemId,
          departmentId: rc.departmentId,
          locationId: lastTxn?.locationId || null,
          transactionType: 'REVERSAL',
          transactionDate: new Date(),
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(reversalQty),
          rate: new Prisma.Decimal(item.rate),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'ReceiptChallan',
          referenceId: id,
          referenceNo: rc.challanNo,
          remarks: `Reversal for cancelled ${rc.challanNo}: ${cancelReason}`,
          createdBy: cancelledBy,
        });
      }

      if (reversalEntries.length > 0) {
        await tx.stockTransaction.createMany({ data: reversalEntries });
      }
      await tx.receiptChallan.update({
        where: { id },
        data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason },
      });
      await tx.auditLog.create({
        data: {
          companyId: rc.companyId,
          action: 'CANCEL',
          tableName: 'ReceiptChallan',
          recordId: id,
          recordUuid: rc.uuid,
          description: `Receipt Challan ${rc.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted' }),
          newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });

      return tx.receiptChallan.findUnique({ where: { id } });
    });
  }
}
