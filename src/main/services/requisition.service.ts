import { PrismaClient } from '@prisma/client';

export interface CreateRequisitionInput {
  companyId: number;
  financialYearId: number;
  requestType: string;
  requestedById: number;
  requestedByName: string;
  departmentId?: number;
  departmentName?: string;
  dharmshalaName?: string;
  sourceStoreId?: number;
  sourceStoreName?: string;
  sourceLocationId?: number;
  sourceRoomId?: number;
  destStoreId?: number;
  destStoreName?: string;
  destLocationId?: number;
  destRoomId?: number;
  destDepartmentId?: number;
  destDepartmentName?: string;
  requiredDate?: Date;
  priority?: string;
  remarks?: string;
  items: CreateRequisitionDetailInput[];
}

export interface CreateRequisitionDetailInput {
  itemId: number;
  itemName: string;
  itemCode?: string;
  requestedQty: number;
  unitId?: number;
  unitName?: string;
  reason?: string;
  remarks?: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['COMPLETED', 'CLOSED'],
  PARTIALLY_APPROVED: ['COMPLETED', 'CLOSED'],
  REJECTED: ['DRAFT'],
  CANCELLED: ['DRAFT'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
};

export class RequisitionService {
  constructor(private prisma: PrismaClient) {}

  // ─── GENERATE REQUISITION NUMBER ──────────────

  async generateRequisitionNumber(companyId: number, financialYearId: number, requestType: string): Promise<string> {
    const prefix = requestType.substring(0, 2).toUpperCase();
    const fy = await this.prisma.financialYear.findUnique({ where: { id: financialYearId } });
    const fyLabel = fy?.label?.substring(2, 4) || '26';
    const count = await this.prisma.requisitionHeader.count({
      where: { companyId, financialYearId, requestType },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `REQ-${prefix}-${fyLabel}-${seq}`;
  }

  // ─── CREATE ────────────────────────────────────

  async createRequisition(data: CreateRequisitionInput) {
    const requisitionNumber = await this.generateRequisitionNumber(
      data.companyId, data.financialYearId, data.requestType
    );

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new Error('At least one item is required');
    }

    for (const item of data.items) {
      if (item.requestedQty <= 0) {
        throw new Error(`Invalid quantity for item ${item.itemName}`);
      }
      const itemRecord = await this.prisma.item.findUnique({ where: { id: item.itemId } });
      if (!itemRecord || !itemRecord.isActive) {
        throw new Error(`Item ${item.itemName} is inactive or not found`);
      }
    }

    // Validate stores
    if (data.sourceStoreId) {
      const store = await this.prisma.store.findUnique({ where: { id: data.sourceStoreId } });
      if (!store || !store.isActive) throw new Error('Source store is inactive');
    }
    if (data.destStoreId) {
      const store = await this.prisma.store.findUnique({ where: { id: data.destStoreId } });
      if (!store || !store.isActive) throw new Error('Destination store is inactive');
    }

    // Validate department
    if (data.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept || !dept.isActive) throw new Error('Department is inactive');
    }

    // Check no duplicate pending request for same item
    const existingPending = await this.prisma.requisitionHeader.findFirst({
      where: {
        companyId: data.companyId,
        requestType: data.requestType,
        requestedById: data.requestedById,
        status: { in: ['DRAFT', 'SUBMITTED', 'PENDING'] },
      },
      include: { details: true },
    });
    if (existingPending) {
      const duplicateItems = data.items.filter(di =>
        existingPending.details.some(ed => ed.itemId === di.itemId)
      );
      if (duplicateItems.length > 0) {
        throw new Error(`Duplicate pending request for items: ${duplicateItems.map(d => d.itemName).join(', ')}`);
      }
    }

    // Check financial year is open
    const fy = await this.prisma.financialYear.findUnique({ where: { id: data.financialYearId } });
    if (!fy || fy.isClosed) throw new Error('Financial year is closed');

    const result = await this.prisma.$transaction(async (tx) => {
      const header = await tx.requisitionHeader.create({
        data: {
          requisitionNumber,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          requestType: data.requestType,
          requestedById: data.requestedById,
          requestedByName: data.requestedByName,
          departmentId: data.departmentId,
          departmentName: data.departmentName,
          dharmshalaName: data.dharmshalaName,
          sourceStoreId: data.sourceStoreId,
          sourceStoreName: data.sourceStoreName,
          sourceLocationId: data.sourceLocationId,
          sourceRoomId: data.sourceRoomId,
          destStoreId: data.destStoreId,
          destStoreName: data.destStoreName,
          destLocationId: data.destLocationId,
          destRoomId: data.destRoomId,
          destDepartmentId: data.destDepartmentId,
          destDepartmentName: data.destDepartmentName,
          requiredDate: data.requiredDate,
          priority: data.priority || 'MEDIUM',
          remarks: data.remarks,
          status: 'DRAFT',
        },
      });

      await tx.requisitionDetail.createMany({
        data: data.items.map((item, idx) => ({
          requisitionHeaderId: header.id,
          lineNumber: idx + 1,
          itemId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          requestedQty: item.requestedQty,
          pendingQty: item.requestedQty,
          unitId: item.unitId,
          unitName: item.unitName,
          reason: item.reason,
          remarks: item.remarks,
        })),
      });

      return tx.requisitionHeader.findUnique({
        where: { id: header.id },
        include: { details: true, company: true, financialYear: true, requestedBy: true },
      });
    });

    return result;
  }

  // ─── READ ──────────────────────────────────────

  async getRequisition(id: number) {
    return this.prisma.requisitionHeader.findUnique({
      where: { id },
      include: {
        details: { include: { item: true } },
        approvals: { orderBy: { actionDate: 'desc' } },
        requestedBy: true,
        department: true,
        sourceStore: true,
        destStore: true,
        destDepartment: true,
        approvalWorkflow: { include: { levels: { orderBy: { levelNumber: 'asc' } } } },
        transactionHeader: true,
      },
    });
  }

  async getRequisitionByNumber(requisitionNumber: string) {
    return this.prisma.requisitionHeader.findUnique({
      where: { requisitionNumber },
      include: {
        details: { include: { item: true } },
        approvals: { orderBy: { actionDate: 'desc' } },
        requestedBy: true,
      },
    });
  }

  async searchRequisitions(filters: {
    companyId: number;
    status?: string;
    requestType?: string;
    priority?: string;
    requestedById?: number;
    departmentId?: number;
    sourceStoreId?: number;
    destStoreId?: number;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = { companyId: filters.companyId };
    if (filters.status) where.status = filters.status;
    if (filters.requestType) where.requestType = filters.requestType;
    if (filters.priority) where.priority = filters.priority;
    if (filters.requestedById) where.requestedById = filters.requestedById;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.sourceStoreId) where.sourceStoreId = filters.sourceStoreId;
    if (filters.destStoreId) where.destStoreId = filters.destStoreId;
    if (filters.dateFrom || filters.dateTo) {
      where.requestDate = {};
      if (filters.dateFrom) where.requestDate.gte = filters.dateFrom;
      if (filters.dateTo) where.requestDate.lte = filters.dateTo;
    }
    if (filters.search) {
      where.OR = [
        { requisitionNumber: { contains: filters.search } },
        { requestedByName: { contains: filters.search } },
        { departmentName: { contains: filters.search } },
        { remarks: { contains: filters.search } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const [data, total] = await Promise.all([
      this.prisma.requisitionHeader.findMany({
        where,
        include: {
          details: true,
          requestedBy: true,
          department: true,
          sourceStore: true,
          destStore: true,
        },
        orderBy: { requestDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.requisitionHeader.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── STATUS TRANSITIONS ────────────────────────

  async submitRequisition(id: number) {
    return this.transitionStatus(id, 'SUBMITTED');
  }

  async cancelRequisition(id: number, reason?: string) {
    const req = await this.getRequisition(id);
    if (!req) throw new Error('Requisition not found');
    if (['COMPLETED', 'CLOSED'].includes(req.status)) {
      throw new Error('Cannot cancel completed or closed requisition');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id },
        data: { status: 'CANCELLED', rejectionReason: reason },
      });
      await tx.approvalAction.create({
        data: {
          requisitionHeaderId: id,
          levelNumber: 0,
          action: 'CANCEL',
          actionById: req.requestedById,
          actionByName: req.requestedByName,
          oldStatus: req.status,
          newStatus: 'CANCELLED',
          remarks: reason,
        },
      });
      return this.getRequisition(id);
    });
  }

  async closeRequisition(id: number) {
    return this.transitionStatus(id, 'CLOSED');
  }

  async reopenRequisition(id: number) {
    const req = await this.getRequisition(id);
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'REJECTED' && req.status !== 'CANCELLED') {
      throw new Error('Only rejected or cancelled requisitions can be reopened');
    }
    return this.transitionStatus(id, 'DRAFT');
  }

  private async transitionStatus(id: number, newStatus: string) {
    const req = await this.getRequisition(id);
    if (!req) throw new Error('Requisition not found');
    const allowed = VALID_TRANSITIONS[req.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${req.status} to ${newStatus}`);
    }
    return this.prisma.requisitionHeader.update({
      where: { id },
      data: { status: newStatus },
      include: { details: true },
    });
  }

  // ─── UPDATE ────────────────────────────────────

  async updateRequisition(id: number, data: Partial<CreateRequisitionInput>) {
    const req = await this.getRequisition(id);
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'DRAFT') throw new Error('Only draft requisitions can be edited');

    return this.prisma.$transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        await tx.requisitionDetail.deleteMany({ where: { requisitionHeaderId: id } });
        await tx.requisitionDetail.createMany({
          data: data.items.map((item, idx) => ({
            requisitionHeaderId: id,
            lineNumber: idx + 1,
            itemId: item.itemId,
            itemName: item.itemName,
            itemCode: item.itemCode,
            requestedQty: item.requestedQty,
            pendingQty: item.requestedQty,
            unitId: item.unitId,
            unitName: item.unitName,
            reason: item.reason,
            remarks: item.remarks,
          })),
        });
      }

      const updateData: any = {};
      if (data.priority) updateData.priority = data.priority;
      if (data.requiredDate) updateData.requiredDate = data.requiredDate;
      if (data.remarks !== undefined) updateData.remarks = data.remarks;
      if (data.sourceStoreId) updateData.sourceStoreId = data.sourceStoreId;
      if (data.destStoreId) updateData.destStoreId = data.destStoreId;

      await tx.requisitionHeader.update({ where: { id }, data: updateData });
      return this.getRequisition(id);
    });
  }

  // ─── DASHBOARD ─────────────────────────────────

  async getDashboard(companyId: number) {
    const [
      totalRequests,
      pendingRequests,
      approvedToday,
      rejectedToday,
      urgentRequests,
      overdueRequests,
      partiallyIssued,
      pendingApproval,
    ] = await Promise.all([
      this.prisma.requisitionHeader.count({ where: { companyId } }),
      this.prisma.requisitionHeader.count({ where: { companyId, status: { in: ['SUBMITTED', 'PENDING'] } } }),
      this.prisma.requisitionHeader.count({
        where: {
          companyId, status: 'APPROVED',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.requisitionHeader.count({
        where: {
          companyId, status: 'REJECTED',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.requisitionHeader.count({ where: { companyId, priority: 'EMERGENCY', status: { in: ['SUBMITTED', 'PENDING'] } } }),
      this.prisma.requisitionHeader.count({
        where: {
          companyId, requiredDate: { lt: new Date() },
          status: { in: ['SUBMITTED', 'PENDING', 'APPROVED'] },
        },
      }),
      this.prisma.requisitionHeader.count({ where: { companyId, status: 'PARTIALLY_APPROVED' } }),
      this.prisma.requisitionHeader.count({ where: { companyId, status: 'PENDING' } }),
    ]);

    const byType = await this.prisma.requisitionHeader.groupBy({
      by: ['requestType'],
      where: { companyId },
      _count: true,
    });

    const byPriority = await this.prisma.requisitionHeader.groupBy({
      by: ['priority'],
      where: { companyId, status: { in: ['SUBMITTED', 'PENDING', 'APPROVED'] } },
      _count: true,
    });

    return {
      totalRequests,
      pendingRequests,
      approvedToday,
      rejectedToday,
      urgentRequests,
      overdueRequests,
      partiallyIssued,
      pendingApproval,
      byType: byType.map((r: any) => ({ type: r.requestType, count: r._count })),
      byPriority: byPriority.map((r: any) => ({ priority: r.priority, count: r._count })),
    };
  }

  // ─── REPORTS ──────────────────────────────────

  async getRequisitionRegister(companyId: number, dateFrom?: Date, dateTo?: Date) {
    const where: any = { companyId };
    if (dateFrom || dateTo) {
      where.requestDate = {};
      if (dateFrom) where.requestDate.gte = dateFrom;
      if (dateTo) where.requestDate.lte = dateTo;
    }
    return this.prisma.requisitionHeader.findMany({
      where,
      include: { details: true, requestedBy: true },
      orderBy: { requestDate: 'desc' },
    });
  }

  async getApprovalRegister(companyId: number) {
    return this.prisma.approvalAction.findMany({
      where: { header: { companyId } },
      include: { header: true, level: true, actionBy: true },
      orderBy: { actionDate: 'desc' },
    });
  }

  async getPendingRequests(companyId: number) {
    return this.prisma.requisitionHeader.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'PENDING'] } },
      include: { details: true, requestedBy: true },
      orderBy: [{ priority: 'asc' }, { requestDate: 'asc' }],
    });
  }

  async getRejectedRequests(companyId: number) {
    return this.prisma.requisitionHeader.findMany({
      where: { companyId, status: 'REJECTED' },
      include: { details: true, approvals: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getUserWiseRequests(companyId: number, userId: number) {
    return this.prisma.requisitionHeader.findMany({
      where: { companyId, requestedById: userId },
      include: { details: true },
      orderBy: { requestDate: 'desc' },
    });
  }

  async getDepartmentWiseRequests(companyId: number) {
    const requests = await this.prisma.requisitionHeader.findMany({
      where: { companyId },
      include: { details: true },
    });
    const grouped = requests.reduce((acc: Record<string, any[]>, r: any) => {
      const dept = r.departmentName || 'Unassigned';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(r);
      return acc;
    }, {});
    return Object.entries(grouped).map(([department, reqs]) => ({
      department,
      count: reqs.length,
      requests: reqs,
    }));
  }

  async getIssuedAgainstRequest(companyId: number) {
    return this.prisma.requisitionHeader.findMany({
      where: { companyId, status: { in: ['COMPLETED', 'PARTIALLY_APPROVED'] } },
      include: { details: true, transactionHeader: true },
      orderBy: { completedDate: 'desc' },
    });
  }
}
