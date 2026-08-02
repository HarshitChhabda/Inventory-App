import { PrismaClient, Prisma } from '@prisma/client';
import { validateSufficientStock, getLatestBalance, recalculateBalancesAfterInsert } from './stockValidation.service';

export class StockAdjustmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * FIX #2: Balance check + write are now atomic inside $transaction.
   * FIX #4: Passes departmentId/locationId to validation for scoped stock checks.
   * FIX #3: Calls recalculateBalancesAfterInsert for backdated adjustments.
   */
  async create(data: {
    companyId: number; financialYearId: number; date: Date;
    itemId: number; adjustmentType: string; quantity: number;
    departmentId?: number; locationId?: number;
    reason: string; adjustedBy: string; approvedBy?: string; remarks?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const isIncrease = data.adjustmentType === 'INCREASE';
      const departmentId = data.departmentId || null;
      const locationId = data.locationId || null;

      if (!isIncrease) {
        const validation = await validateSufficientStock(tx, data.companyId, data.financialYearId, data.itemId, departmentId, locationId, data.quantity);
        if (!validation.sufficient) {
          throw new Error(`Insufficient stock for adjustment. Available: ${validation.available}, Decrease: ${data.quantity}`);
        }
      }

      const prevBalance = await getLatestBalance(tx, data.companyId, data.financialYearId, data.itemId, departmentId, locationId);
      const newBalance = isIncrease ? prevBalance + data.quantity : prevBalance - data.quantity;

      const adjustment = await tx.stockAdjustment.create({
        data: {
          companyId: data.companyId, financialYearId: data.financialYearId, date: data.date,
          itemId: data.itemId, adjustmentType: data.adjustmentType, quantity: data.quantity,
          reason: data.reason, adjustedBy: data.adjustedBy, approvedBy: data.approvedBy, remarks: data.remarks,
        },
      });

      await tx.stockTransaction.create({
        data: {
          companyId: data.companyId, financialYearId: data.financialYearId, itemId: data.itemId,
          departmentId,
          locationId,
          transactionType: isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          transactionDate: data.date,
          quantityIn: isIncrease ? data.quantity : new Prisma.Decimal(0),
          quantityOut: isIncrease ? new Prisma.Decimal(0) : data.quantity,
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'StockAdjustment', referenceId: adjustment.id,
          referenceNo: `ADJ-${adjustment.id}`,
          remarks: `Adjustment: ${data.reason}`, createdBy: data.adjustedBy,
        },
      });

      await recalculateBalancesAfterInsert(tx, data.companyId, data.financialYearId, data.itemId, departmentId, locationId, data.date);

      await tx.auditLog.create({
        data: {
          companyId: data.companyId, action: 'CREATE', tableName: 'StockAdjustment',
          recordId: adjustment.id, recordUuid: adjustment.uuid,
          description: `Stock adjustment: ${data.adjustmentType} ${data.quantity} of item ${data.itemId}`,
          oldValues: JSON.stringify({ departmentId, locationId, prevBalance }),
          newValues: JSON.stringify({ ...data, newBalance }),
        },
      });

      return adjustment;
    });
  }

  async findAll(companyId: number, financialYearId: number, page = 1, pageSize = 50) {
    const where = { companyId, financialYearId };
    const [data, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({ where, include: { item: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { date: 'desc' } }),
      this.prisma.stockAdjustment.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
