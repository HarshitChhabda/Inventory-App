import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { VoucherEngine, VoucherType } from './voucherEngine.service';

const PO_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING', 'APPROVED', 'ORDERED', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['PARTIALLY_RECEIVED', 'COMPLETED', 'CLOSED'],
  PARTIALLY_RECEIVED: ['COMPLETED', 'CLOSED'],
  COMPLETED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};

export interface CreateGRNInput {
  companyId: number;
  financialYearId: number;
  poHeaderId?: number;
  vendorId: number;
  storeId: number;
  receiptDate?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  sourceType?: string;
  receivedBy?: string;
  remarks?: string;
  items: CreateGRNDetailInput[];
}

export interface CreateGRNDetailInput {
  itemId: number;
  itemName: string;
  itemCode?: string;
  poDetailId?: number;
  orderedQty?: number;
  receivedQty: number;
  unitId?: number;
  unitName?: string;
  rate: number;
  batchNumber?: string;
  serialNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  condition?: string;
  remarks?: string;
}

export interface QCInput {
  grnHeaderId: number;
  lineNumber: number;
  itemId: number;
  itemName: string;
  receivedQty: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  inspectorId?: number;
  inspectorName?: string;
  result: string;
  remarks?: string;
  defectType?: string;
  defectDescription?: string;
  actionTaken?: string;
}

export class GoodsReceiptService {
  private transactionEngine: TransactionEngine;
  private voucherEngine: VoucherEngine;

  constructor(private prisma: PrismaClient) {
    this.transactionEngine = new TransactionEngine(prisma);
    this.voucherEngine = new VoucherEngine(prisma);
  }

  async generateGRNNumber(companyId: number, financialYearId: number): Promise<string> {
    const fy = await this.prisma.financialYear.findUnique({ where: { id: financialYearId } });
    const fyLabel = fy?.label?.substring(2, 4) || '26';
    const count = await this.prisma.goodsReceipt.count({ where: { companyId, financialYearId } });
    return `GRN-${fyLabel}-${String(count + 1).padStart(6, '0')}`;
  }

  async createGRN(data: CreateGRNInput) {
    if (!data.items || data.items.length === 0) throw new Error('At least one item required');

    // Validate each item
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item.itemId) throw new Error(`Item ${i + 1}: itemId is required`);
      if (!item.itemName) throw new Error(`Item ${i + 1}: itemName is required`);
      if (!item.receivedQty || item.receivedQty <= 0) throw new Error(`Item ${i + 1}: receivedQty must be > 0`);
      if (item.rate === undefined || item.rate < 0) throw new Error(`Item ${i + 1}: rate must be >= 0`);
    }

    const grnNumber = await this.generateGRNNumber(data.companyId, data.financialYearId);

    // Validate vendor
    const vendor = await this.prisma.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor || !vendor.isActive) throw new Error('Vendor is inactive');

    // Validate store
    const store = await this.prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store || !store.isActive) throw new Error('Store is inactive');

    // Validate PO if linked
    if (data.poHeaderId) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: data.poHeaderId } });
      if (!po) throw new Error('PO not found');
      if (!['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw new Error('PO is not in receivable status');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const detailData = data.items.map((item, idx) => {
        const amount = item.receivedQty * item.rate;
        totalAmount += amount;
        return {
          lineNumber: idx + 1,
          itemId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          poDetailId: item.poDetailId,
          orderedQty: item.orderedQty,
          receivedQty: item.receivedQty,
          acceptedQty: 0, // will be set after QC
          rejectedQty: 0,
          damagedQty: item.condition === 'DAMAGED' ? item.receivedQty : 0,
          pendingQty: item.orderedQty ? item.orderedQty - item.receivedQty : 0,
          unitId: item.unitId,
          unitName: item.unitName,
          rate: item.rate,
          amount,
          batchNumber: item.batchNumber,
          serialNumber: item.serialNumber,
          manufacturingDate: item.manufacturingDate,
          expiryDate: item.expiryDate,
          condition: item.condition || 'GOOD',
          remarks: item.remarks,
        };
      });

      const grn = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          poHeaderId: data.poHeaderId,
          vendorId: data.vendorId,
          storeId: data.storeId,
          receiptDate: data.receiptDate ? new Date(data.receiptDate) : undefined,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
          invoiceNumber: data.invoiceNumber || undefined,
          sourceType: data.sourceType || undefined,
          totalAmount,
          status: 'RECEIVED',
          receivedBy: data.receivedBy,
          remarks: data.remarks,
        },
      });

      await tx.goodsReceiptDetail.createMany({
        data: detailData.map(d => ({ ...d, grnHeaderId: grn.id })),
      });

      return tx.goodsReceipt.findUnique({
        where: { id: grn.id },
        include: { details: true, vendor: true, store: true },
      });
    });
  }

  async getGRN(id: number) {
    return this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        details: { include: { item: true } },
        vendor: true,
        store: true,
        purchaseOrder: { include: { details: true } },
        qualityChecks: true,
      },
    });
  }

  async searchGRNs(filters: {
    companyId: number;
    status?: string;
    vendorId?: number;
    storeId?: number;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = { companyId: filters.companyId };
    if (filters.status) where.status = filters.status;
    if (filters.vendorId) where.vendorId = filters.vendorId;
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.dateFrom || filters.dateTo) {
      where.receiptDate = {};
      if (filters.dateFrom) where.receiptDate.gte = filters.dateFrom;
      if (filters.dateTo) where.receiptDate.lte = filters.dateTo;
    }
    if (filters.search) {
      where.OR = [
        { grnNumber: { contains: filters.search } },
        { vendor: { vendorName: { contains: filters.search } } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const [data, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        include: { details: true, vendor: true, store: true },
        orderBy: { receiptDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── QUALITY CHECK ─────────────────────────────

  async recordQC(data: QCInput) {
    const grn = await this.prisma.goodsReceipt.findUnique({ where: { id: data.grnHeaderId } });
    if (!grn) throw new Error('GRN not found');

    // QC validation: quantities must be non-negative and within receivedQty
    if (data.acceptedQty < 0 || data.rejectedQty < 0) {
      throw new Error('QC failed: acceptedQty and rejectedQty cannot be negative');
    }
    if (!Number.isFinite(data.acceptedQty) || !Number.isFinite(data.rejectedQty)) {
      throw new Error('QC failed: acceptedQty and rejectedQty must be valid numbers');
    }
    const totalInspected = (data.acceptedQty || 0) + (data.rejectedQty || 0);
    if (totalInspected > data.receivedQty) {
      throw new Error(`QC failed: accepted (${data.acceptedQty}) + rejected (${data.rejectedQty}) = ${totalInspected} exceeds received qty (${data.receivedQty})`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Create QC record
      const qc = await tx.qualityCheck.create({
        data: {
          grnHeaderId: data.grnHeaderId,
          lineNumber: data.lineNumber,
          itemId: data.itemId,
          itemName: data.itemName,
          receivedQty: data.receivedQty,
          inspectedQty: data.inspectedQty,
          acceptedQty: data.acceptedQty,
          rejectedQty: data.rejectedQty,
          inspectorId: data.inspectorId,
          inspectorName: data.inspectorName,
          result: data.result,
          remarks: data.remarks,
          defectType: data.defectType,
          defectDescription: data.defectDescription,
          actionTaken: data.actionTaken || 'NONE',
        },
      });

      // Update GRN detail
      await tx.goodsReceiptDetail.updateMany({
        where: { grnHeaderId: data.grnHeaderId, itemId: data.itemId },
        data: { acceptedQty: data.acceptedQty, rejectedQty: data.rejectedQty },
      });

      // Check if all items are QC'd
      const allDetails = await tx.goodsReceiptDetail.findMany({ where: { grnHeaderId: data.grnHeaderId } });
      const allQCd = allDetails.every((d: any) => d.acceptedQty > 0 || d.rejectedQty > 0);

      if (allQCd) {
        const hasRejections = allDetails.some((d: any) => d.rejectedQty > 0);
        await tx.goodsReceipt.update({
          where: { id: data.grnHeaderId },
          data: {
            status: hasRejections ? 'PARTIALLY_ACCEPTED' : 'QC_PASSED',
            inspectedBy: data.inspectorName,
            inspectedAt: new Date(),
          },
        });
      }

      return tx.qualityCheck.findUnique({ where: { id: qc.id } });
    });
  }

  // ─── POST TO INVENTORY (accepted qty → ledger) ──

  async postToInventory(grnId: number, postedById: string) {
    const grn = await this.prisma.goodsReceipt.findUnique({
      where: { id: grnId },
      include: { details: { include: { item: true } }, vendor: true, store: true, purchaseOrder: true },
    });
    if (!grn) throw new Error('GRN not found');
    if (grn.status !== 'QC_PASSED' && grn.status !== 'PARTIALLY_ACCEPTED' && grn.status !== 'RECEIVED') {
      throw new Error('GRN must be QC passed or received before posting');
    }

    // Only accepted qty goes to inventory
    const acceptedItems = grn.details.filter((d: any) => d.acceptedQty > 0);
    if (acceptedItems.length === 0) throw new Error('No accepted items to post');

    // Create transaction via TransactionEngine (atomic)
    const transaction = await this.transactionEngine.createMovement({
      companyId: grn.companyId,
      financialYearId: grn.financialYearId,
      voucherType: 'RC',
      transactionDate: grn.receiptDate,
      vendorId: grn.vendorId,
      invoiceDate: grn.invoiceDate || null,
      toStoreId: grn.storeId,
      referenceNo: grn.grnNumber,
      purpose: `Goods Receipt ${grn.grnNumber} from ${grn.vendor.vendorName}`,
      remarks: `Auto-generated from GRN ${grn.grnNumber}`,
      createdBy: (postedById || grn.receivedBy || 'admin').toLowerCase(),
      items: acceptedItems.map((d: any) => ({
        itemId: d.itemId,
        itemName: d.itemName,
        itemCode: d.itemCode || '',
        quantity: d.acceptedQty,
        unitId: d.unitId,
        unitName: d.unitName,
        rate: d.rate,
        amount: d.amount,
        condition: d.condition || 'GOOD',
        remarks: `GRN ${grn.grnNumber} — Batch: ${d.batchNumber || 'N/A'}`,
      })),
    });

    // Atomically update GRN status, PO received quantities, purchase history, and price history
    await this.prisma.$transaction(async (tx) => {
      // Update GRN status
      await tx.goodsReceipt.update({
        where: { id: grnId },
        data: { status: 'COMPLETED' },
      });

      // Update PO received quantities
      if (grn.poHeaderId) {
        for (const detail of acceptedItems) {
          if (detail.poDetailId) {
            const poDetail = await tx.purchaseOrderDetail.findUnique({ where: { id: detail.poDetailId } });
            if (poDetail) {
              const newReceivedQty = poDetail.receivedQty + detail.acceptedQty;
              const newPendingQty = poDetail.orderedQty - newReceivedQty;
              await tx.purchaseOrderDetail.update({
                where: { id: detail.poDetailId },
                data: {
                  receivedQty: newReceivedQty,
                  pendingQty: Math.max(0, newPendingQty),
                  status: newPendingQty <= 0 ? 'COMPLETED' : 'PARTIALLY_RECEIVED',
                },
              });
            }
          }
        }

        // Check if PO is fully received — use valid status transitions
        const poDetails = await tx.purchaseOrderDetail.findMany({ where: { poHeaderId: grn.poHeaderId } });
        const allReceived = poDetails.every((d: any) => d.receivedQty >= d.orderedQty);
        const anyReceived = poDetails.some((d: any) => d.receivedQty > 0);

        if (allReceived || anyReceived) {
          const po = await tx.purchaseOrder.findUnique({ where: { id: grn.poHeaderId } });
          if (po) {
            const targetStatus = allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
            const allowed = PO_STATUS_TRANSITIONS[po.status] || [];
            if (allowed.includes(targetStatus)) {
              await tx.purchaseOrder.update({ where: { id: grn.poHeaderId }, data: { status: targetStatus } });
            }
          }
        }
      }

      // Record purchase history
      for (const detail of acceptedItems) {
        await tx.purchaseHistory.create({
          data: {
            companyId: grn.companyId,
            itemId: detail.itemId,
            vendorId: grn.vendorId,
            purchaseDate: grn.receiptDate,
            poNumber: grn.purchaseOrder?.poNumber,
            grnNumber: grn.grnNumber,
            quantity: detail.acceptedQty,
            rate: detail.rate,
            amount: detail.amount,
            totalAmount: detail.amount,
          },
        });

        // Record price history
        const lastPrice = await tx.priceHistory.findFirst({
          where: { itemId: detail.itemId, vendorId: grn.vendorId },
          orderBy: { effectiveDate: 'desc' },
        });

        await tx.priceHistory.create({
          data: {
            companyId: grn.companyId,
            itemId: detail.itemId,
            vendorId: grn.vendorId,
            effectiveDate: new Date(),
            rate: detail.rate,
            previousRate: lastPrice?.rate,
            variationPercent: lastPrice ? ((detail.rate - lastPrice.rate) / lastPrice.rate * 100) : 0,
          },
        });
      }
    });

    return { success: true, transactionId: transaction.transactionId, voucherNo: transaction.voucherNo };
  }

  async getDashboard(companyId: number) {
    const [totalGRNs, pendingQC, qcPassed, completed, monthlyValue] = await Promise.all([
      this.prisma.goodsReceipt.count({ where: { companyId } }),
      this.prisma.goodsReceipt.count({ where: { companyId, status: 'QC_PENDING' } }),
      this.prisma.goodsReceipt.count({ where: { companyId, status: 'QC_PASSED' } }),
      this.prisma.goodsReceipt.count({ where: { companyId, status: 'COMPLETED' } }),
      this.prisma.goodsReceipt.aggregate({
        where: { companyId, receiptDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } },
        _sum: { totalAmount: true },
      }),
    ]);

    return { totalGRNs, pendingQC, qcPassed, completed, monthlyValue: monthlyValue._sum.totalAmount || 0 };
  }
}
