import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';

export interface CreateWorkOrderInput {
  companyId: number;
  financialYearId: number;
  serviceRequestId?: number;
  assetId: number;
  engineerId?: number;
  engineerName?: string;
  vendorId?: number;
  vendorName?: string;
  departmentId?: number;
  expectedCompletion?: Date;
  remarks?: string;
}

export interface WorkOrderListFilter {
  companyId: number;
  status?: string;
  engineerId?: number;
  assetId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

const WO_STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class WorkOrderService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  static async generateWorkOrderNumber(companyId: number, financialYearId: number): Promise<string> {
    const prefix = 'WO';
    const year = new Date().getFullYear().toString().slice(-2);
    const last = await this.prisma.workOrder.findFirst({
      where: { companyId, financialYearId },
      orderBy: { id: 'desc' },
      select: { workOrderNumber: true },
    });
    if (last) {
      const num = parseInt(last.workOrderNumber.split('-').pop() || '0', 10);
      return `${prefix}-${year}-${String(num + 1).padStart(6, '0')}`;
    }
    return `${prefix}-${year}-000001`;
  }

  static async create(input: CreateWorkOrderInput) {
    const prisma = this.prisma;
    const workOrderNumber = await this.generateWorkOrderNumber(input.companyId, input.financialYearId);
    const wo = await prisma.workOrder.create({
      data: {
        workOrderNumber,
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        assetId: input.assetId,
        engineerId: input.engineerId,
        engineerName: input.engineerName,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        departmentId: input.departmentId,
        expectedCompletion: input.expectedCompletion,
        remarks: input.remarks,
        status: 'DRAFT',
      },
      include: { asset: true },
    });
    if (input.serviceRequestId) {
      await prisma.serviceRequest.update({
        where: { id: input.serviceRequestId },
        data: { workOrderId: wo.id, status: 'ASSIGNED' },
      });
    }
    return wo;
  }

  static async updateStatus(id: number, status: string) {
    const prisma = this.prisma;
    const current = await prisma.workOrder.findUnique({ where: { id } });
    if (!current) throw new Error('Work order not found');
    if (!WO_STATUS_FLOW[current.status]?.includes(status)) {
      throw new Error(`Cannot transition from ${current.status} to ${status}`);
    }
    const update: any = { status };
    if (status === 'COMPLETED') update.completionDate = new Date();

    const linkedSR = await prisma.serviceRequest.findFirst({ where: { workOrderId: id } });

    if (status === 'IN_PROGRESS' && linkedSR) {
      await prisma.serviceRequest.update({
        where: { id: linkedSR.id },
        data: { status: 'IN_PROGRESS' },
      });
    }
    if (status === 'COMPLETED' && linkedSR) {
      await prisma.serviceRequest.update({
        where: { id: linkedSR.id },
        data: { status: 'COMPLETED' },
      });
    }
    return prisma.workOrder.update({ where: { id }, data: update, include: { asset: true } });
  }

  static async getById(id: number) {
    return this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        asset: true,
        serviceRequest: true,
        spareParts: { include: { item: true } },
        costs: true,
        photos: true,
        documents: true,
      },
    });
  }

  static async list(filter: WorkOrderListFilter) {
    const where: any = { companyId: filter.companyId };
    if (filter.status) where.status = filter.status;
    if (filter.engineerId) where.engineerId = filter.engineerId;
    if (filter.assetId) where.assetId = filter.assetId;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = filter.dateFrom;
      if (filter.dateTo) where.createdAt.lte = filter.dateTo;
    }
    if (filter.search) {
      where.OR = [
        { workOrderNumber: { contains: filter.search } },
        { engineerName: { contains: filter.search } },
        { vendorName: { contains: filter.search } },
      ];
    }
    return this.prisma.workOrder.findMany({
      where,
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async addSparePart(workOrderId: number, data: {
    lineNumber: number;
    itemId: number;
    itemName: string;
    itemCode?: string;
    quantity: number;
    unitName?: string;
    rate?: number;
    amount?: number;
    remarks?: string;
  }) {
    return this.prisma.workOrderSparePart.create({
      data: { workOrderId, ...data },
      include: { item: true },
    });
  }

  static async removeSparePart(id: number) {
    return this.prisma.workOrderSparePart.delete({ where: { id } });
  }

  static async getSpareParts(workOrderId: number) {
    return this.prisma.workOrderSparePart.findMany({
      where: { workOrderId },
      include: { item: true },
      orderBy: { lineNumber: 'asc' },
    });
  }

  static async addCost(workOrderId: number, data: {
    costType: string;
    amount: number;
    description?: string;
    invoiceNumber?: string;
  }) {
    return this.prisma.serviceCost.create({
      data: { workOrderId, ...data },
    });
  }

  static async getCosts(workOrderId: number) {
    return this.prisma.serviceCost.findMany({ where: { workOrderId } });
  }

  static async addPhoto(workOrderId: number, data: {
    photoType: string;
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    caption?: string;
    takenBy?: string;
  }) {
    return this.prisma.maintenancePhoto.create({
      data: { workOrderId, ...data },
    });
  }

  static async getPhotos(workOrderId: number) {
    return this.prisma.maintenancePhoto.findMany({ where: { workOrderId }, orderBy: { takenAt: 'desc' } });
  }

  static async addDocument(workOrderId: number, data: {
    documentType: string;
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    description?: string;
    uploadedBy?: string;
  }) {
    return this.prisma.maintenanceDocument.create({
      data: { workOrderId, ...data },
    });
  }

  static async getDocuments(workOrderId: number) {
    return this.prisma.maintenanceDocument.findMany({ where: { workOrderId }, orderBy: { createdAt: 'desc' } });
  }

  static async getDashboard(companyId: number) {
    const prisma = this.prisma;
    const [pendingApproval, inProgress, completedToday, overdue, totalCost] = await Promise.all([
      prisma.workOrder.count({ where: { companyId, status: 'DRAFT' } }),
      prisma.workOrder.count({ where: { companyId, status: 'IN_PROGRESS' } }),
      prisma.workOrder.count({
        where: {
          companyId,
          status: 'COMPLETED',
          completionDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.workOrder.count({
        where: {
          companyId,
          status: { in: ['APPROVED', 'IN_PROGRESS'] },
          expectedCompletion: { lt: new Date() },
        },
      }),
      prisma.serviceCost.aggregate({
        where: { workOrder: { companyId } },
        _sum: { amount: true },
      }),
    ]);
    return { pendingApproval, inProgress, completedToday, overdue, totalCost: totalCost._sum.amount || 0 };
  }

  static async recordMaintenanceHistory(data: {
    companyId: number;
    assetId: number;
    workOrderId?: number;
    serviceType: string;
    description: string;
    engineerName?: string;
    vendorName?: string;
    partsUsed?: string;
    labourCost?: number;
    materialCost?: number;
    vendorCost?: number;
    travelCost?: number;
    miscCost?: number;
    downtime?: number;
    remarks?: string;
  }) {
    const totalCost = (data.labourCost || 0) + (data.materialCost || 0) + (data.vendorCost || 0) + (data.travelCost || 0) + (data.miscCost || 0);
    return this.prisma.maintenanceHistory.create({
      data: { ...data, totalCost },
    });
  }

  static async getMaintenanceHistory(companyId: number, assetId?: number) {
    const where: any = { companyId };
    if (assetId) where.assetId = assetId;
    return this.prisma.maintenanceHistory.findMany({
      where,
      orderBy: { serviceDate: 'desc' },
    });
  }

  static async recordBreakdown(data: {
    companyId: number;
    assetId: number;
    cause: string;
    resolution?: string;
    downtime?: number;
    responsiblePerson?: string;
    sparePartsUsed?: string;
    cost?: number;
    remarks?: string;
  }) {
    return this.prisma.breakdownHistory.create({ data });
  }

  static async getBreakdownHistory(companyId: number, assetId?: number) {
    const where: any = { companyId };
    if (assetId) where.assetId = assetId;
    return this.prisma.breakdownHistory.findMany({
      where,
      orderBy: { breakdownDate: 'desc' },
    });
  }

  static async updateAssetHealth(assetId: number) {
    const prisma = this.prisma;
    const asset = await prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');

    const [repairCount, totalDowntime, totalCost, recentMaintenance] = await Promise.all([
      prisma.maintenanceHistory.count({ where: { assetId, serviceType: 'BREAKDOWN' } }),
      prisma.maintenanceHistory.aggregate({ where: { assetId }, _sum: { downtime: true } }),
      prisma.maintenanceHistory.aggregate({ where: { assetId }, _sum: { totalCost: true } }),
      prisma.maintenanceHistory.findMany({
        where: { assetId },
        orderBy: { serviceDate: 'desc' },
        take: 5,
        select: { serviceType: true },
      }),
    ]);

    const age = asset.purchaseDate
      ? (Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;
    const agePenalty = Math.min(30, age * 3);
    const repairPenalty = Math.min(30, repairCount * 5);
    const costPenalty = Math.min(20, ((totalCost._sum.totalCost || 0) / 10000));
    const complianceBonus = recentMaintenance.length >= 2 ? 5 : 0;
    const healthScore = Math.max(0, Math.min(100, 100 - agePenalty - repairPenalty - costPenalty + complianceBonus));

    return {
      healthScore: Math.round(healthScore),
      age: Math.round(age * 10) / 10,
      repairCount,
      totalDowntime: totalDowntime._sum.downtime || 0,
      totalCost: totalCost._sum.totalCost || 0,
    };
  }
}
