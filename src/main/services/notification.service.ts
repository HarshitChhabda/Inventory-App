import { PrismaClient } from '@prisma/client';

export interface CreateNotificationInput {
  companyId: number;
  userId: number;
  requisitionHeaderId?: number;
  type: string;
  title: string;
  message: string;
  channel?: string;
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async createNotification(data: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        requisitionHeaderId: data.requisitionHeaderId,
        type: data.type,
        title: data.title,
        message: data.message,
        channel: data.channel || 'IN_APP',
        sentAt: new Date(),
      },
    });
  }

  async getNotifications(userId: number, options?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const where: any = { userId };
    if (options?.unreadOnly) where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { requisitionHeader: { select: { requisitionNumber: true, requestType: true } } },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, unreadCount };
  }

  async markAsRead(notificationId: number) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotification(notificationId: number) {
    return this.prisma.notification.delete({ where: { id: notificationId } });
  }

  async getUnreadCount(userId: number) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async getNotificationStats(companyId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, unreadTotal, byType] = await Promise.all([
      this.prisma.notification.count({
        where: { companyId, createdAt: { gte: today } },
      }),
      this.prisma.notification.count({
        where: { companyId, isRead: false },
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { companyId, createdAt: { gte: today } },
        _count: true,
      }),
    ]);

    return {
      totalToday,
      unreadTotal,
      byType: byType.map((r: any) => ({ type: r.type, count: r._count })),
    };
  }
}
