import { PrismaClient, Prisma } from '@prisma/client';
import { getLogger } from './monitoring/logger.service';
import { getPrismaClient } from '../database/prisma.client';
import { StockBalanceService } from './stockBalance.service';
import { StockMonthlySummaryService } from './stockMonthlySummary.service';

const prisma = getPrismaClient();

function computeDemandItemStatus(qtyRequested: number, qtyIssued: number, qtyReturned: number): string {
  const remaining = qtyRequested - qtyIssued + qtyReturned;
  if (remaining <= 0) return 'COMPLETED';
  if (qtyIssued > 0) return 'PARTIALLY_ISSUED';
  return 'PENDING';
}

function computeServiceRequestDemandStatus(items: any[]): string {
  if (items.length === 0) return 'NONE';
  const allCompleted = items.every((i: any) => i.status === 'COMPLETED');
  if (allCompleted) return 'COMPLETED';
  const anyIssued = items.some((i: any) => i.status === 'PARTIALLY_ISSUED' || i.status === 'COMPLETED');
  if (anyIssued) return 'PARTIALLY_ISSUED';
  return 'PENDING';
}

export class MaterialDemandService {
  static async createDemand(serviceRequestId: number, items: Array<{
    itemId: number; itemName: string; itemCode?: string; unitName: string;
    quantityRequested: number; serialNumber?: string; remarks?: string;
    responsiblePerson?: string; workType?: string;
    locationId?: number; locationName?: string; storeId?: number;
  }>, headerData?: {
    responsiblePerson?: string; workType?: string; locationName?: string; locationId?: number;
    dharmshalaName?: string; departmentName?: string; storeId?: number;
    physicalDemandNo?: string; demandDate?: string;
    requestingPerson?: string; mobileNo?: string; storeName?: string;
  }) {
    if (headerData?.physicalDemandNo) {
      const sr = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
      if (!sr) throw new Error('Service request not found');
      const existing = await prisma.serviceRequest.findFirst({
        where: {
          companyId: sr.companyId,
          physicalDemandNo: headerData.physicalDemandNo,
          id: { not: serviceRequestId },
        },
      });
      if (existing) throw new Error(`Physical Demand No. "${headerData.physicalDemandNo}" already exists for this company`);
    }

    const updateData: any = { materialDemandStatus: 'PENDING' };
    if (headerData?.responsiblePerson) updateData.responsiblePerson = headerData.responsiblePerson;
    if (headerData?.workType) updateData.workType = headerData.workType;
    if (headerData?.physicalDemandNo) updateData.physicalDemandNo = headerData.physicalDemandNo;
    if (headerData?.demandDate) updateData.demandDate = new Date(headerData.demandDate);
    if (headerData?.requestingPerson) updateData.requestingPerson = headerData.requestingPerson;
    if (headerData?.mobileNo) updateData.mobileNo = headerData.mobileNo;
    if (headerData?.locationName) updateData.locationName = headerData.locationName;
    if (headerData?.dharmshalaName) updateData.dharmshalaName = headerData.dharmshalaName;
    if (headerData?.departmentName) updateData.departmentName = headerData.departmentName;
    if (headerData?.storeName) updateData.storeName = headerData.storeName;
    if (headerData?.storeId) updateData.storeId = headerData.storeId;

    await prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: updateData,
    });

    const created = await Promise.all(items.map((item, idx) =>
      prisma.materialDemandItem.create({
        data: {
          serviceRequestId,
          lineNumber: idx + 1,
          itemId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          unitName: item.unitName,
          quantityRequested: item.quantityRequested,
          serialNumber: item.serialNumber,
          remarks: item.remarks,
          responsiblePerson: item.responsiblePerson || headerData?.responsiblePerson,
          workType: item.workType || headerData?.workType,
          locationId: item.locationId || headerData?.locationId || null,
          locationName: item.locationName || headerData?.locationName || null,
          storeId: item.storeId || headerData?.storeId || null,
        },
      })
    ));

    return created;
  }

  static async getDemandItems(serviceRequestId: number) {
    return prisma.materialDemandItem.findMany({
      where: { serviceRequestId },
      orderBy: { lineNumber: 'asc' },
      include: {
        allocations: { include: { transaction: true } },
        installations: { include: { materialInstallation: true } },
      },
    });
  }

  static async getDemandItemById(demandItemId: number) {
    return prisma.materialDemandItem.findUnique({
      where: { id: demandItemId },
      include: { allocations: { include: { transaction: true } }, serviceRequest: true },
    });
  }

  static async getOpenDemandsForCompany(companyId: number, financialYearId?: number, demandType?: string) {
    const where: any = {
      companyId,
      materialDemandStatus: { in: ['PENDING', 'PARTIALLY_ISSUED', 'COMPLETED'] },
    };
    if (financialYearId) where.financialYearId = financialYearId;
    if (demandType && demandType !== 'GENERAL') {
      where.OR = [
        { demandType },
        { demandType: 'GENERAL' },
      ];
    }

    const serviceRequests = await prisma.serviceRequest.findMany({
      where,
      include: {
        demandItems: {
          include: { allocations: true },
        },
        asset: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return serviceRequests.filter((sr: any) =>
      sr.demandItems.length > 0 &&
      sr.demandItems.some((di: any) =>
        Number(di.quantityRequested) > Number(di.quantityIssued) ||
        Number(di.quantityIssued) > Number(di.quantityConsumed)
      )
    );
  }

  static async searchDemands(companyId: number, query: string) {
    const where: any = {
      companyId,
      materialDemandStatus: { in: ['PENDING', 'PARTIALLY_ISSUED', 'COMPLETED'] },
      OR: [
        { physicalDemandNo: { contains: query } },
        { requestNumber: { contains: query } },
        { requestingPerson: { contains: query } },
        { responsiblePerson: { contains: query } },
      ],
    };

    const serviceRequests = await prisma.serviceRequest.findMany({
      where,
      include: {
        demandItems: {
          where: { status: { in: ['PENDING', 'PARTIALLY_ISSUED'] } },
          include: { allocations: true },
        },
        asset: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return serviceRequests.filter((sr: any) => sr.demandItems.length > 0);
  }

  static async getDemandAllocations(serviceRequestId: number) {
    return prisma.demandAllocation.findMany({
      where: { materialDemandItem: { serviceRequestId } },
      include: {
        materialDemandItem: true,
        transaction: { select: { id: true, voucherNo: true, transactionDate: true, approvalStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createAllocations(serviceRequestId: number, transactionHeaderId: number, items: Array<{
    demandItemId: number; quantityAllocated: number;
  }>) {
    const updated = await prisma.$transaction(async (tx) => {
      const allocResults = await Promise.all(items.map(item =>
        tx.demandAllocation.create({
          data: {
            materialDemandItemId: item.demandItemId,
            transactionHeaderId,
            quantityAllocated: item.quantityAllocated,
          },
        })
      ));

      const demandItemIds = items.map((i) => i.demandItemId);
      const demandItems = await tx.materialDemandItem.findMany({ where: { id: { in: demandItemIds } } });
      const demandItemMap = new Map(demandItems.map((d) => [d.id, d]));

      const allocations = await tx.demandAllocation.groupBy({
        by: ['materialDemandItemId'],
        where: { materialDemandItemId: { in: demandItemIds } },
        _sum: { quantityAllocated: true },
      });
      const allocMap = new Map(allocations.map((a) => [a.materialDemandItemId, Number(a._sum.quantityAllocated || 0)]));

      for (const item of items) {
        const demandItem = demandItemMap.get(item.demandItemId);
        if (!demandItem) throw new Error(`Demand item ${item.demandItemId} not found`);

        const totalIssued = allocMap.get(item.demandItemId) || 0;
        const status = computeDemandItemStatus(Number(demandItem.quantityRequested), totalIssued, Number(demandItem.quantityReturned));

        await tx.materialDemandItem.update({
          where: { id: item.demandItemId },
          data: { quantityIssued: totalIssued, status },
        });
      }

      const allItems = await tx.materialDemandItem.findMany({ where: { serviceRequestId } });
      const srStatus = computeServiceRequestDemandStatus(allItems);
      await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { materialDemandStatus: srStatus },
      });

      return allocResults;
    });

    return updated;
  }

  static async reverseAllocationsForTransaction(transactionHeaderId: number) {
    const allocations = await prisma.demandAllocation.findMany({
      where: { transactionHeaderId },
    });
    if (allocations.length === 0) return [];

    const demandItemIds = [...new Set(allocations.map(a => a.materialDemandItemId))];

    const result = await prisma.$transaction(async (tx) => {
      await tx.demandAllocation.deleteMany({ where: { transactionHeaderId } });

      for (const demandItemId of demandItemIds) {
        const demandItem = await tx.materialDemandItem.findUnique({ where: { id: demandItemId } });
        if (!demandItem) continue;

        const totalAllocated = await tx.demandAllocation.aggregate({
          where: { materialDemandItemId: demandItemId },
          _sum: { quantityAllocated: true },
        });

        const totalIssued = Number(totalAllocated._sum.quantityAllocated || 0);
        const status = computeDemandItemStatus(Number(demandItem.quantityRequested), totalIssued, Number(demandItem.quantityReturned));

        await tx.materialDemandItem.update({
          where: { id: demandItemId },
          data: { quantityIssued: totalIssued, status },
        });

        const serviceRequestId = demandItem.serviceRequestId;
        const allItems = await tx.materialDemandItem.findMany({ where: { serviceRequestId } });
        const srStatus = computeServiceRequestDemandStatus(allItems);
        await tx.serviceRequest.update({
          where: { id: serviceRequestId },
          data: { materialDemandStatus: srStatus },
        });
      }

      return allocations;
    });

    return result;
  }

  static async issueMaterial(serviceRequestId: number, issueSlipNumber: string, items: Array<{
    demandItemId: number; quantityIssued: number; serialNumber?: string;
  }>) {
    const updated = await Promise.all(items.map(item =>
      prisma.materialDemandItem.update({
        where: { id: item.demandItemId },
        data: {
          quantityIssued: item.quantityIssued,
          serialNumber: item.serialNumber || undefined,
          status: 'ISSUED',
        },
      })
    ));

    await prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        materialDemandStatus: 'ISSUED',
        issueSlipNumber,
      },
    });

    return updated;
  }

  static async returnMaterial(serviceRequestId: number, items: Array<{
    demandItemId: number; quantityReturned: number; quantityDamaged: number;
  }>) {
    const updated = await Promise.all(items.map(async (item) => {
      const result = await prisma.materialDemandItem.update({
        where: { id: item.demandItemId },
        data: {
          quantityReturned: item.quantityReturned,
          quantityDamaged: item.quantityDamaged,
        },
      });
      return result;
    }));

    for (const item of items) {
      const demandItem = await prisma.materialDemandItem.findUnique({ where: { id: item.demandItemId } });
      if (!demandItem) continue;
      const status = computeDemandItemStatus(Number(demandItem.quantityRequested), Number(demandItem.quantityIssued), Number(demandItem.quantityReturned));
      await prisma.materialDemandItem.update({ where: { id: item.demandItemId }, data: { status } });
    }

    const allItems = await prisma.materialDemandItem.findMany({ where: { serviceRequestId } });
    const srStatus = computeServiceRequestDemandStatus(allItems);
    await prisma.serviceRequest.update({ where: { id: serviceRequestId }, data: { materialDemandStatus: srStatus } });

    return updated;
  }

  static async listDemands(companyId: number, filter?: { status?: string; financialYearId?: number }) {
    const where: any = {
      companyId,
      materialDemandStatus: filter?.status ? filter.status : { not: 'NONE' },
    };
    if (filter?.financialYearId) where.financialYearId = filter.financialYearId;

    return prisma.serviceRequest.findMany({
      where,
      include: {
        demandItems: { include: { allocations: { include: { transaction: { select: { id: true, voucherNo: true, transactionDate: true, approvalStatus: true } } } } } },
        asset: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getDemandDetail(serviceRequestId: number) {
    return prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        demandItems: { include: { allocations: { include: { transaction: { select: { id: true, voucherNo: true, transactionDate: true, approvalStatus: true, fromStore: true } } } } } },
        asset: true,
        company: true,
      },
    });
  }

  static async getDemandByPhysicalNo(companyId: number, physicalDemandNo: string) {
    return prisma.serviceRequest.findFirst({
      where: { companyId, physicalDemandNo },
      include: {
        demandItems: {
          include: { allocations: { include: { transaction: true } } },
        },
        asset: true,
      },
    });
  }

  static async createDirectDemand(data: {
    companyId: number; financialYearId: number;
    physicalDemandNo: string; demandDate: string;
    requestingPerson: string; mobileNo?: string;
    responsiblePerson?: string; workType?: string;
    remarks?: string;
    locationName?: string; departmentId?: number; departmentName?: string; dharmshalaName?: string;
    storeId?: number; storeName?: string;
    items: Array<{
      itemId: number; itemName: string; itemCode?: string; unitName: string;
      quantityRequested: number; serialNumber?: string; remarks?: string;
    }>;
  }) {
    getLogger().info(
      `[createDirectDemand] FK diagnostics — companyId=${data.companyId}, financialYearId=${data.financialYearId}, requestedById=${data.requestedById}, assetId=null, workOrderId=undefined`,
      'MaterialDemand'
    );

    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    getLogger().info(`[createDirectDemand] Company lookup: ${JSON.stringify(company)}`, 'MaterialDemand');
    if (!company) throw new Error(`FK VIOLATION: Company with id=${data.companyId} does not exist in the database.`);

    const fy = await prisma.financialYear.findUnique({ where: { id: data.financialYearId } });
    getLogger().info(`[createDirectDemand] FinancialYear lookup: ${JSON.stringify(fy)}`, 'MaterialDemand');
    if (!fy) throw new Error(`FK VIOLATION: FinancialYear with id=${data.financialYearId} does not exist in the database.`);

    if (data.requestedById) {
      const user = await prisma.user.findUnique({ where: { id: data.requestedById } });
      getLogger().info(`[createDirectDemand] User lookup (requestedById=${data.requestedById}): ${JSON.stringify(user)}`, 'MaterialDemand');
    }

    const itemIds = data.items.map((i) => i.itemId);
    const itemsExist = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true } });
    const existingItemIds = new Set(itemsExist.map((i) => i.id));
    for (const item of data.items) {
      if (!existingItemIds.has(item.itemId)) {
        throw new Error(`FK VIOLATION: Item with id=${item.itemId} ("${item.itemName}") does not exist.`);
      }
    }
    getLogger().info(`[createDirectDemand] All FK checks passed. Proceeding with insert.`, 'MaterialDemand');

    const existing = await prisma.serviceRequest.findFirst({
      where: { companyId: data.companyId, physicalDemandNo: data.physicalDemandNo },
    });
    if (existing) throw new Error(`Physical Demand No. "${data.physicalDemandNo}" already exists`);

    const sr = await prisma.serviceRequest.create({
      data: {
        requestNumber: `DEM-${Date.now()}`,
        physicalDemandNo: data.physicalDemandNo,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        assetId: null,
        serviceType: 'INTERNAL',
        priority: 'MEDIUM',
        issueDescription: data.remarks || `Direct demand - ${data.physicalDemandNo}`,
        requestedById: data.requestedById || null,
        requestedByName: data.requestingPerson || 'System',
        requestDate: new Date(data.demandDate),
        demandDate: new Date(data.demandDate),
        requestingPerson: data.requestingPerson,
        mobileNo: data.mobileNo,
        responsiblePerson: data.responsiblePerson,
        workType: data.workType,
        locationName: data.locationName || null,
        departmentId: data.departmentId || null,
        departmentName: data.departmentName || null,
        dharmshalaName: data.dharmshalaName || null,
        demandType: data.demandType || 'GENERAL',
        storeId: data.storeId || null,
        storeName: data.storeName || null,
        materialDemandStatus: 'PENDING',
        status: 'COMPLETED',
      },
    });

    getLogger().info(`[createDirectDemand] ServiceRequest created: id=${sr.id}`, 'MaterialDemand');

    const created = await Promise.all(data.items.map((item, idx) =>
      prisma.materialDemandItem.create({
        data: {
          serviceRequestId: sr.id,
          lineNumber: idx + 1,
          itemId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          unitName: item.unitName,
          quantityRequested: item.quantityRequested,
          serialNumber: item.serialNumber,
          remarks: item.remarks,
          responsiblePerson: data.responsiblePerson,
          workType: data.workType,
          storeId: data.storeId || null,
          locationName: data.locationName || null,
        },
      })
    ));

    return { serviceRequest: sr, demandItems: created };
  }

  static async updateDirectDemand(serviceRequestId: number, data: {
    physicalDemandNo?: string; demandDate?: string;
    requestingPerson?: string; mobileNo?: string;
    responsiblePerson?: string; workType?: string;
    remarks?: string;
    locationName?: string; departmentId?: number; departmentName?: string; dharmshalaName?: string;
    storeId?: number; storeName?: string;
    items?: Array<{
      itemId: number; itemName: string; itemCode?: string; unitName: string;
      quantityRequested: number; serialNumber?: string; remarks?: string;
    }>;
  }) {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
    if (!sr) throw new Error('Service request not found');

    if (data.physicalDemandNo && data.physicalDemandNo !== sr.physicalDemandNo) {
      const existing = await prisma.serviceRequest.findFirst({
        where: { companyId: sr.companyId, physicalDemandNo: data.physicalDemandNo, id: { not: serviceRequestId } },
      });
      if (existing) throw new Error(`Physical Demand No. "${data.physicalDemandNo}" already exists`);
    }

    const updateData: any = {};
    if (data.physicalDemandNo !== undefined) updateData.physicalDemandNo = data.physicalDemandNo;
    if (data.demandDate !== undefined) updateData.demandDate = new Date(data.demandDate);
    if (data.requestingPerson !== undefined) updateData.requestingPerson = data.requestingPerson;
    if (data.mobileNo !== undefined) updateData.mobileNo = data.mobileNo;
    if (data.responsiblePerson !== undefined) updateData.responsiblePerson = data.responsiblePerson;
    if (data.workType !== undefined) updateData.workType = data.workType;
    if (data.remarks !== undefined) updateData.issueDescription = data.remarks;
    if (data.locationName !== undefined) updateData.locationName = data.locationName;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.departmentName !== undefined) updateData.departmentName = data.departmentName;
    if (data.dharmshalaName !== undefined) updateData.dharmshalaName = data.dharmshalaName;
    if (data.storeId !== undefined) updateData.storeId = data.storeId;
    if (data.storeName !== undefined) updateData.storeName = data.storeName;

    await prisma.serviceRequest.update({ where: { id: serviceRequestId }, data: updateData });

    if (data.items) {
      await prisma.materialDemandItem.deleteMany({ where: { serviceRequestId } });
      const created = await Promise.all(data.items.map((item, idx) =>
        prisma.materialDemandItem.create({
          data: {
            serviceRequestId,
            lineNumber: idx + 1,
            itemId: item.itemId,
            itemName: item.itemName,
            itemCode: item.itemCode,
            unitName: item.unitName,
            quantityRequested: item.quantityRequested,
            serialNumber: item.serialNumber,
            remarks: item.remarks,
            responsiblePerson: data.responsiblePerson,
            workType: data.workType,
            storeId: data.storeId || null,
            locationName: data.locationName || null,
          },
        })
      ));
      return { serviceRequest: await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } }), demandItems: created };
    }

    return { serviceRequest: await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } }), demandItems: await prisma.materialDemandItem.findMany({ where: { serviceRequestId }, orderBy: { lineNumber: 'asc' } }) };
  }

  static async deleteDirectDemand(serviceRequestId: number) {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
    if (!sr) throw new Error('Service request not found');

    const demandItems = await prisma.materialDemandItem.findMany({ where: { serviceRequestId }, select: { id: true } });
    const demandItemIds = demandItems.map((d) => d.id);

    const linkedAllocations = await prisma.demandAllocation.findMany({
      where: { materialDemandItemId: { in: demandItemIds } },
      include: { materialDemandItem: true },
    });
    const uniqueTransactionIds = [...new Set(linkedAllocations.map((a) => a.transactionHeaderId).filter(Boolean))];

    for (const txId of uniqueTransactionIds) {
      const header = await prisma.transactionHeader.findUnique({ where: { id: txId } });
      if (!header || header.approvalStatus !== 'POSTED') continue;

      const linkedConsumptions = await prisma.materialConsumption.findMany({
        where: { transactionHeaderId: txId, status: 'POSTED' },
        include: { items: true },
      });

      for (const consumption of linkedConsumptions) {
        await prisma.$transaction(async (tx) => {
          for (const item of consumption.items) {
            if (item.materialDemandItemId) {
              const demandItem = await tx.materialDemandItem.findUnique({ where: { id: item.materialDemandItemId } });
              if (demandItem) {
                const newConsumed = Math.max(0, Number(demandItem.quantityConsumed) - Number(item.quantityUsed));
                await tx.materialDemandItem.update({ where: { id: item.materialDemandItemId }, data: { quantityConsumed: newConsumed } });
              }
            }
          }

          const reversalEntries: Array<Record<string, unknown>> = [];
          for (const item of consumption.items) {
            reversalEntries.push({
              companyId: sr.companyId,
              financialYearId: sr.financialYearId,
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
              createdBy: 'system-delete',
            });
          }
          if (reversalEntries.length > 0) {
            await tx.ledgerEntry.createMany({ data: reversalEntries });

            // Update CurrentStockBalance incrementally
            const csb = new StockBalanceService(prisma);
            for (const entry of reversalEntries) {
              const delta = csb.computeDelta(
                entry.movementType as string,
                Number(entry.quantityIn),
                Number(entry.quantityOut),
                entry.locationId as number | null,
              );
              await csb.updateBalance(tx, sr.companyId, sr.financialYearId, entry.storeId as number, entry.itemId as number, delta);
            }

            // Update StockMonthlySummary incrementally
            const sms = new StockMonthlySummaryService(prisma);
            await sms.updateSummary(tx, sr.companyId, sr.financialYearId, reversalEntries.map(e => ({
              quantityIn: Number(e.quantityIn),
              quantityOut: Number(e.quantityOut),
              transactionDate: e.transactionDate as Date,
            })));
          }

          await tx.materialConsumption.update({ where: { id: consumption.id }, data: { status: 'CANCELLED', remarks: `${consumption.remarks || ''}\n[CANCELLED] Demand deleted` } });
        });
      }

      const details = await prisma.transactionDetail.findMany({ where: { transactionId: txId } });
      const reversalVoucherNo = `RV-${header.voucherNo}`;

      await prisma.$transaction(async (tx) => {
        const rvHeader = await tx.transactionHeader.create({
          data: {
            companyId: header.companyId,
            financialYearId: header.financialYearId,
            voucherNo: reversalVoucherNo,
            voucherType: 'RV',
            transactionDate: new Date(),
            fromStoreId: header.toStoreId,
            toStoreId: header.fromStoreId,
            fromLocationId: header.toLocationId,
            toLocationId: header.fromLocationId,
            referenceNo: header.voucherNo,
            remarks: `Reversal — demand deleted (SR#${serviceRequestId})`,
            createdBy: 'system-delete',
            approvalStatus: 'POSTED',
            postedBy: 'system-delete',
            postedAt: new Date(),
          },
        });

        await tx.transactionDetail.createMany({
          data: details.map((d) => ({
            transactionId: rvHeader.id,
            itemId: d.itemId,
            unitId: d.unitId,
            quantity: d.quantity,
            rate: d.rate,
            amount: d.amount,
            serialNumber: d.serialNumber,
            batchNumber: d.batchNumber,
            condition: d.condition,
            fromLocationId: d.toLocationId,
            toLocationId: d.fromLocationId,
            remarks: `Reversal of ${header.voucherNo}`,
          })),
        });

        const ledgerReversals: Array<Record<string, unknown>> = [];
        for (const d of details) {
          if (header.fromStoreId) {
            ledgerReversals.push({
              companyId: header.companyId, financialYearId: header.financialYearId,
              transactionId: rvHeader.id, itemId: d.itemId, storeId: header.fromStoreId,
              locationId: header.fromLocationId || null,
              voucherNo: reversalVoucherNo, voucherType: 'RV', movementType: 'REVERSAL',
              quantityIn: new Prisma.Decimal(Number(d.quantity)), quantityOut: new Prisma.Decimal(0),
              balanceQty: new Prisma.Decimal(0), rate: new Prisma.Decimal(Number(d.rate || 0)),
              condition: d.condition || 'GOOD', serialNumber: d.serialNumber, batchNumber: d.batchNumber,
              transactionDate: new Date(), createdBy: 'system-delete',
            });
          }
          if (header.toStoreId) {
            ledgerReversals.push({
              companyId: header.companyId, financialYearId: header.financialYearId,
              transactionId: rvHeader.id, itemId: d.itemId, storeId: header.toStoreId,
              locationId: header.toLocationId || null,
              voucherNo: reversalVoucherNo, voucherType: 'RV', movementType: 'REVERSAL',
              quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(Number(d.quantity)),
              balanceQty: new Prisma.Decimal(0), rate: new Prisma.Decimal(Number(d.rate || 0)),
              condition: d.condition || 'GOOD', serialNumber: d.serialNumber, batchNumber: d.batchNumber,
              transactionDate: new Date(), createdBy: 'system-delete',
            });
          }
        }
        if (ledgerReversals.length > 0) {
          await tx.ledgerEntry.createMany({ data: ledgerReversals });

          const affectedPairs = ledgerReversals.map((e) => ({ itemId: e.itemId as number, storeId: e.storeId as number }));
          const uniquePairs = [...new Map(affectedPairs.map((p) => [`${p.itemId}-${p.storeId}`, p])).values()];
          for (const pair of uniquePairs) {
            const allEntries = await tx.ledgerEntry.findMany({
              where: { companyId: header.companyId, financialYearId: header.financialYearId, itemId: pair.itemId, storeId: pair.storeId },
              orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, quantityIn: true, quantityOut: true },
            });
            let runningBalance = 0;
            const updates: Array<{ id: number; balanceQty: Prisma.Decimal }> = [];
            for (const entry of allEntries) {
              runningBalance += Number(entry.quantityIn) - Number(entry.quantityOut);
              updates.push({ id: entry.id, balanceQty: new Prisma.Decimal(runningBalance) });
            }
            for (const u of updates) {
              await tx.ledgerEntry.update({ where: { id: u.id }, data: { balanceQty: u.balanceQty } });
            }
          }
        }

        await tx.transactionHeader.update({ where: { id: txId }, data: { approvalStatus: 'CANCELLED' } });
      });
    }

    await prisma.materialConsumptionItem.deleteMany({ where: { materialDemandItemId: { in: demandItemIds } } });
    await prisma.demandAllocation.deleteMany({ where: { materialDemandItemId: { in: demandItemIds } } });
    await prisma.materialDemandItem.deleteMany({ where: { serviceRequestId } });
    await prisma.serviceRequest.delete({ where: { id: serviceRequestId } });
    return { success: true, cancelledTransactions: uniqueTransactionIds.length };
  }
}
