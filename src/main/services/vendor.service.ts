import { PrismaClient } from '@prisma/client';

export interface CreateVendorInput {
  companyId: number;
  vendorName: string;
  gstNumber?: string;
  panNumber?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  paymentTerms?: string;
  creditDays?: number;
  vendorCategory?: string;
  remarks?: string;
}

export class VendorService {
  constructor(private prisma: PrismaClient) {}

  async generateVendorCode(companyId: number): Promise<string> {
    const count = await this.prisma.vendor.count({ where: { companyId } });
    return `VND-${String(count + 1).padStart(5, '0')}`;
  }

  async createVendor(data: CreateVendorInput) {
    const vendorCode = await this.generateVendorCode(data.companyId);
    return this.prisma.vendor.create({
      data: {
        companyId: data.companyId,
        vendorCode,
        vendorName: data.vendorName,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        contactPerson: data.contactPerson,
        mobile: data.mobile,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country || 'India',
        bankName: data.bankName,
        bankAccountNo: data.bankAccountNo,
        bankIfsc: data.bankIfsc,
        paymentTerms: data.paymentTerms || 'NET30',
        creditDays: data.creditDays || 30,
        vendorCategory: data.vendorCategory || 'GENERAL',
        remarks: data.remarks,
      },
      include: { documents: true, itemMappings: true },
    });
  }

  async getVendor(id: number) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: {
        documents: true,
        itemMappings: { include: { item: true } },
        purchaseOrders: { orderBy: { orderDate: 'desc' }, take: 10 },
        goodsReceipts: { orderBy: { receiptDate: 'desc' }, take: 10 },
        purchaseHistory: { orderBy: { purchaseDate: 'desc' }, take: 20 },
        priceHistory: { orderBy: { effectiveDate: 'desc' }, take: 20 },
      },
    });
  }

  async getVendorByCode(vendorCode: string) {
    return this.prisma.vendor.findUnique({
      where: { vendorCode },
      include: { documents: true, itemMappings: true },
    });
  }

  async updateVendor(id: number, data: Partial<CreateVendorInput>) {
    return this.prisma.vendor.update({
      where: { id },
      data: { ...data, id: undefined, companyId: undefined },
      include: { documents: true },
    });
  }

  async deleteVendor(id: number) {
    const hasPO = await this.prisma.purchaseOrder.count({ where: { vendorId: id } });
    if (hasPO > 0) throw new Error('Cannot delete vendor with existing purchase orders');
    await this.prisma.vendorDocument.deleteMany({ where: { vendorId: id } });
    await this.prisma.itemVendorMapping.deleteMany({ where: { vendorId: id } });
    await this.prisma.vendor.delete({ where: { id } });
    return { success: true };
  }

  async searchVendors(filters: {
    companyId: number;
    search?: string;
    category?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const where: any = { companyId: filters.companyId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.category) where.vendorCategory = filters.category;
    if (filters.search) {
      where.OR = [
        { vendorCode: { contains: filters.search } },
        { vendorName: { contains: filters.search } },
        { contactPerson: { contains: filters.search } },
        { mobile: { contains: filters.search } },
        { gstNumber: { contains: filters.search } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        include: { documents: true, itemMappings: true },
        orderBy: { vendorName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getVendorPerformance(vendorId: number) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new Error('Vendor not found');

    const [poCount, grnCount, avgRating] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { vendorId } }),
      this.prisma.goodsReceipt.count({ where: { vendorId } }),
      this.prisma.purchaseHistory.aggregate({ where: { vendorId }, _avg: { rate: true } }),
    ]);

    const lateDeliveries = await this.prisma.purchaseOrder.count({
      where: {
        vendorId,
        expectedDelivery: { lt: new Date() },
        status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
      },
    });

    return {
      totalPOs: poCount,
      totalGRNs: grnCount,
      lateDeliveries,
      avgRate: avgRating._avg.rate || 0,
      onTimeRate: poCount > 0 ? ((poCount - lateDeliveries) / poCount * 100).toFixed(1) : '0',
    };
  }

  async getVendorDashboard(companyId: number) {
    const [totalVendors, activeVendors, pendingPOs, pendingDeliveries, lateDeliveries, topVendors] = await Promise.all([
      this.prisma.vendor.count({ where: { companyId } }),
      this.prisma.vendor.count({ where: { companyId, isActive: true } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: 'ORDERED' } }),
      this.prisma.purchaseOrder.count({
        where: { companyId, expectedDelivery: { lt: new Date() }, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } },
      }),
      this.prisma.vendor.findMany({
        where: { companyId, isActive: true },
        orderBy: { vendorRating: 'desc' },
        take: 5,
        select: { vendorCode: true, vendorName: true, vendorRating: true },
      }),
    ]);

    const purchaseValue = await this.prisma.purchaseOrder.aggregate({
      where: { companyId, orderDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } },
      _sum: { netAmount: true },
    });

    return {
      totalVendors,
      activeVendors,
      pendingPOs,
      pendingDeliveries,
      lateDeliveries,
      topVendors,
      monthlyPurchaseValue: purchaseValue._sum.netAmount || 0,
    };
  }

  async toggleVendor(id: number, isActive: boolean) {
    return this.prisma.vendor.update({ where: { id }, data: { isActive } });
  }

  async updateRating(id: number, rating: number) {
    return this.prisma.vendor.update({ where: { id }, data: { vendorRating: rating } });
  }
}
