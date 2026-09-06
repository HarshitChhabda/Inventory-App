import { PrismaClient } from '@prisma/client';
import { VoucherEngine, VoucherType } from './voucherEngine.service';

export interface CreatePOInput {
  companyId: number;
  financialYearId: number;
  vendorId: number;
  expectedDelivery?: Date;
  paymentTerms?: string;
  remarks?: string;
  items: CreatePODetailInput[];
}

export interface CreatePODetailInput {
  itemId: number;
  itemName: string;
  itemCode?: string;
  description?: string;
  orderedQty: number;
  unitId?: number;
  unitName?: string;
  rate: number;
  discount?: number;
  discountType?: string;
  taxRate?: number;
  remarks?: string;
}

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

export class PurchaseOrderService {
  constructor(private prisma: PrismaClient) {}

  async generatePONumber(companyId: number, financialYearId: number): Promise<string> {
    const fy = await this.prisma.financialYear.findUnique({ where: { id: financialYearId } });
    const fyLabel = fy?.label?.substring(2, 4) || '26';
    const count = await this.prisma.purchaseOrder.count({ where: { companyId, financialYearId } });
    return `PO-${fyLabel}-${String(count + 1).padStart(6, '0')}`;
  }

  async createPO(data: CreatePOInput) {
    if (!data.items || data.items.length === 0) throw new Error('At least one item required');

    const poNumber = await this.generatePONumber(data.companyId, data.financialYearId);

    // Validate vendor
    const vendor = await this.prisma.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor || !vendor.isActive) throw new Error('Vendor is inactive');

    // Validate items
    for (const item of data.items) {
      if (item.orderedQty <= 0) throw new Error(`Invalid quantity for ${item.itemName}`);
      if (item.rate <= 0) throw new Error(`Invalid rate for ${item.itemName}`);
      const itemRecord = await this.prisma.item.findUnique({ where: { id: item.itemId } });
      if (!itemRecord || !itemRecord.isActive) throw new Error(`Item ${item.itemName} is inactive`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Calculate totals
      let totalAmount = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const detailData = data.items.map((item, idx) => {
        const grossAmount = item.orderedQty * item.rate;
        const discount = item.discountType === 'AMOUNT' ? (item.discount || 0) : grossAmount * ((item.discount || 0) / 100);
        const afterDiscount = grossAmount - discount;
        const tax = afterDiscount * ((item.taxRate || 0) / 100);
        const netAmount = afterDiscount + tax;

        totalAmount += grossAmount;
        totalDiscount += discount;
        totalTax += tax;

        return {
          lineNumber: idx + 1,
          itemId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          description: item.description,
          orderedQty: item.orderedQty,
          pendingQty: item.orderedQty,
          unitId: item.unitId,
          unitName: item.unitName,
          rate: item.rate,
          discount: item.discount || 0,
          discountType: item.discountType || 'PERCENT',
          taxRate: item.taxRate || 0,
          taxAmount: tax,
          amount: grossAmount,
          netAmount,
        };
      });

      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          vendorId: data.vendorId,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          paymentTerms: data.paymentTerms || vendor.paymentTerms,
          totalAmount,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          netAmount: totalAmount - totalDiscount + totalTax,
          status: 'DRAFT',
          remarks: data.remarks,
        },
      });

      await tx.purchaseOrderDetail.createMany({
        data: detailData.map(d => ({ ...d, poHeaderId: po.id })),
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { details: true, vendor: true },
      });
    });
  }

  async getPO(id: number) {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        details: { include: { item: true } },
        vendor: true,
        goodsReceipts: { include: { details: true } },
      },
    });
  }

  async searchPOs(filters: {
    companyId: number;
    status?: string;
    vendorId?: number;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = { companyId: filters.companyId };
    if (filters.status) where.status = filters.status;
    if (filters.vendorId) where.vendorId = filters.vendorId;
    if (filters.dateFrom || filters.dateTo) {
      where.orderDate = {};
      if (filters.dateFrom) where.orderDate.gte = filters.dateFrom;
      if (filters.dateTo) where.orderDate.lte = filters.dateTo;
    }
    if (filters.search) {
      where.OR = [
        { poNumber: { contains: filters.search } },
        { vendor: { vendorName: { contains: filters.search } } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { details: true, vendor: true },
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async transitionStatus(id: number, newStatus: string, userId?: string, userName?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('PO not found');

    const allowed = PO_STATUS_TRANSITIONS[po.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${po.status} to ${newStatus}`);
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'APPROVED') { updateData.approvedBy = userName; updateData.approvedAt = new Date(); }
    if (newStatus === 'ORDERED') { updateData.orderedBy = userName; updateData.orderedAt = new Date(); }
    if (newStatus === 'CANCELLED') { updateData.cancellationReason = 'Cancelled by user'; }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { details: true, vendor: true },
    });
  }

  async approvePO(id: number, approvedBy: string) { return this.transitionStatus(id, 'APPROVED', undefined, approvedBy); }
  async orderPO(id: number, orderedBy: string) { return this.transitionStatus(id, 'ORDERED', undefined, orderedBy); }
  async cancelPO(id: number) { return this.transitionStatus(id, 'CANCELLED'); }
  async closePO(id: number) { return this.transitionStatus(id, 'CLOSED'); }

  async updatePO(id: number, data: Partial<CreatePOInput>) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('PO not found');
    if (po.status !== 'DRAFT') throw new Error('Only draft POs can be edited');

    return this.prisma.$transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        await tx.purchaseOrderDetail.deleteMany({ where: { poHeaderId: id } });
        let totalAmount = 0, totalDiscount = 0, totalTax = 0;

        const detailData = data.items.map((item, idx) => {
          const grossAmount = item.orderedQty * item.rate;
          const discount = item.discountType === 'AMOUNT' ? (item.discount || 0) : grossAmount * ((item.discount || 0) / 100);
          const afterDiscount = grossAmount - discount;
          const tax = afterDiscount * ((item.taxRate || 0) / 100);
          totalAmount += grossAmount; totalDiscount += discount; totalTax += tax;
          return {
            poHeaderId: id, lineNumber: idx + 1, itemId: item.itemId, itemName: item.itemName,
            itemCode: item.itemCode, description: item.description, orderedQty: item.orderedQty,
            pendingQty: item.orderedQty, unitId: item.unitId, unitName: item.unitName,
            rate: item.rate, discount: item.discount || 0, discountType: item.discountType || 'PERCENT',
            taxRate: item.taxRate || 0, taxAmount: tax, amount: grossAmount, netAmount: afterDiscount + tax,
          };
        });
        await tx.purchaseOrderDetail.createMany({ data: detailData });
        await tx.purchaseOrder.update({
          where: { id },
          data: { totalAmount, discountAmount: totalDiscount, taxAmount: totalTax, netAmount: totalAmount - totalDiscount + totalTax },
        });
      }
      return tx.purchaseOrder.findUnique({ where: { id }, include: { details: true, vendor: true } });
    });
  }

  async getDashboard(companyId: number) {
    const [pendingPOs, orderedPOs, partialPOs, completedPOs, latePOs, totalValue] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { companyId, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: 'ORDERED' } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: 'PARTIALLY_RECEIVED' } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: 'COMPLETED' } }),
      this.prisma.purchaseOrder.count({
        where: { companyId, expectedDelivery: { lt: new Date() }, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { companyId, orderDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } },
        _sum: { netAmount: true },
      }),
    ]);

    return { pendingPOs, orderedPOs, partialPOs, completedPOs, latePOs, monthlyValue: totalValue._sum.netAmount || 0 };
  }
}
