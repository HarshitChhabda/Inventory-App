import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';

export interface CreateAMCInput {
  companyId: number;
  assetId: number;
  vendorId: number;
  vendorName?: string;
  agreementNumber?: string;
  startDate: Date;
  endDate: Date;
  coverage?: string;
  totalVisits?: number;
  totalCost?: number;
  paymentTerms?: string;
  remarks?: string;
}

export interface AMCListFilter {
  companyId: number;
  status?: string;
  assetId?: number;
  vendorId?: number;
  expiringWithinDays?: number;
}

export interface CreateWarrantyClaimInput {
  companyId: number;
  assetId: number;
  claimNumber: string;
  issueDescription: string;
}

export class AMCService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  static async generateClaimNumber(companyId: number): Promise<string> {
    const prefix = 'WC';
    const year = new Date().getFullYear().toString().slice(-2);
    const last = await this.prisma.warrantyClaim.findFirst({
      where: { companyId },
      orderBy: { id: 'desc' },
      select: { claimNumber: true },
    });
    if (last) {
      const num = parseInt(last.claimNumber.split('-').pop() || '0', 10);
      return `${prefix}-${year}-${String(num + 1).padStart(6, '0')}`;
    }
    return `${prefix}-${year}-000001`;
  }

  static async createAMC(input: CreateAMCInput) {
    return this.prisma.aMCAgreement.create({
      data: {
        companyId: input.companyId,
        assetId: input.assetId,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        agreementNumber: input.agreementNumber,
        startDate: input.startDate,
        endDate: input.endDate,
        coverage: input.coverage || 'FULL',
        totalVisits: input.totalVisits,
        totalCost: input.totalCost || 0,
        paymentTerms: input.paymentTerms,
        remarks: input.remarks,
        status: 'ACTIVE',
      },
      include: { asset: true },
    });
  }

  static async updateAMC(id: number, data: Partial<CreateAMCInput>) {
    return this.prisma.aMCAgreement.update({
      where: { id },
      data,
      include: { asset: true },
    });
  }

  static async getAMCById(id: number) {
    return this.prisma.aMCAgreement.findUnique({
      where: { id },
      include: { asset: true, documents: true },
    });
  }

  static async listAMCs(filter: AMCListFilter) {
    const where: any = { companyId: filter.companyId };
    if (filter.status) where.status = filter.status;
    if (filter.assetId) where.assetId = filter.assetId;
    if (filter.vendorId) where.vendorId = filter.vendorId;
    if (filter.expiringWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filter.expiringWithinDays);
      where.endDate = { lte: futureDate };
      where.status = 'ACTIVE';
    }
    return this.prisma.aMCAgreement.findMany({
      where,
      include: { asset: true },
      orderBy: { endDate: 'asc' },
    });
  }

  static async addAMCDocument(amcId: number, data: {
    documentType: string;
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    description?: string;
    uploadedBy?: string;
  }) {
    return this.prisma.aMCDocument.create({ data: { amcId, ...data } });
  }

  static async getAMCDocuments(amcId: number) {
    return this.prisma.aMCDocument.findMany({ where: { amcId } });
  }

  static async cancelAMC(id: number) {
    return this.prisma.aMCAgreement.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  static async getExpiringAMCs(companyId: number, days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.prisma.aMCAgreement.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        endDate: { lte: futureDate, gte: new Date() },
      },
      include: { asset: true },
      orderBy: { endDate: 'asc' },
    });
  }

  static async createWarrantyClaim(input: CreateWarrantyClaimInput) {
    const claimNumber = input.claimNumber || await this.generateClaimNumber(input.companyId);
    return this.prisma.warrantyClaim.create({
      data: {
        companyId: input.companyId,
        assetId: input.assetId,
        claimNumber,
        issueDescription: input.issueDescription,
        status: 'SUBMITTED',
      },
      include: { asset: true },
    });
  }

  static async updateWarrantyClaimStatus(id: number, status: string, resolution?: string) {
    const update: any = { status };
    if (resolution) update.resolution = resolution;
    if (status === 'CLOSED' || status === 'REPLACED' || status === 'REPAIRED') {
      update.resolvedAt = new Date();
    }
    return this.prisma.warrantyClaim.update({
      where: { id },
      data: update,
      include: { asset: true },
    });
  }

  static async getWarrantyClaims(companyId: number, assetId?: number) {
    const where: any = { companyId };
    if (assetId) where.assetId = assetId;
    return this.prisma.warrantyClaim.findMany({
      where,
      include: { asset: true },
      orderBy: { claimDate: 'desc' },
    });
  }

  static async getExpiringWarranties(companyId: number, days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.prisma.assetProfile.findMany({
      where: {
        companyId,
        warrantyEnd: { lte: futureDate, gte: new Date() },
      },
    });
  }

  static async createServiceSchedule(data: {
    companyId: number;
    assetId: number;
    serviceType: string;
    frequency: string;
    customDays?: number;
    remarks?: string;
  }) {
    const nextDueDate = this.calculateNextDueDate(data.frequency, data.customDays);
    return this.prisma.serviceSchedule.create({
      data: { ...data, nextDueDate, isActive: true },
      include: { asset: true },
    });
  }

  static async updateServiceSchedule(id: number, data: { frequency?: string; customDays?: number; isActive?: boolean }) {
    const update: any = { ...data };
    if (data.frequency) {
      update.nextDueDate = this.calculateNextDueDate(data.frequency, data.customDays);
    }
    return this.prisma.serviceSchedule.update({ where: { id }, data: update, include: { asset: true } });
  }

  static async listServiceSchedules(companyId: number, assetId?: number) {
    const where: any = { companyId, isActive: true };
    if (assetId) where.assetId = assetId;
    return this.prisma.serviceSchedule.findMany({
      where,
      include: { asset: true },
      orderBy: { nextDueDate: 'asc' },
    });
  }

  static async getUpcomingReminders(companyId: number, days: number = 14) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const [upcomingServices, expiringAMCs, overdueWorkOrders, expiringWarranties] = await Promise.all([
      this.prisma.serviceSchedule.findMany({
        where: { companyId, isActive: true, nextDueDate: { lte: futureDate, gte: new Date() } },
        include: { asset: true },
      }),
      this.getExpiringAMCs(companyId, days),
      this.prisma.workOrder.findMany({
        where: {
          companyId,
          status: { in: ['APPROVED', 'IN_PROGRESS'] },
          expectedCompletion: { lt: new Date() },
        },
        include: { asset: true },
      }),
      this.getExpiringWarranties(companyId, days),
    ]);
    return { upcomingServices, expiringAMCs, overdueWorkOrders, expiringWarranties };
  }

  static calculateNextDueDate(frequency: string, customDays?: number): Date {
    const now = new Date();
    switch (frequency) {
      case 'MONTHLY': now.setMonth(now.getMonth() + 1); break;
      case 'QUARTERLY': now.setMonth(now.getMonth() + 3); break;
      case 'HALF_YEARLY': now.setMonth(now.getMonth() + 6); break;
      case 'YEARLY': now.setFullYear(now.getFullYear() + 1); break;
      case 'CUSTOM': now.setDate(now.getDate() + (customDays || 30)); break;
      default: now.setMonth(now.getMonth() + 1);
    }
    return now;
  }
}
