import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';
import { getLogger } from './monitoring/logger.service';
import { StockBalanceService } from './stockBalance.service';
import { StockMonthlySummaryService } from './stockMonthlySummary.service';

const prisma: PrismaClient = getPrismaClient();

export class MaterialInstallationService {
  static async create(data: {
    companyId: number; financialYearId: number;
    storeId: number; locationId?: number; locationName?: string;
    departmentId?: number; departmentName?: string; dharmshalaName?: string;
    date: string; installedBy?: string; approvedBy?: string; remarks?: string;
    serviceRequestId?: number;
    items: Array<{
      itemId: number; itemName: string; itemCode?: string; unitName?: string;
      quantityInstalled: number; condition?: string; remarks?: string;
      serviceRequestId?: number; materialDemandItemId?: number; transactionHeaderId?: number;
    }>;
  }) {
    const installationNumber = `INS-${Date.now()}`;

    for (const item of data.items) {
      if (item.materialDemandItemId) {
        const demandItem = await prisma.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
        if (demandItem) {
          const available = Number(demandItem.quantityIssued) - Number(demandItem.quantityConsumed) - Number(demandItem.quantityInstalled);
          if (item.quantityInstalled > available) {
            throw new Error(`Over-installation blocked: "${item.itemName}" — requested ${item.quantityInstalled} but only ${available} available (issued: ${demandItem.quantityIssued}, consumed: ${demandItem.quantityConsumed}, installed: ${demandItem.quantityInstalled})`);
          }
        }
      } else {
        const agg = await prisma.ledgerEntry.aggregate({
          where: { companyId: data.companyId, financialYearId: data.financialYearId, itemId: item.itemId, storeId: data.storeId },
          _sum: { quantityIn: true, quantityOut: true },
        });
        const balance = Number(agg._sum.quantityIn || 0) - Number(agg._sum.quantityOut || 0);
        if (item.quantityInstalled > balance) {
          throw new Error(`Over-installation blocked: "${item.itemName}" — requested ${item.quantityInstalled} but only ${balance} available in location stock`);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const installation = await tx.materialInstallation.create({
        data: {
          installationNumber,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          storeId: data.storeId,
          locationId: data.locationId || null,
          locationName: data.locationName || null,
          departmentId: data.departmentId || null,
          departmentName: data.departmentName || null,
          dharmshalaName: data.dharmshalaName || null,
          date: new Date(data.date),
          installedBy: data.installedBy || null,
          approvedBy: data.approvedBy || null,
          remarks: data.remarks || null,
          status: 'POSTED',
          serviceRequestId: data.serviceRequestId || null,
        },
      });

      const ledgerEntries: Array<Record<string, unknown>> = [];

      for (const item of data.items) {
        await tx.materialInstallationItem.create({
          data: {
            materialInstallationId: installation.id,
            itemId: item.itemId,
            itemName: item.itemName,
            itemCode: item.itemCode || null,
            unitName: item.unitName || null,
            quantityInstalled: item.quantityInstalled,
            condition: item.condition || 'GOOD',
            remarks: item.remarks || null,
            serviceRequestId: item.serviceRequestId || null,
            materialDemandItemId: item.materialDemandItemId || null,
            transactionHeaderId: item.transactionHeaderId || null,
          },
        });

        ledgerEntries.push({
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          transactionId: null,
          itemId: item.itemId,
          storeId: data.storeId,
          locationId: data.locationId || null,
          voucherNo: installationNumber,
          voucherType: 'IS',
          movementType: 'INSTALL_OUT',
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(item.quantityInstalled),
          balanceQty: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(0),
          condition: item.condition || 'GOOD',
          serialNumber: null,
          batchNumber: null,
          transactionDate: new Date(data.date),
          createdBy: data.installedBy || data.approvedBy || 'system',
        });

        if (item.materialDemandItemId) {
          const demandItem = await tx.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
          if (demandItem) {
            const newInstalled = Number(demandItem.quantityInstalled) + item.quantityInstalled;
            await tx.materialDemandItem.update({
              where: { id: item.materialDemandItemId },
              data: { quantityInstalled: newInstalled },
            });
          }
        }
      }

      if (ledgerEntries.length > 0) {
        await tx.ledgerEntry.createMany({ data: ledgerEntries });

        // Update CurrentStockBalance incrementally (replaces O(N²) running balance recalc)
        const csb = new StockBalanceService(prisma);
        for (const entry of ledgerEntries) {
          const delta = csb.computeDelta(
            entry.movementType as string,
            Number(entry.quantityIn),
            Number(entry.quantityOut),
            entry.locationId as number | null,
          );
          await csb.updateBalance(tx, data.companyId, data.financialYearId, entry.storeId as number, entry.itemId as number, delta);
        }
      }

      return installation;
    });

    getLogger().info(`[MaterialInstallation] Created ${installationNumber}`, 'MaterialInstallation');
    return result;
  }

  static async cancel(installationId: number, companyId: number, financialYearId: number, reason: string, cancelledBy: string) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const installation = await prisma.materialInstallation.findUnique({
      where: { id: installationId },
      include: { items: true },
    });
    if (!installation) throw new Error('Installation not found');
    if (installation.status === 'CANCELLED') throw new Error('Already cancelled');

    const result = await prisma.$transaction(async (tx) => {
      for (const item of installation.items) {
        if (item.materialDemandItemId) {
          const demandItem = await tx.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
          if (demandItem) {
            const newInstalled = Math.max(0, Number(demandItem.quantityInstalled) - Number(item.quantityInstalled));
            await tx.materialDemandItem.update({
              where: { id: item.materialDemandItemId },
              data: { quantityInstalled: newInstalled },
            });
          }
        }
      }

      const reversalEntries: Array<Record<string, unknown>> = [];
      for (const item of installation.items) {
        reversalEntries.push({
          companyId,
          financialYearId,
          transactionId: null,
          itemId: item.itemId,
          storeId: installation.storeId,
          locationId: installation.locationId || null,
          voucherNo: `${installation.installationNumber}-REV`,
          voucherType: 'IS',
          movementType: 'REVERSAL',
          quantityIn: new Prisma.Decimal(Number(item.quantityInstalled)),
          quantityOut: new Prisma.Decimal(0),
          balanceQty: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(0),
          condition: item.condition || 'GOOD',
          serialNumber: null,
          batchNumber: null,
          transactionDate: new Date(),
          createdBy: cancelledBy,
        });
      }

      if (reversalEntries.length > 0) {
        await tx.ledgerEntry.createMany({ data: reversalEntries });

        // Update CurrentStockBalance incrementally (replaces O(N²) running balance recalc)
        const csb = new StockBalanceService(prisma);
        for (const entry of reversalEntries) {
          const delta = csb.computeDelta(
            entry.movementType as string,
            Number(entry.quantityIn),
            Number(entry.quantityOut),
            entry.locationId as number | null,
          );
          await csb.updateBalance(tx, companyId, financialYearId, entry.storeId as number, entry.itemId as number, delta);
        }

        // Update StockMonthlySummary incrementally
        const sms = new StockMonthlySummaryService(prisma);
        await sms.updateSummary(tx, companyId, financialYearId, reversalEntries.map(e => ({
          quantityIn: Number(e.quantityIn),
          quantityOut: Number(e.quantityOut),
          transactionDate: e.transactionDate as Date,
        })));
      }

      await tx.materialInstallation.update({
        where: { id: installationId },
        data: {
          status: 'CANCELLED',
          remarks: `${installation.remarks || ''}\n[CANCELLED] ${reason}`,
        },
      });

      return installation;
    });

    getLogger().info(`[MaterialInstallation] Cancelled ${installation.installationNumber}`, 'MaterialInstallation');
    return result;
  }

  static async findById(id: number) {
    return prisma.materialInstallation.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        store: true,
        location: true,
        serviceRequest: true,
      },
    });
  }

  static async findAll(companyId: number, financialYearId: number, options?: {
    status?: string;
    storeId?: number;
    locationId?: number;
    serviceRequestId?: number;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = { companyId, financialYearId };
    if (options?.status) where.status = options.status;
    if (options?.storeId) where.storeId = options.storeId;
    if (options?.locationId) where.locationId = options.locationId;
    if (options?.serviceRequestId) where.serviceRequestId = options.serviceRequestId;

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;

    const [data, total] = await Promise.all([
      prisma.materialInstallation.findMany({
        where,
        include: {
          items: { include: { item: true } },
          store: true,
          location: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.materialInstallation.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async getInstallationForDemand(serviceRequestId: number) {
    const items = await prisma.materialInstallationItem.findMany({
      where: { serviceRequestId },
      include: { materialInstallation: true, item: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((ii) => ({
      id: ii.id,
      installationNumber: ii.materialInstallation.installationNumber,
      date: ii.materialInstallation.date,
      itemId: ii.itemId,
      itemName: ii.itemName,
      itemCode: ii.itemCode,
      quantityInstalled: Number(ii.quantityInstalled),
      locationName: ii.materialInstallation.locationName,
      installedBy: ii.materialInstallation.installedBy,
      status: ii.materialInstallation.status,
    }));
  }

  static async getInstallationForLocation(storeId: number, locationId?: number) {
    const where: any = { storeId, status: 'POSTED' };
    if (locationId) where.locationId = locationId;

    const items = await prisma.materialInstallationItem.findMany({
      where: { materialInstallation: where },
      include: { materialInstallation: true },
      orderBy: { createdAt: 'desc' },
    });

    const summary: Record<number, { itemId: number; itemName: string; totalInstalled: number }> = {};
    for (const item of items) {
      if (!summary[item.itemId]) {
        summary[item.itemId] = { itemId: item.itemId, itemName: item.itemName, totalInstalled: 0 };
      }
      summary[item.itemId].totalInstalled += Number(item.quantityInstalled);
    }

    return Object.values(summary);
  }
}
