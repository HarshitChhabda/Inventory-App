import { PrismaClient } from '@prisma/client';

export interface AuditLogData {
  companyId?: number;
  userId?: number;
  action: string;
  tableName: string;
  recordId?: number;
  recordUuid?: string;
  oldValues?: any;
  newValues?: any;
  description?: string;
  ipAddress?: string;
}

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(data: AuditLogData) {
    return this.prisma.auditLog.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        action: data.action,
        tableName: data.tableName,
        recordId: data.recordId,
        recordUuid: data.recordUuid,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        description: data.description,
        ipAddress: data.ipAddress,
      },
    });
  }

  async logLogin(userId: number, ipAddress?: string, device?: string) {
    const login = await this.prisma.loginHistory.create({
      data: { userId, ipAddress, device },
    });
    await this.log({
      userId,
      action: 'LOGIN',
      tableName: 'User',
      recordId: userId,
      description: `User logged in${device ? ` from ${device}` : ''}`,
      ipAddress,
    });
    return login;
  }

  async logLogout(userId: number) {
    await this.prisma.loginHistory.updateMany({
      where: { userId, logoutAt: null },
      data: { logoutAt: new Date() },
    });
    await this.log({
      userId,
      action: 'LOGOUT',
      tableName: 'User',
      recordId: userId,
      description: 'User logged out',
    });
  }

  async findAll(filter: {
    companyId?: number;
    userId?: number;
    action?: string;
    tableName?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 50;
    const where: any = {};
    if (filter.companyId) {
      where.OR = [
        { companyId: filter.companyId },
        { companyId: null },
      ];
    }
    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.tableName) where.tableName = filter.tableName;
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = filter.fromDate;
      if (filter.toDate) where.createdAt.lte = filter.toDate;
    }
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, username: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getStats(companyId: number, fromDate?: Date, toDate?: Date) {
    const where: any = {
      OR: [
        { companyId },
        { companyId: null },
      ],
    };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }
    const [totalLogs, actionCounts, tableCounts, userCounts, recentLogs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: { action: true } }),
      this.prisma.auditLog.groupBy({ by: ['tableName'], where, _count: { tableName: true } }),
      this.prisma.auditLog.groupBy({ by: ['userId'], where, _count: { userId: true }, orderBy: { _count: { userId: 'desc' } }, take: 10 }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { totalLogs, actionCounts, tableCounts, userCounts, recentLogs };
  }

  async getActionTypes() {
    return ['CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'EXPORT', 'PRINT', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'STOCK_MOVEMENT', 'FY_CLOSING', 'FY_REOPEN', 'BACKUP', 'RESTORE', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'FORCE_LOGOUT'];
  }
}
