import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { VoucherEngine, VoucherType } from './voucherEngine.service';
import { ApprovalEngine } from './approvalEngine.service';

export interface ConvertRequestInput {
  requisitionId: number;
  companyId: number;
  financialYearId: number;
  issuedById: number;
  issuedByName: string;
  postedById: string;
}

/**
 * RequestConversionService bridges Requisition → TransactionEngine
 *
 * Flow:
 * 1. Requisition approved → ConvertRequestInput
 * 2. Generate proper voucher number (IS-xxx, TC-xxx, etc.)
 * 3. Call TransactionEngine.createMovement()
 * 4. Update requisition detail issued quantities
 * 5. Link transactionHeader to requisition
 * 6. Update requisition status (COMPLETED or PARTIALLY_APPROVED)
 */
export class RequestConversionService {
  private transactionEngine: TransactionEngine;
  private voucherEngine: VoucherEngine;
  private approvalEngine: ApprovalEngine;

  constructor(private prisma: PrismaClient) {
    this.transactionEngine = new TransactionEngine(prisma);
    this.voucherEngine = new VoucherEngine(prisma);
    this.approvalEngine = new ApprovalEngine(prisma);
  }

  // ─── CONVERT APPROVED REQUEST → TRANSACTION ────

  async convertToTransaction(input: ConvertRequestInput) {
    const req = await this.prisma.requisitionHeader.findUnique({
      where: { id: input.requisitionId },
      include: {
        details: { include: { item: true } },
        company: true,
        financialYear: true,
        sourceStore: true,
        destStore: true,
        requestedBy: true,
      },
    });

    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'APPROVED' && req.status !== 'PARTIALLY_APPROVED') {
      throw new Error('Request must be approved before conversion');
    }

    // Only issue items that have approvedQty > issuedQty
    const issuableDetails = req.details.filter((d: any) => d.approvedQty > d.issuedQty);
    if (issuableDetails.length === 0) {
      throw new Error('No pending items to issue');
    }

    // Generate voucher number based on request type
    const voucherType = this.mapRequestTypeToVoucherType(req.requestType);
    const voucherNo = await this.voucherEngine.generateVoucherNo(
      input.companyId, input.financialYearId, voucherType
    );

    // Build transaction payload
    const fromStoreId = req.sourceStoreId || undefined;
    const toStoreId = req.destStoreId || undefined;

    const transactionPayload = {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo,
      voucherType,
      transactionDate: new Date(),
      fromStoreId,
      toStoreId,
      departmentId: req.departmentId || undefined,
      approvalStatus: 'APPROVED',
      approvedBy: req.requestedByName,
      approvedAt: new Date(),
      postedBy: input.postedById,
      postedAt: new Date(),
      referenceNo: req.requisitionNumber,
      purpose: req.remarks || `Against Requisition ${req.requisitionNumber}`,
      remarks: `Auto-generated from requisition ${req.requisitionNumber}`,
      createdBy: input.issuedByName,
    };

    // Build items for TransactionEngine
    const items = issuableDetails.map((d: any) => ({
      itemId: d.itemId,
      itemName: d.itemName,
      itemCode: d.itemCode || '',
      quantity: d.approvedQty - d.issuedQty,
      unitId: d.unitId,
      unitName: d.unitName,
      rate: 0, // will be resolved by TransactionEngine
      amount: 0,
      remarks: `Against Requisition ${req.requisitionNumber} — ${d.reason || ''}`,
    }));

    // Create transaction via TransactionEngine
    const transaction = await this.transactionEngine.createMovement({
      ...transactionPayload,
      items,
    });

    // Update requisition details with issued quantities
    const detailUpdates = issuableDetails.map((d: any) => ({
      detailId: d.id,
      issuedQty: d.approvedQty - d.issuedQty, // issue remaining
    }));

    await this.approvalEngine.updateIssuedQty(input.requisitionId, detailUpdates);

    // Link transaction to requisition
    await this.prisma.requisitionHeader.update({
      where: { id: input.requisitionId },
      data: {
        transactionHeaderId: transaction.transactionId,
        completedDate: new Date(),
      },
    });

    return {
      requisitionNumber: req.requisitionNumber,
      transactionVoucherNo: voucherNo,
      transactionId: transaction.transactionId,
      itemsIssued: issuableDetails.length,
      totalQty: issuableDetails.reduce((sum: number, d: any) => sum + (d.approvedQty - d.issuedQty), 0),
    };
  }

  // ─── AUTO-CONVERT (for requests without approval workflow) ────

  async autoConvert(input: ConvertRequestInput) {
    const req = await this.prisma.requisitionHeader.findUnique({
      where: { id: input.requisitionId },
    });
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'APPROVED') {
      throw new Error('Request must be approved');
    }
    return this.convertToTransaction(input);
  }

  // ─── MAP REQUEST TYPE → VOUCHER TYPE ──────────

  private mapRequestTypeToVoucherType(requestType: string): VoucherType {
    const map: Record<string, VoucherType> = {
      ISSUE: 'IS',
      TRANSFER: 'TC',
      INSTALLATION: 'IS',
      REPAIR: 'DM',
      REPLACEMENT: 'IS',
      DAMAGE: 'DM',
      ADJUSTMENT: 'AD',
      PURCHASE: 'RC',
      RETURN: 'VR',
      SCRAP: 'DM',
      FINANCIAL: 'AD',
    };
    return map[requestType] || 'IS';
  }

  // ─── BULK CONVERT ──────────────────────────────

  async bulkConvert(requisitionIds: number[], companyId: number, financialYearId: number, issuedById: number, issuedByName: string, postedById: string) {
    const results = [];
    for (const id of requisitionIds) {
      try {
        const result = await this.convertToTransaction({
          requisitionId: id,
          companyId,
          financialYearId,
          issuedById,
          issuedByName,
          postedById,
        });
        results.push({ requisitionId: id, success: true, ...result });
      } catch (err: any) {
        results.push({ requisitionId: id, success: false, error: err.message });
      }
    }
    return results;
  }

  // ─── CHECK STOCK BEFORE CONVERSION ─────────────

  async checkStockAvailability(requisitionId: number) {
    const req = await this.prisma.requisitionHeader.findUnique({
      where: { id: requisitionId },
      include: { details: true, sourceStore: true },
    });
    if (!req) throw new Error('Requisition not found');
    if (!req.sourceStoreId) return { available: true, items: [] };

    const items = [];
    for (const detail of req.details) {
      const pendingQty = detail.approvedQty - detail.issuedQty;
      if (pendingQty <= 0) continue;

      // Calculate current stock from ledger
      const stock = await this.prisma.ledgerEntry.aggregate({
        where: {
          itemId: detail.itemId,
          storeId: req.sourceStoreId,
        },
        _sum: { quantityIn: true, quantityOut: true },
      });

      const currentStock = Number(stock._sum.quantityIn || 0) - Number(stock._sum.quantityOut || 0);
      const isAvailable = currentStock >= pendingQty;

      items.push({
        itemId: detail.itemId,
        itemName: detail.itemName,
        requestedQty: pendingQty,
        currentStock,
        isAvailable,
        shortfall: isAvailable ? 0 : pendingQty - currentStock,
      });
    }

    return {
      available: items.every((i: any) => i.isAvailable),
      items,
    };
  }
}
