import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';

export interface CreateServiceRequestInput {
  companyId: number;
  financialYearId: number;
  assetId: number;
  storeId?: number;
  roomId?: number;
  departmentId?: number;
  serviceType: string;
  priority?: string;
  issueDescription: string;
  requestedById: number;
  requestedByName: string;
}

export interface UpdateServiceRequestInput {
  storeId?: number;
  roomId?: number;
  departmentId?: number;
  serviceType?: string;
  priority?: string;
  issueDescription?: string;
  assignedToId?: number;
  assignedToName?: string;
  status?: string;
}

export interface ServiceRequestListFilter {
  companyId: number;
  status?: string;
  priority?: string;
  serviceType?: string;
  assetId?: number;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'WAITING_VENDOR', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  WAITING_VENDOR: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};

export class ServiceRequestService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  static async generateRequestNumber(companyId: number, financialYearId: number): Promise<string> {
    const prefix = 'SR';
    const year = new Date().getFullYear().toString().slice(-2);
    const last = await this.prisma.serviceRequest.findFirst({
      where: { companyId, financialYearId },
      orderBy: { id: 'desc' },
      select: { requestNumber: true },
    });
    if (last) {
      const num = parseInt(last.requestNumber.split('-').pop() || '0', 10);
      return `${prefix}-${year}-${String(num + 1).padStart(6, '0')}`;
    }
    return `${prefix}-${year}-000001`;
  }

  static async create(input: CreateServiceRequestInput) {
    const requestNumber = await this.generateRequestNumber(input.companyId, input.financialYearId);
    const request = await this.prisma.serviceRequest.create({
      data: {
        requestNumber,
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        assetId: input.assetId,
        storeId: input.storeId,
        roomId: input.roomId,
        departmentId: input.departmentId,
        serviceType: input.serviceType,
        priority: input.priority || 'MEDIUM',
        issueDescription: input.issueDescription,
        requestedById: input.requestedById,
        requestedByName: input.requestedByName,
        status: 'DRAFT',
      },
      include: { asset: true },
    });
    return request;
  }

  static async update(id: number, input: UpdateServiceRequestInput) {
    const current = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!current) throw new Error('Service request not found');
    if (input.status && !STATUS_FLOW[current.status]?.includes(input.status)) {
      throw new Error(`Cannot transition from ${current.status} to ${input.status}`);
    }
    return this.prisma.serviceRequest.update({
      where: { id },
      data: input,
      include: { asset: true },
    });
  }

  static async submit(id: number) {
    return this.update(id, { status: 'SUBMITTED' });
  }

  static async assign(id: number, assignedToId: number, assignedToName: string) {
    return this.prisma.serviceRequest.update({
      where: { id },
      data: { assignedToId, assignedToName, status: 'ASSIGNED' },
      include: { asset: true },
    });
  }

  static async getById(id: number) {
    return this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { asset: true, checklists: true, workOrder: true },
    });
  }

  static async list(filter: ServiceRequestListFilter) {
    const where: any = { companyId: filter.companyId };
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.serviceType) where.serviceType = filter.serviceType;
    if (filter.assetId) where.assetId = filter.assetId;
    if (filter.dateFrom || filter.dateTo) {
      where.requestDate = {};
      if (filter.dateFrom) where.requestDate.gte = filter.dateFrom;
      if (filter.dateTo) where.requestDate.lte = filter.dateTo;
    }
    if (filter.search) {
      where.OR = [
        { requestNumber: { contains: filter.search } },
        { issueDescription: { contains: filter.search } },
        { requestedByName: { contains: filter.search } },
      ];
    }
    return this.prisma.serviceRequest.findMany({
      where,
      include: { asset: true },
      orderBy: { requestDate: 'desc' },
    });
  }

  static async getDashboard(companyId: number) {
    const prisma = this.prisma;
    const [pending, inProgress, waitingParts, waitingVendor, completedToday, overdue] = await Promise.all([
      prisma.serviceRequest.count({ where: { companyId, status: { in: ['SUBMITTED', 'ASSIGNED'] } } }),
      prisma.serviceRequest.count({ where: { companyId, status: 'IN_PROGRESS' } }),
      prisma.serviceRequest.count({ where: { companyId, status: 'WAITING_PARTS' } }),
      prisma.serviceRequest.count({ where: { companyId, status: 'WAITING_VENDOR' } }),
      prisma.serviceRequest.count({
        where: {
          companyId,
          status: 'COMPLETED',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.serviceRequest.count({ where: { companyId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } }),
    ]);
    return { pending, inProgress, waitingParts, waitingVendor, completedToday, overdue };
  }

  static async addChecklist(serviceRequestId: number, items: string[]) {
    const existing = await this.prisma.serviceChecklist.findMany({ where: { serviceRequestId } });
    const startLine = existing.length;
    return this.prisma.serviceChecklist.createMany({
      data: items.map((item, i) => ({
        serviceRequestId,
        lineNumber: startLine + i + 1,
        checkItem: item,
      })),
    });
  }

  static async toggleChecklistItem(id: number, isChecked: boolean, remarks?: string) {
    return this.prisma.serviceChecklist.update({
      where: { id },
      data: { isChecked, remarks },
    });
  }

  static async getChecklists(serviceRequestId: number) {
    return this.prisma.serviceChecklist.findMany({
      where: { serviceRequestId },
      orderBy: { lineNumber: 'asc' },
    });
  }
}
