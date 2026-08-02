import { PrismaClient, Prisma } from '@prisma/client';
import { getLatestBalance, recalculateBalancesAfterInsert } from './stockValidation.service';

export class VendorReturnService {
  constructor(private prisma: PrismaClient) {}

  async generateChallanNo(companyId: number, financialYearId: number): Promise<string> {
    const sequence = await this.prisma.challanSequence.upsert({
      where: { companyId_financialYearId_challanType: { companyId, financialYearId, challanType: 'VRC' } },
      update: { lastNumber: { increment: 1 } },
      create: { companyId, financialYearId, challanType: 'VRC', lastNumber: 1 },
    });
    return `VRC-${String(sequence.lastNumber).padStart(5, '0')}`;
  }

  async create(data: {
    companyId: number; financialYearId: number; vendorId: number;
    originalReceiptId?: number; date: Date; reason: string;
    returnedBy: string; remarks?: string;
    items: Array<{ itemId: number; quantity: number; rate?: number; locationId?: number }>;
  }) {
    const challanNo = await this.generateChallanNo(data.companyId, data.financialYearId);
    return this.prisma.vendorReturnChallan.create({
      data: {
        challanNo, companyId: data.companyId, financialYearId: data.financialYearId,
        vendorId: data.vendorId, originalReceiptId: data.originalReceiptId || null,
        date: data.date, reason: data.reason, returnedBy: data.returnedBy, remarks: data.remarks,
        items: { create: data.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, rate: item.rate || 0 })) },
      },
      include: { vendor: true, items: { include: { item: true } } },
    });
  }

  /**
   * FIX #10: Vendor Return only allows DAMAGED condition stock.
   * Validates that the item has DAMAGED balance available before posting.
   * FIX #8: Idempotent — status check inside the same transaction.
   */
  async post(id: number, postedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // FIX #8: Atomic status check
      const vrc = await tx.vendorReturnChallan.findUnique({ where: { id }, include: { items: true, company: true } });
      if (!vrc) throw new Error('Vendor return challan not found');
      if (vrc.status !== 'Draft') throw new Error(`Challan is not in Draft status (current: ${vrc.status})`);

      // FIX #10: Validate that only DAMAGED stock is being returned
      // Get departmentId from original receipt (if linked)
      let sourceDepartmentId: number | null = null;
      if (vrc.originalReceiptId) {
        const originalReceipt = await tx.receiptChallan.findUnique({
          where: { id: vrc.originalReceiptId },
          select: { departmentId: true },
        });
        sourceDepartmentId = originalReceipt?.departmentId || null;
      }

      const damagedStockErrors: Array<{ itemName: string; requested: number; damagedAvailable: number; goodAvailable: number }> = [];
      for (const item of vrc.items) {
        const locationId = (item as any).locationId || null;

        // Check DAMAGED condition balance — with departmentId filter
        const damagedWhere: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'DAMAGED' };
        if (sourceDepartmentId) damagedWhere.departmentId = sourceDepartmentId;
        if (locationId) damagedWhere.locationId = locationId;
        const lastDamaged = await tx.stockTransaction.findFirst({
          where: damagedWhere,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const damagedAvailable = lastDamaged ? Number(lastDamaged.balanceQty) : 0;

        // Check GOOD condition balance for informational purposes
        const goodWhere: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'GOOD' };
        if (sourceDepartmentId) goodWhere.departmentId = sourceDepartmentId;
        if (locationId) goodWhere.locationId = locationId;
        const lastGood = await tx.stockTransaction.findFirst({
          where: goodWhere,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const goodAvailable = lastGood ? Number(lastGood.balanceQty) : 0;

        const requested = Number(item.quantity);
        if (requested > damagedAvailable) {
          const itemDetail = await tx.item.findUnique({ where: { id: item.itemId } });
          damagedStockErrors.push({
            itemName: itemDetail?.itemName || `Item #${item.itemId}`,
            requested,
            damagedAvailable,
            goodAvailable,
          });
        }
      }

      if (damagedStockErrors.length > 0) {
        throw new Error(
          `Vendor return only allows DAMAGED condition stock. ` +
          `Insufficient damaged stock: ${damagedStockErrors.map(e =>
            `${e.itemName}: requested ${e.requested}, damaged available ${e.damagedAvailable} (good available: ${e.goodAvailable})`
          ).join('; ')}`
        );
      }

      // Build stock transactions — deduct from DAMAGED condition
      const stockTransactions = vrc.items.map((item) => {
        const locationId = (item as any).locationId || null;
        return {
          companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId,
          departmentId: sourceDepartmentId || undefined,
          locationId,
          transactionType: 'VENDOR_RETURN', transactionDate: vrc.date,
          quantityIn: new Prisma.Decimal(0), quantityOut: item.quantity, rate: item.rate,
          balanceQty: new Prisma.Decimal(0), // Will be recalculated below
          condition: 'DAMAGED',
          referenceType: 'VendorReturnChallan', referenceId: id, referenceNo: vrc.challanNo,
          remarks: `Vendor return ${vrc.challanNo}: ${vrc.reason}`, createdBy: postedBy,
        };
      });

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // FIX #10: Recalculate balanceQty for each inserted transaction
      // Read them back and update with correct running balances
      for (const item of vrc.items) {
        const locationId = (item as any).locationId || null;
        const whereClause: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'DAMAGED' };
        if (sourceDepartmentId) whereClause.departmentId = sourceDepartmentId;
        if (locationId) whereClause.locationId = locationId;

        const allTxns = await tx.stockTransaction.findMany({
          where: whereClause,
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
          select: { id: true, quantityIn: true, quantityOut: true },
        });

        let runningBalance = 0;
        for (const txn of allTxns) {
          runningBalance += Number(txn.quantityIn) - Number(txn.quantityOut);
          await tx.stockTransaction.update({
            where: { id: txn.id },
            data: { balanceQty: new Prisma.Decimal(runningBalance) },
          });
        }
      }
      await tx.vendorReturnChallan.update({ where: { id }, data: { status: 'Posted', postedAt: new Date(), postedBy } });
      await tx.auditLog.create({
        data: {
          companyId: vrc.companyId, action: 'POST', tableName: 'VendorReturnChallan', recordId: id, recordUuid: vrc.uuid,
          description: `Vendor Return ${vrc.challanNo} posted with ${vrc.items.length} items (DAMAGED condition)`,
          newValues: JSON.stringify({ status: 'Posted', condition: 'DAMAGED' }),
        },
      });

      return tx.vendorReturnChallan.findUnique({ where: { id }, include: { vendor: true, items: { include: { item: true } } } });
    });
  }

  async cancel(id: number, cancelReason: string, cancelledBy: string) {
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const vrc = await tx.vendorReturnChallan.findUnique({ where: { id }, include: { items: true, company: true } });
      if (!vrc) throw new Error('Vendor return challan not found');
      if (vrc.status !== 'Posted') throw new Error(`Only posted challans can be cancelled (current status: ${vrc.status})`);

      let sourceDepartmentId: number | null = null;
      if (vrc.originalReceiptId) {
        const originalReceipt = await tx.receiptChallan.findUnique({
          where: { id: vrc.originalReceiptId },
          select: { departmentId: true },
        });
        sourceDepartmentId = originalReceipt?.departmentId || null;
      }

      // Reverse each item: add DAMAGED stock back
      for (const item of vrc.items) {
        const locationId = (item as any).locationId || null;
        const whereClause: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'DAMAGED' };
        if (sourceDepartmentId) whereClause.departmentId = sourceDepartmentId;
        if (locationId) whereClause.locationId = locationId;

        const lastDamaged = await tx.stockTransaction.findFirst({
          where: whereClause,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const currentBalance = lastDamaged ? Number(lastDamaged.balanceQty) : 0;
        const newBalance = currentBalance + Number(item.quantity);

        await tx.stockTransaction.create({
          data: {
            companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId,
            departmentId: sourceDepartmentId || undefined,
            locationId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(Number(item.quantity)),
            quantityOut: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newBalance),
            condition: 'DAMAGED',
            referenceType: 'VendorReturnChallan', referenceId: id, referenceNo: vrc.challanNo,
            remarks: `Reversal for cancelled ${vrc.challanNo} — DAMAGED stock restored: ${cancelReason}`,
            createdBy: cancelledBy,
          },
        });

        // Recalculate DAMAGED balances for this item+location
        const allTxns = await tx.stockTransaction.findMany({
          where: whereClause,
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
          select: { id: true, quantityIn: true, quantityOut: true },
        });
        let runningBalance = 0;
        for (const txn of allTxns) {
          runningBalance += Number(txn.quantityIn) - Number(txn.quantityOut);
          await tx.stockTransaction.update({
            where: { id: txn.id },
            data: { balanceQty: new Prisma.Decimal(runningBalance) },
          });
        }
      }

      await tx.vendorReturnChallan.update({ where: { id }, data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason } });
      await tx.auditLog.create({
        data: {
          companyId: vrc.companyId, action: 'CANCEL', tableName: 'VendorReturnChallan', recordId: id, recordUuid: vrc.uuid,
          description: `Vendor Return ${vrc.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted' }),
          newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });

      return tx.vendorReturnChallan.findUnique({ where: { id } });
    });
  }
}
