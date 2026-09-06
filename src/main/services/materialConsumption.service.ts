import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';
import { getLogger } from './monitoring/logger.service';
import { StockBalanceService } from './stockBalance.service';
import { StockMonthlySummaryService } from './stockMonthlySummary.service';

const prisma: PrismaClient = getPrismaClient();

export class MaterialConsumptionService {
  static async create(data: {
    companyId: number; financialYearId: number;
    storeId: number; locationId?: number; locationName?: string;
    departmentId?: number; dharmshalaName?: string;
    date: string; usedBy?: string; issuedBy?: string; remarks?: string;
    serviceRequestId?: number;
    items: Array<{
      itemId: number; itemName: string; itemCode?: string; unitName?: string;
      quantityUsed: number; condition?: string; remarks?: string;
      serviceRequestId?: number; materialDemandItemId?: number; transactionHeaderId?: number;
    }>;
  }) {
    const consumptionNumber = `CON-${Date.now()}`;

    for (const item of data.items) {
      if (item.materialDemandItemId) {
        const demandItem = await prisma.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
        if (demandItem) {
          const available = Number(demandItem.quantityIssued) - Number(demandItem.quantityConsumed);
          if (item.quantityUsed > available) {
            throw new Error(`Over-consumption blocked: "${item.itemName}" — requested ${item.quantityUsed} but only ${available} available (issued: ${demandItem.quantityIssued}, already consumed: ${demandItem.quantityConsumed})`);
          }
        }
      } else {
        const agg = await prisma.ledgerEntry.aggregate({
          where: { companyId: data.companyId, financialYearId: data.financialYearId, itemId: item.itemId, storeId: data.storeId },
          _sum: { quantityIn: true, quantityOut: true },
        });
        const balance = Number(agg._sum.quantityIn || 0) - Number(agg._sum.quantityOut || 0);
        if (item.quantityUsed > balance) {
          throw new Error(`Over-consumption blocked: "${item.itemName}" — requested ${item.quantityUsed} but only ${balance} available in location stock`);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const consumption = await tx.materialConsumption.create({
        data: {
          consumptionNumber,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          storeId: data.storeId,
          locationId: data.locationId || null,
          locationName: data.locationName || null,
          departmentId: data.departmentId || null,
          dharmshalaName: data.dharmshalaName || null,
          date: new Date(data.date),
          usedBy: data.usedBy || null,
          issuedBy: data.issuedBy || null,
          remarks: data.remarks || null,
          serviceRequestId: data.serviceRequestId || null,
          status: 'POSTED',
        },
      });

      const ledgerEntries: Array<Record<string, unknown>> = [];

      for (const item of data.items) {
        await tx.materialConsumptionItem.create({
          data: {
            materialConsumptionId: consumption.id,
            itemId: item.itemId,
            itemName: item.itemName,
            itemCode: item.itemCode || null,
            unitName: item.unitName || null,
            quantityUsed: item.quantityUsed,
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
          voucherNo: consumptionNumber,
          voucherType: 'CN',
          movementType: 'CONSUMPTION_OUT',
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(item.quantityUsed),
          balanceQty: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(0),
          condition: item.condition || 'GOOD',
          serialNumber: null,
          batchNumber: null,
          transactionDate: new Date(data.date),
          createdBy: data.usedBy || data.issuedBy || 'system',
        });

        if (item.materialDemandItemId) {
          const demandItem = await tx.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
          if (demandItem) {
            const newConsumed = Number(demandItem.quantityConsumed) + item.quantityUsed;
            await tx.materialDemandItem.update({
              where: { id: item.materialDemandItemId },
              data: { quantityConsumed: newConsumed },
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

        // Update StockMonthlySummary incrementally
        const sms = new StockMonthlySummaryService(prisma);
        await sms.updateSummary(tx, data.companyId, data.financialYearId, ledgerEntries.map(e => ({
          quantityIn: Number(e.quantityIn),
          quantityOut: Number(e.quantityOut),
          transactionDate: e.transactionDate as Date,
        })));
      }

      if (data.serviceRequestId) {
        const allDemandItems = await tx.materialDemandItem.findMany({ where: { serviceRequestId: data.serviceRequestId } });
        const allConsumptionItems = await tx.materialConsumptionItem.findMany({
          where: { serviceRequestId: data.serviceRequestId },
        });
        const totalConsumed = allConsumptionItems.reduce((sum, ci) => sum + Number(ci.quantityUsed), 0);
        const totalIssued = allDemandItems.reduce((sum, di) => sum + Number(di.quantityIssued), 0);

        let consumptionStatus = 'NOT_USED';
        if (totalConsumed > 0 && totalConsumed < totalIssued) consumptionStatus = 'PARTIALLY_USED';
        else if (totalConsumed >= totalIssued && totalIssued > 0) consumptionStatus = 'FULLY_USED';

        await tx.serviceRequest.update({
          where: { id: data.serviceRequestId },
          data: { materialDemandStatus: consumptionStatus === 'FULLY_USED' ? 'COMPLETED' : undefined },
        });
      }

      return consumption;
    });

    getLogger().info(`[MaterialConsumption] Created ${consumptionNumber}`, 'MaterialConsumption');
    return result;
  }

  static async cancel(consumptionId: number, companyId: number, financialYearId: number, reason: string, cancelledBy: string) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const consumption = await prisma.materialConsumption.findUnique({
      where: { id: consumptionId },
      include: { items: true },
    });
    if (!consumption) throw new Error('Consumption not found');
    if (consumption.status === 'CANCELLED') throw new Error('Already cancelled');

    const result = await prisma.$transaction(async (tx) => {
      for (const item of consumption.items) {
        if (item.materialDemandItemId) {
          const demandItem = await tx.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
          if (demandItem) {
            const newConsumed = Math.max(0, Number(demandItem.quantityConsumed) - Number(item.quantityUsed));
            await tx.materialDemandItem.update({
              where: { id: item.materialDemandItemId },
              data: { quantityConsumed: newConsumed },
            });
          }
        }
      }

      const reversalEntries: Array<Record<string, unknown>> = [];
      for (const item of consumption.items) {
        reversalEntries.push({
          companyId,
          financialYearId,
          transactionId: null,
          itemId: item.itemId,
          storeId: consumption.storeId,
          locationId: consumption.locationId || null,
          voucherNo: `${consumption.consumptionNumber}-REV`,
          voucherType: 'CN',
          movementType: 'CONSUMPTION_REVERSAL',
          quantityIn: new Prisma.Decimal(Number(item.quantityUsed)),
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

      await tx.materialConsumption.update({
        where: { id: consumptionId },
        data: {
          status: 'CANCELLED',
          remarks: `${consumption.remarks || ''}\n[CANCELLED] ${reason}`,
        },
      });

      // Recalculate materialDemandStatus after cancellation
      if (consumption.serviceRequestId) {
        const allDemandItems = await tx.materialDemandItem.findMany({ where: { serviceRequestId: consumption.serviceRequestId } });
        const allConsumptionItems = await tx.materialConsumptionItem.findMany({
          where: { serviceRequestId: consumption.serviceRequestId },
        });
        // Exclude the cancelled consumption from the total
        const totalConsumed = allConsumptionItems
          .filter((ci) => ci.materialConsumptionId !== consumptionId)
          .reduce((sum, ci) => sum + Number(ci.quantityUsed), 0);
        const totalIssued = allDemandItems.reduce((sum, di) => sum + Number(di.quantityIssued), 0);

        let newStatus: string | undefined;
        if (totalConsumed === 0) {
          newStatus = 'PENDING';
        } else if (totalConsumed < totalIssued) {
          newStatus = 'PARTIALLY_ISSUED';
        } else if (totalConsumed >= totalIssued && totalIssued > 0) {
          newStatus = 'COMPLETED';
        }

        await tx.serviceRequest.update({
          where: { id: consumption.serviceRequestId },
          data: { materialDemandStatus: newStatus },
        });
      }

      return consumption;
    });

    getLogger().info(`[MaterialConsumption] Cancelled ${consumption.consumptionNumber}`, 'MaterialConsumption');
    return result;
  }

  static async findById(id: number) {
    return prisma.materialConsumption.findUnique({
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
      prisma.materialConsumption.findMany({
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
      prisma.materialConsumption.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async getConsumptionForLocation(storeId: number, locationId?: number) {
    const where: any = { storeId, status: 'POSTED' };
    if (locationId) where.locationId = locationId;

    const items = await prisma.materialConsumptionItem.findMany({
      where: { materialConsumption: where },
      include: { materialConsumption: true },
      orderBy: { createdAt: 'desc' },
    });

    const summary: Record<number, { itemId: number; itemName: string; totalConsumed: number }> = {};
    for (const item of items) {
      if (!summary[item.itemId]) {
        summary[item.itemId] = { itemId: item.itemId, itemName: item.itemName, totalConsumed: 0 };
      }
      summary[item.itemId].totalConsumed += Number(item.quantityUsed);
    }

    return Object.values(summary);
  }

  static async getConsumptionForDemand(serviceRequestId: number) {
    const items = await prisma.materialConsumptionItem.findMany({
      where: { serviceRequestId },
      include: { materialConsumption: true, item: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((ci) => ({
      id: ci.id,
      consumptionNumber: ci.materialConsumption.consumptionNumber,
      date: ci.materialConsumption.date,
      itemId: ci.itemId,
      itemName: ci.itemName,
      itemCode: ci.itemCode,
      quantityUsed: Number(ci.quantityUsed),
      locationName: ci.materialConsumption.locationName,
      usedBy: ci.materialConsumption.usedBy,
      status: ci.materialConsumption.status,
    }));
  }
}
