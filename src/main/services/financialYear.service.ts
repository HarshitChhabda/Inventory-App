import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import { BackupService } from './backup.service';
import type { CreateTransactionInput } from '../../shared/types';

export class FinancialYearService {
  private txEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.txEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  async create(data: { companyId: number; label: string; startDate: Date; endDate: Date }) {
    const existing = await this.prisma.financialYear.findUnique({
      where: { companyId_label: { companyId: data.companyId, label: data.label } },
    });
    if (existing) throw new Error(`Financial year "${data.label}" already exists for this company`);

    const overlap = await this.prisma.financialYear.findFirst({
      where: {
        companyId: data.companyId,
        startDate: { lte: data.endDate },
        endDate: { gte: data.startDate },
      },
    });
    if (overlap) {
      throw new Error(`Financial year ${overlap.label} already exists for this company and overlaps with the requested period`);
    }

    return this.prisma.financialYear.create({
      data: { companyId: data.companyId, label: data.label, startDate: data.startDate, endDate: data.endDate },
    });
  }

  async findAll(companyId: number) {
    return this.prisma.financialYear.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { transactions: true, requisitions: true, purchaseOrders: true } } },
    });
  }

  async findById(id: number) {
    return this.prisma.financialYear.findUnique({
      where: { id },
      include: {
        company: true,
        _count: { select: { transactions: true, requisitions: true, purchaseOrders: true, goodsReceipts: true, workOrders: true } },
      },
    });
  }

  async update(id: number, data: { label?: string; startDate?: Date; endDate?: Date }) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot edit closed financial year');
    return this.prisma.financialYear.update({ where: { id }, data });
  }

  async validateClosing(fyId: number): Promise<{ canClose: boolean; issues: string[] }> {
    const fy = await this.prisma.financialYear.findUnique({ where: { id: fyId } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) return { canClose: false, issues: ['Financial year is already closed'] };
    const issues: string[] = [];
    const [draftTxCount, pendingRequisitions, pendingPOs, pendingGRNs, pendingWorkOrders] = await Promise.all([
      this.prisma.transactionHeader.count({ where: { financialYearId: fyId, approvalStatus: 'DRAFT' } }),
      this.prisma.requisitionHeader.count({ where: { financialYearId: fyId, status: { in: ['DRAFT', 'SUBMITTED', 'PARTIALLY_APPROVED'] } } }),
      this.prisma.purchaseOrder.count({ where: { financialYearId: fyId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } } }),
      this.prisma.goodsReceipt.count({ where: { financialYearId: fyId, status: 'RECEIVED' } }),
      this.prisma.workOrder.count({ where: { financialYearId: fyId, status: { in: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS'] } } }),
    ]);
    if (draftTxCount > 0) issues.push(`${draftTxCount} draft transaction(s) must be approved or cancelled`);
    if (pendingRequisitions > 0) issues.push(`${pendingRequisitions} pending requisition(s) must be resolved`);
    if (pendingPOs > 0) issues.push(`${pendingPOs} pending purchase order(s) must be completed or cancelled`);
    if (pendingGRNs > 0) issues.push(`${pendingGRNs} pending GRN(s) must be processed`);
    if (pendingWorkOrders > 0) issues.push(`${pendingWorkOrders} pending work order(s) must be completed`);
    const negativeStock = await this.prisma.$queryRaw`
      SELECT COUNT(*) as cnt FROM (
        SELECT itemId, storeId, CAST(SUM(quantityIn) - SUM(quantityOut) AS TEXT) as balance
        FROM LedgerEntry WHERE companyId = ${fy.companyId} AND financialYearId = ${fyId}
        GROUP BY itemId, storeId HAVING balance < 0
      )
    ` as any[];
    if (negativeStock[0]?.cnt > 0) issues.push(`${negativeStock[0].cnt} item(s) have negative stock — must resolve before closing`);
    return { canClose: issues.length === 0, issues };
  }

  async getClosingSummary(fyId: number) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id: fyId } });
    if (!fy) throw new Error('Financial year not found');
    const closingBalances = await this.stockEngine.getCarryForwardBalances(fy.companyId, fyId);
    const [totalReceipts, totalIssues, totalTransfers, totalAdjustments, totalDamage] = await Promise.all([
      this.prisma.transactionHeader.aggregate({
        where: { financialYearId: fyId, voucherType: 'RC', approvalStatus: 'APPROVED' },
        _count: { id: true },
      }),
      this.prisma.transactionHeader.aggregate({
        where: { financialYearId: fyId, voucherType: 'IS', approvalStatus: 'APPROVED' },
        _count: { id: true },
      }),
      this.prisma.transactionHeader.aggregate({
        where: { financialYearId: fyId, voucherType: 'TC', approvalStatus: 'APPROVED' },
        _count: { id: true },
      }),
      this.prisma.transactionHeader.aggregate({
        where: { financialYearId: fyId, voucherType: 'AD', approvalStatus: 'APPROVED' },
        _count: { id: true },
      }),
      this.prisma.transactionHeader.aggregate({
        where: { financialYearId: fyId, voucherType: 'DM', approvalStatus: 'APPROVED' },
        _count: { id: true },
      }),
    ]);
    return {
      fy,
      closingBalances,
      totalReceipts: totalReceipts._count.id,
      totalIssues: totalIssues._count.id,
      totalTransfers: totalTransfers._count.id,
      totalAdjustments: totalAdjustments._count.id,
      totalDamage: totalDamage._count.id,
      totalItems: closingBalances.length,
    };
  }

  async closeFinancialYear(id: number, userId?: number) {
    const validation = await this.validateClosing(id);
    if (!validation.canClose) {
      throw new Error(`Cannot close: ${validation.issues.join('; ')}`);
    }
    const fy = await this.prisma.financialYear.findUnique({ where: { id }, include: { company: true } });
    if (!fy) throw new Error('Financial year not found');

    // Create backup before closing FY
    try {
      const backupService = new BackupService();
      await backupService.createPreUpgradeBackup(`pre-fy-close-${fy.label}`);
    } catch (e: any) {
      // Log warning but don't block FY close
      console.warn(`Warning: Could not create pre-close backup: ${e.message}`);
    }

    const nextFyLabel = this.getNextFyLabel(fy.label);
    const nextStartDate = new Date(fy.endDate);
    nextStartDate.setDate(nextStartDate.getDate() + 1);
    const nextEndDate = new Date(nextStartDate);
    nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
    nextEndDate.setDate(nextEndDate.getDate() - 1);
    const closingBalances = await this.stockEngine.getCarryForwardBalances(fy.companyId, id);
    const closingStockJson = JSON.stringify(closingBalances.map((b) => ({
      itemId: b.itemId, storeId: b.storeId, quantity: b.totalQty,
    })));
    const nextFy = await this.prisma.financialYear.upsert({
      where: { companyId_label: { companyId: fy.companyId, label: nextFyLabel } },
      update: {},
      create: { companyId: fy.companyId, label: nextFyLabel, startDate: nextStartDate, endDate: nextEndDate },
    });
    for (const balance of closingBalances) {
      if (balance.totalQty <= 0) continue;
      const txInput: CreateTransactionInput = {
        companyId: fy.companyId,
        financialYearId: nextFy.id,
        voucherType: 'CF',
        transactionDate: nextStartDate,
        toStoreId: balance.storeId,
        purpose: `Opening balance carried forward from ${fy.label}`,
        remarks: `Auto-generated carry forward from FY ${fy.label}`,
        createdBy: 'System',
        items: [{
          itemId: balance.itemId,
          quantity: balance.totalQty,
          condition: 'GOOD',
          remarks: `Opening balance from ${fy.label}`,
        }],
      };
      await this.txEngine.createTransaction(txInput);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.financialYear.update({
        where: { id },
        data: {
          isClosed: true,
          closedAt: new Date(),
          closedBy: userId,
          closingStockJson,
          totalReceipts: await tx.transactionHeader.count({ where: { financialYearId: id, voucherType: 'RC', approvalStatus: 'APPROVED' } }),
          totalIssues: await tx.transactionHeader.count({ where: { financialYearId: id, voucherType: 'IS', approvalStatus: 'APPROVED' } }),
          totalTransfers: await tx.transactionHeader.count({ where: { financialYearId: id, voucherType: 'TC', approvalStatus: 'APPROVED' } }),
          totalAdjustments: await tx.transactionHeader.count({ where: { financialYearId: id, voucherType: 'AD', approvalStatus: 'APPROVED' } }),
          totalDamage: await tx.transactionHeader.count({ where: { financialYearId: id, voucherType: 'DM', approvalStatus: 'APPROVED' } }),
          totalConsumption: await tx.materialConsumption.count({ where: { financialYearId: id, status: 'POSTED' } }),
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: fy.companyId, userId: userId || undefined, action: 'FY_CLOSING',
          tableName: 'FinancialYear', recordId: id, recordUuid: fy.uuid,
          description: `Financial year ${fy.label} closed. Opening balances created for ${nextFyLabel}.`,
          newValues: JSON.stringify({ isClosed: true, closedAt: new Date(), nextFy: nextFyLabel }),
        },
      });
    });
    return nextFy;
  }

  async reopenFinancialYear(id: number, userId: number) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id }, include: { company: true } });
    if (!fy) throw new Error('Financial year not found');
    if (!fy.isClosed) throw new Error('Financial year is not closed');
    const nextFyLabel = this.getNextFyLabel(fy.label);
    const nextFy = await this.prisma.financialYear.findUnique({
      where: { companyId_label: { companyId: fy.companyId, label: nextFyLabel } },
    });
    if (nextFy && nextFy.isClosed) {
      throw new Error('Cannot reopen: next financial year is already closed');
    }

    // Delete carry-forward entries from next FY to prevent double-counting
    let deletedCfCount = 0;
    if (nextFy) {
      const cfHeaders = await this.prisma.transactionHeader.findMany({
        where: { financialYearId: nextFy.id, voucherType: 'CF' },
        select: { id: true },
      });
      if (cfHeaders.length > 0) {
        const cfHeaderIds = cfHeaders.map((h) => h.id);
        deletedCfCount = cfHeaderIds.length;
        await this.prisma.$transaction(async (tx) => {
          await tx.ledgerEntry.deleteMany({ where: { transactionId: { in: cfHeaderIds } } });
          await tx.transactionDetail.deleteMany({ where: { transactionId: { in: cfHeaderIds } } });
          await tx.transactionHeader.deleteMany({ where: { id: { in: cfHeaderIds } } });
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.financialYear.update({
        where: { id },
        data: { isClosed: false, closedAt: null, closedBy: null, closingStockJson: null },
      });
      await tx.auditLog.create({
        data: {
          companyId: fy.companyId, userId, action: 'FY_REOPEN',
          tableName: 'FinancialYear', recordId: id, recordUuid: fy.uuid,
          description: `Financial year ${fy.label} reopened${deletedCfCount > 0 ? `. Removed ${deletedCfCount} carry-forward transaction(s) from next FY.` : ''}`,
          oldValues: JSON.stringify({ isClosed: true, closedAt: fy.closedAt }),
          newValues: JSON.stringify({ isClosed: false, closedAt: null, deletedCfTransactions: deletedCfCount }),
        },
      });
    });
    return fy;
  }

  async importOpeningBalance(data: {
    companyId: number;
    financialYearId: number;
    items: Array<{ itemId: number; storeId: number; quantity: number; unitCost?: number; condition?: string }>;
    userId?: number;
  }) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id: data.financialYearId } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot import opening balance to closed financial year');
    const results: Array<{ itemId: number; storeId: number; status: string; voucherNumber?: string; error?: string }> = [];
    for (const item of data.items) {
      try {
        // Check for duplicate opening balance
        const existingOb = await this.prisma.ledgerEntry.findFirst({
          where: {
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            itemId: item.itemId,
            storeId: item.storeId,
            movementType: 'OPENING_BALANCE',
          },
        });
        if (existingOb) {
          results.push({
            itemId: item.itemId,
            storeId: item.storeId,
            status: 'SKIPPED',
            error: `Opening balance already exists for this item at this store`,
          });
          continue;
        }

        const txInput: CreateTransactionInput = {
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          voucherType: 'OB',
          transactionDate: fy.startDate,
          toStoreId: item.storeId,
          purpose: `Opening balance import for ${fy.label}`,
          remarks: `Manual opening balance import`,
          createdBy: 'System',
          items: [{
            itemId: item.itemId,
            quantity: item.quantity,
            condition: (item.condition as any) || 'GOOD',
            rate: item.unitCost,
            remarks: 'Opening balance',
          }],
        };
        const tx = await this.txEngine.createTransaction(txInput);
        results.push({ itemId: item.itemId, storeId: item.storeId, status: 'SUCCESS', voucherNumber: tx.voucherNo });
      } catch (err: any) {
        results.push({ itemId: item.itemId, storeId: item.storeId, status: 'FAILED', error: err.message });
      }
    }
    return results;
  }

  async carryForward(companyId: number, fromFyId: number, userId?: number) {
    const fromFy = await this.prisma.financialYear.findUnique({ where: { id: fromFyId } });
    if (!fromFy) throw new Error('Source financial year not found');
    if (!fromFy.isClosed) throw new Error('Source financial year must be closed before carry forward');
    return this.closeFinancialYear(fromFyId, userId);
  }

  async getVoucherSequences(fyId: number) {
    return this.prisma.voucherSequence.findMany({ where: { financialYearId: fyId }, orderBy: { voucherType: 'asc' } });
  }

  async archive(id: number, userId?: number) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id }, include: { company: true } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot archive a closed financial year. Reopen it first.');
    const deps = await this.getDeletionDependencyInfo(id);
    if (deps.hasEffectiveData) {
      throw new Error(deps.blockReason);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.financialYear.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          companyId: fy.companyId, userId: userId || undefined, action: 'DELETE',
          tableName: 'FinancialYear', recordId: id, recordUuid: fy.uuid,
          description: `Deleted empty financial year ${fy.label}`,
        },
      });
    });
    return { success: true };
  }

  async deleteDuplicate(id: number, userId?: number) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id }, include: { company: true } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot delete a closed financial year. Reopen it first.');
    const deps = await this.getDeletionDependencyInfo(id);
    if (deps.hasEffectiveData) {
      throw new Error(deps.blockReason);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.voucherSequence.deleteMany({ where: { financialYearId: id } });
      await tx.financialYear.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          companyId: fy.companyId, userId: userId || undefined, action: 'DELETE',
          tableName: 'FinancialYear', recordId: id, recordUuid: fy.uuid,
          description: `Deleted financial year ${fy.label}`,
        },
      });
    });
    return { success: true };
  }

  async permanentDelete(id: number, userId?: number) {
    const fy = await this.prisma.financialYear.findUnique({ where: { id }, include: { company: true } });
    if (!fy) throw new Error('Financial year not found');

    const deps = await this.getFullDeletionDependencyInfo(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { financialYearId: id } });

      const txHeaders = await tx.transactionHeader.findMany({
        where: { financialYearId: id },
        select: { id: true },
      });
      const txIds = txHeaders.map(h => h.id);

      if (txIds.length > 0) {
        await tx.transactionDetail.deleteMany({ where: { transactionId: { in: txIds } } });
      }

      await tx.transactionHeader.deleteMany({ where: { financialYearId: id } });
      await tx.requisitionHeader.deleteMany({ where: { financialYearId: id } });
      await tx.purchaseOrder.deleteMany({ where: { financialYearId: id } });
      await tx.goodsReceipt.deleteMany({ where: { financialYearId: id } });
      await tx.workOrder.deleteMany({ where: { financialYearId: id } });
      await tx.serviceRequest.deleteMany({ where: { financialYearId: id } });
      await tx.workCompletionVerification.deleteMany({ where: { financialYearId: id } });
      await tx.voucherSequence.deleteMany({ where: { financialYearId: id } });
      await tx.importHistory.deleteMany({ where: { financialYearId: id } });
      await tx.financialYear.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          companyId: fy.companyId,
          userId: userId || undefined,
          action: 'DELETE',
          tableName: 'FinancialYear',
          recordId: id,
          recordUuid: fy.uuid,
          description: `Permanently deleted financial year ${fy.label} and all associated data (${deps.totalTransactions} transactions, ${deps.ledgerEntries} ledger entries, ${deps.requisitions} requisitions, ${deps.purchaseOrders} purchase orders)`,
        },
      });
    });

    return { success: true, deletedFy: fy.label };
  }

  async getFullDeletionDependencyInfo(id: number) {
    const [totalTx, postedTx, draftTx, cancelledTx, reversedTx, ledgerCount, requisitionCount, poCount, grnCount, workOrderCount, serviceRequestCount, completionCount, voucherSeqCount, importHistCount] = await Promise.all([
      this.prisma.transactionHeader.count({ where: { financialYearId: id } }),
      this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'POSTED' } }),
      this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'DRAFT' } }),
      this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'CANCELLED' } }),
      this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'REVERSED' } }),
      this.prisma.ledgerEntry.count({ where: { financialYearId: id } }),
      this.prisma.requisitionHeader.count({ where: { financialYearId: id } }),
      this.prisma.purchaseOrder.count({ where: { financialYearId: id } }),
      this.prisma.goodsReceipt.count({ where: { financialYearId: id } }),
      this.prisma.workOrder.count({ where: { financialYearId: id } }),
      this.prisma.serviceRequest.count({ where: { financialYearId: id } }),
      this.prisma.workCompletionVerification.count({ where: { financialYearId: id } }),
      this.prisma.voucherSequence.count({ where: { financialYearId: id } }),
      this.prisma.importHistory.count({ where: { financialYearId: id } }),
    ]);

    return {
      totalTransactions: totalTx,
      postedTransactions: postedTx,
      draftTransactions: draftTx,
      cancelledTransactions: cancelledTx,
      reversedTransactions: reversedTx,
      ledgerEntries: ledgerCount,
      requisitions: requisitionCount,
      purchaseOrders: poCount,
      goodsReceipts: grnCount,
      workOrders: workOrderCount,
      serviceRequests: serviceRequestCount,
      completions: completionCount,
      voucherSequences: voucherSeqCount,
      importHistories: importHistCount,
    };
  }

  async getDeletionDependencyInfo(id: number) {
    const totalTx = await this.prisma.transactionHeader.count({ where: { financialYearId: id } });
    const postedTx = await this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'POSTED' } });
    const draftTx = await this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'DRAFT' } });
    const cancelledTx = await this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'CANCELLED' } });
    const reversedTx = await this.prisma.transactionHeader.count({ where: { financialYearId: id, approvalStatus: 'REVERSED' } });
    const ledgerCount = await this.prisma.ledgerEntry.count({ where: { financialYearId: id } });
    const requisitionCount = await this.prisma.requisitionHeader.count({ where: { financialYearId: id } });
    const poCount = await this.prisma.purchaseOrder.count({ where: { financialYearId: id } });

    const effectiveTx = postedTx + draftTx;
    const hasEffectiveData = effectiveTx > 0 || ledgerCount > 0 || requisitionCount > 0 || poCount > 0;

    let blockReason = '';
    if (hasEffectiveData) {
      const reasons: string[] = [];
      if (postedTx > 0) reasons.push(`${postedTx} posted transaction${postedTx !== 1 ? 's' : ''}`);
      if (draftTx > 0) reasons.push(`${draftTx} draft transaction${draftTx !== 1 ? 's' : ''}`);
      if (ledgerCount > 0) reasons.push(`${ledgerCount} ledger entr${ledgerCount !== 1 ? 'ies' : 'y'}`);
      if (requisitionCount > 0) reasons.push(`${requisitionCount} requisition${requisitionCount !== 1 ? 's' : ''}`);
      if (poCount > 0) reasons.push(`${poCount} purchase order${poCount !== 1 ? 's' : ''}`);
      blockReason = `Financial year cannot be deleted because it contains: ${reasons.join(', ')}. Cancelled transactions and their reversals are retained for audit history.`;
    }

    return {
      totalTransactions: totalTx,
      postedTransactions: postedTx,
      draftTransactions: draftTx,
      cancelledTransactions: cancelledTx,
      reversedTransactions: reversedTx,
      ledgerEntries: ledgerCount,
      requisitions: requisitionCount,
      purchaseOrders: poCount,
      effectiveTransactions: effectiveTx,
      hasEffectiveData,
      canDelete: !hasEffectiveData,
      blockReason,
    };
  }

  private getNextFyLabel(currentLabel: string): string {
    const match = currentLabel.match(/(\d{4})-?(\d{2,4})/);
    if (!match) throw new Error('Invalid FY label format');
    const startYear = parseInt(match[1]);
    const nextStartYear = startYear + 1;
    const nextEndStr = String(nextStartYear + 1).slice(-2);
    return `${nextStartYear}-${nextEndStr}`;
  }
}
