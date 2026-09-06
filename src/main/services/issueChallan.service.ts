import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import { MaterialDemandService } from './materialDemand.service';
import type { CreateTransactionInput } from '../../shared/types';

export class IssueChallanService {
  private transactionEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.transactionEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  async create(data: {
    companyId: number;
    financialYearId: number;
    date: Date;
    fromStoreId: number;
    toStoreId: number;
    issuedBy: string;
    purpose?: string;
    remarks?: string;
    createdBy: string;
    serviceRequestId?: number;
    demandAllocations?: Array<{ demandItemId: number; quantityAllocated: number }>;
    items: Array<{
      itemId: number;
      quantity: number;
      rate?: number;
      unitId?: number;
      toLocationId?: number;
      remarks?: string;
    }>;
  }) {
    const input: CreateTransactionInput = {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType: 'IC',
      transactionDate: data.date,
      fromStoreId: data.fromStoreId,
      toStoreId: data.toStoreId,
      issuedBy: data.issuedBy,
      purpose: data.purpose,
      remarks: data.remarks,
      createdBy: data.createdBy,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        unitId: item.unitId,
        toLocationId: item.toLocationId,
        remarks: item.remarks,
      })),
    };

    const result = await this.transactionEngine.createTransaction(input);

    if (data.serviceRequestId && data.demandAllocations && data.demandAllocations.length > 0) {
      await MaterialDemandService.createAllocations(
        data.serviceRequestId,
        result.transactionId,
        data.demandAllocations,
      );
    }

    await this.handleAssetInstallations(
      data.companyId,
      data.financialYearId,
      result.transactionId,
      data.items,
      data.toStoreId,
      data.date,
      data.createdBy,
    );

    return result;
  }

  async post(
    transactionId: number,
    companyId: number,
    financialYearId: number,
  ) {
    const header = await this.prisma.transactionHeader.findUnique({
      where: { id: transactionId },
      include: { details: true },
    });
    if (!header) throw new Error('Issue challan not found');
    if (header.approvalStatus !== 'DRAFT') {
      throw new Error(`Challan is not in Draft status (current: ${header.approvalStatus})`);
    }

    await this.transactionEngine.postTransaction(transactionId);

    await this.handleAssetInstallations(
      companyId,
      financialYearId,
      transactionId,
      header.details.map((d) => ({
        itemId: d.itemId,
        quantity: Number(d.quantity),
        toLocationId: d.toLocationId ?? undefined,
      })),
      header.toStoreId!,
      header.transactionDate,
      header.createdBy,
    );

    return this.findById(transactionId);
  }

  async cancel(
    transactionId: number,
    companyId: number,
    financialYearId: number,
    reason: string,
    cancelledBy: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const header = await this.prisma.transactionHeader.findUnique({
      where: { id: transactionId },
    });
    if (!header) throw new Error('Issue challan not found');
    if (header.voucherType === 'RV') {
      throw new Error('Cannot cancel a reversal transaction');
    }
    if (header.approvalStatus !== 'POSTED') {
      throw new Error(`Only posted challans can be cancelled (current status: ${header.approvalStatus})`);
    }

    const linkedConsumptions = await this.prisma.materialConsumptionItem.findMany({
      where: { transactionHeaderId: transactionId, materialConsumption: { status: 'POSTED' } },
      include: { materialConsumption: true },
    });
    if (linkedConsumptions.length > 0) {
      const consumptionNos = [...new Set(linkedConsumptions.map((c) => c.materialConsumption.consumptionNumber))].join(', ');
      throw new Error(`Cannot cancel: linked consumption records exist (${consumptionNos}). Reverse consumption first.`);
    }

    const details = await this.prisma.transactionDetail.findMany({
      where: { transactionId },
    });

    const result = await this.transactionEngine.reverseAndCancel({
      companyId,
      financialYearId,
      transactionDate: new Date(),
      fromStoreId: header.fromStoreId,
      toStoreId: header.fromStoreId,
      remarks: `Reversal for cancelled ${header.voucherNo}: ${reason}`,
      createdBy: cancelledBy,
      items: details.map((d) => ({
        itemId: d.itemId,
        quantity: Number(d.quantity),
        rate: Number(d.rate || 0),
        serialNumber: d.serialNumber || null,
      })),
    }, transactionId, reason);

    await MaterialDemandService.reverseAllocationsForTransaction(transactionId);

    await this.deactivateAssetInstallations(transactionId);

    return result;
  }

  async findAll(
    companyId: number,
    financialYearId: number,
    options?: {
      status?: string;
      fromStoreId?: number;
      toStoreId?: number;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where: any = {
      companyId,
      financialYearId,
      voucherType: 'IC',
    };

    if (options?.status) {
      where.approvalStatus = options.status;
    }
    if (options?.fromStoreId) {
      where.fromStoreId = options.fromStoreId;
    }
    if (options?.toStoreId) {
      where.toStoreId = options.toStoreId;
    }
    if (options?.search) {
      where.OR = [
        { voucherNo: { contains: options.search } },
        { issuedBy: { contains: options.search } },
        { purpose: { contains: options.search } },
        { remarks: { contains: options.search } },
      ];
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.transactionHeader.findMany({
        where,
        include: {
          fromStore: true,
          toStore: true,
          details: { include: { item: true } },
          demandAllocations: {
            include: {
              materialDemandItem: {
                include: { serviceRequest: { select: { id: true, requestNumber: true } } },
              },
            },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.transactionHeader.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number) {
    return this.prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        details: { include: { item: true } },
        ledgers: true,
        demandAllocations: {
          include: {
            materialDemandItem: {
              include: { serviceRequest: { select: { id: true, requestNumber: true } } },
            },
          },
        },
      },
    });
  }

  private async handleAssetInstallations(
    companyId: number,
    financialYearId: number,
    transactionId: number,
    items: Array<{
      itemId: number;
      quantity: number;
      toLocationId?: number;
    }>,
    toStoreId: number,
    transactionDate: Date,
    createdBy: string,
  ) {
    const itemIds = items.filter(i => i.toLocationId).map(i => i.itemId);
    if (itemIds.length === 0) return;

    const itemRecords = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, itemType: true, isSerialized: true },
    });
    const itemMap = new Map(itemRecords.map(r => [r.id, r]));

    const locationIds = [...new Set(items.filter(i => i.toLocationId).map(i => i.toLocationId!))];
    const locationToRoomId = new Map<number, number>();
    for (const locId of locationIds) {
      const roomId = await this.ensureRoomForLocation(locId);
      locationToRoomId.set(locId, roomId);
    }

    for (const item of items) {
      if (!item.toLocationId) continue;

      const itemRecord = itemMap.get(item.itemId);
      const isAsset = itemRecord?.itemType === 'ASSET' || itemRecord?.isSerialized === true;
      if (!isAsset) continue;

      const roomId = locationToRoomId.get(item.toLocationId);
      if (!roomId) continue;

      const existing = await this.prisma.assetInstallation.findFirst({
        where: {
          itemId: item.itemId,
          roomId,
          storeId: toStoreId,
          status: 'ACTIVE',
        },
      });

      if (existing) {
        await this.prisma.assetInstallation.update({
          where: { id: existing.id },
          data: { quantity: { increment: item.quantity } },
        });
      } else {
        await this.prisma.assetInstallation.create({
          data: {
            itemId: item.itemId,
            roomId,
            storeId: toStoreId,
            quantity: item.quantity,
            installedDate: transactionDate,
            installedBy: createdBy,
            status: 'ACTIVE',
          },
        });
      }
    }
  }

  private async deactivateAssetInstallations(transactionId: number) {
    const details = await this.prisma.transactionDetail.findMany({
      where: { transactionId },
    });

    for (const detail of details) {
      if (!detail.toLocationId) continue;

      const header = await this.prisma.transactionHeader.findUnique({
        where: { id: transactionId },
      });
      if (!header) continue;

      const location = await this.prisma.location.findUnique({ where: { id: detail.toLocationId } });
      if (!location || location.locationType !== 'Room') continue;

      const room = await this.prisma.room.findFirst({
        where: { locationId: location.id, name: location.name },
      });
      if (!room) continue;

      const installations = await this.prisma.assetInstallation.findMany({
        where: {
          itemId: detail.itemId,
          roomId: room.id,
          storeId: header.toStoreId!,
          status: 'ACTIVE',
        },
      });

      for (const inst of installations) {
        await this.prisma.assetInstallation.update({
          where: { id: inst.id },
          data: {
            status: 'INACTIVE',
            uninstalledDate: new Date(),
            remarks: `Issue challan ${header.voucherNo} cancelled`,
          },
        });
      }
    }
  }

  private async ensureRoomForLocation(locationId: number): Promise<number> {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw new Error(`Location not found: ${locationId}`);
    if (location.locationType !== 'Room') throw new Error(`Location ${locationId} is not a Room`);

    const existing = await this.prisma.room.findFirst({
      where: { locationId: location.id, name: location.name },
    });
    if (existing) return existing.id;

    const created = await this.prisma.room.create({
      data: { locationId: location.id, name: location.name, isActive: true },
    });
    return created.id;
  }
}
