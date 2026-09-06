import { PrismaClient } from '@prisma/client';
import { TransactionEngine, CreateTransactionInput } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';

export type ShiftType = 'DS' | 'DP';

export class ShiftChallanService {
  private transactionEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.transactionEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  private async validateLocationIds(
    items: Array<{
      itemId: number;
      quantity: number;
      rate?: number;
      fromLocationId?: number;
      toLocationId?: number;
      remarks?: string;
    }>,
    fromStoreId?: number,
    toStoreId?: number,
  ) {
    const locationIds = new Set<number>();
    for (const item of items) {
      if (item.fromLocationId) locationIds.add(item.fromLocationId);
      if (item.toLocationId) locationIds.add(item.toLocationId);
    }
    if (locationIds.size === 0) return items;

    const locations = await this.prisma.location.findMany({
      where: { id: { in: [...locationIds] } },
      select: { id: true, storeId: true, locationType: true, name: true, isActive: true },
    });
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    const missingLocations = [...locationIds].filter((id) => !locationMap.has(id));
    if (missingLocations.length > 0) {
      throw new Error(`Location(s) not found: ${missingLocations.join(', ')}`);
    }

    const inactiveLocations = [...locationIds].filter((id) => {
      const loc = locationMap.get(id);
      return loc && !loc.isActive;
    });
    if (inactiveLocations.length > 0) {
      const names = inactiveLocations.map((id) => locationMap.get(id)?.name || `ID ${id}`);
      throw new Error(`Source/destination location is inactive: ${names.join(', ')}`);
    }

    const nonRoomLocations = [...locationIds].filter((id) => {
      const loc = locationMap.get(id);
      return loc && loc.locationType !== 'Room';
    });
    if (nonRoomLocations.length > 0) {
      const names = nonRoomLocations.map((id) => {
        const loc = locationMap.get(id);
        return `${loc?.name || `ID ${id}`} (type: ${loc?.locationType})`;
      });
      throw new Error(`Expected Room-type locations but got: ${names.join(', ')}`);
    }

    const sourceLocationIds = new Set(items.filter((i) => i.fromLocationId).map((i) => i.fromLocationId!));
    const destLocationIds = new Set(items.filter((i) => i.toLocationId).map((i) => i.toLocationId!));

    for (const locId of locationIds) {
      const loc = locationMap.get(locId)!;
      if (sourceLocationIds.has(locId) && fromStoreId && loc.storeId !== fromStoreId) {
        throw new Error(`Source location "${loc.name}" does not belong to source store`);
      }
      if (destLocationIds.has(locId) && toStoreId && loc.storeId !== toStoreId) {
        throw new Error(`Destination location "${loc.name}" does not belong to destination store`);
      }
    }

    return items;
  }

  private async validateShift(data: {
    shiftType: ShiftType;
    fromStoreId: number;
    toStoreId: number;
    items?: Array<{ itemId: number; quantity: number; fromLocationId?: number; toLocationId?: number }>;
  }) {
    const fromStore = await this.prisma.store.findUnique({ where: { id: data.fromStoreId } });
    const toStore = await this.prisma.store.findUnique({ where: { id: data.toStoreId } });

    if (!fromStore) throw new Error(`Source store not found (id: ${data.fromStoreId})`);
    if (!toStore) throw new Error(`Destination store not found (id: ${data.toStoreId})`);
    if (!fromStore.isActive) throw new Error(`Source store "${fromStore.name}" is inactive`);
    if (!toStore.isActive) throw new Error(`Destination store "${toStore.name}" is inactive`);

    const hasLocationIds = data.items?.some(
      (i) => i.fromLocationId || i.toLocationId
    ) ?? false;

    if (data.shiftType === 'DS') {
      const validTypes = ['DHARMSHALA_STORE', 'ROOM'];
      if (!validTypes.includes(fromStore.storeType)) {
        throw new Error(`DS source must be a Dharmshala Store or Room, got "${fromStore.storeType}"`);
      }
      if (!validTypes.includes(toStore.storeType)) {
        throw new Error(`DS destination must be a Dharmshala Store or Room, got "${toStore.storeType}"`);
      }
      if (fromStore.storeType === 'DHARMSHALA_STORE' && toStore.storeType === 'DHARMSHALA_STORE' && !hasLocationIds) {
        throw new Error('Store-to-Store transfer is handled through Transfer Challan (TC). Please use TC for this movement.');
      }
    }

    if (data.shiftType === 'DP') {
      const validTypes = ['DEPARTMENT_STORE', 'DEPARTMENT_LOCATION'];
      if (!validTypes.includes(fromStore.storeType)) {
        throw new Error(`DP source must be a Department Store or Department Location, got "${fromStore.storeType}"`);
      }
      if (!validTypes.includes(toStore.storeType)) {
        throw new Error(`DP destination must be a Department Store or Department Location, got "${toStore.storeType}"`);
      }
      if (fromStore.storeType === 'DEPARTMENT_STORE' && toStore.storeType === 'DEPARTMENT_STORE' && !hasLocationIds) {
        throw new Error('Store-to-Store transfer is handled through Transfer Challan (TC). Please use TC for this movement.');
      }
    }

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (item.quantity <= 0) {
          throw new Error(`Invalid quantity ${item.quantity} for item ${item.itemId}: must be greater than zero`);
        }
        if (item.fromLocationId && item.toLocationId && item.fromLocationId === item.toLocationId) {
          throw new Error(`Source and destination room cannot be the same (Room ID ${item.fromLocationId})`);
        }
      }
    }
  }

  async create(data: {
    companyId: number;
    financialYearId: number;
    shiftType: ShiftType;
    date: Date;
    fromStoreId: number;
    toStoreId: number;
    shiftedBy: string;
    approvedBy?: string;
    remarks?: string;
    items: Array<{
      itemId: number;
      quantity: number;
      rate?: number;
      fromLocationId?: number;
      toLocationId?: number;
      remarks?: string;
      serialNumber?: string | null;
    }>;
  }) {
    await this.validateShift({ ...data, items: data.items });
    const validatedItems = await this.validateLocationIds(data.items, data.fromStoreId, data.toStoreId);

    const input: CreateTransactionInput = {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType: data.shiftType,
      transactionDate: data.date,
      fromStoreId: data.fromStoreId,
      toStoreId: data.toStoreId,
      issuedBy: data.shiftedBy,
      receivedBy: data.approvedBy,
      remarks: data.remarks,
      createdBy: data.shiftedBy,
      initialStatus: 'DRAFT',
      items: validatedItems.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        fromLocationId: item.fromLocationId,
        toLocationId: item.toLocationId,
        remarks: item.remarks,
        serialNumber: item.serialNumber || null,
      })),
    };

    return await this.transactionEngine.createTransaction(input);
  }

  async post(id: number) {
    const header = await this.prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: { include: { item: true } } },
    });
    if (!header) throw new Error('Shift challan not found');
    if (header.approvalStatus !== 'DRAFT') {
      throw new Error(`Only draft challans can be posted (current status: ${header.approvalStatus})`);
    }

    await this.transactionEngine.postTransaction(id);

    const itemsForInstall = header.details.map((d) => ({
      itemId: d.itemId,
      quantity: Number(d.quantity),
      fromLocationId: d.fromLocationId ?? undefined,
      toLocationId: d.toLocationId ?? undefined,
      serialNumber: d.serialNumber ?? undefined,
    }));

    await this.handleAssetInstallations(
      header.companyId,
      header.financialYearId,
      id,
      itemsForInstall,
      header.toStoreId!,
      header.transactionDate,
      header.createdBy || 'system',
      header.fromStoreId!,
    );

    return { success: true, voucherNo: header.voucherNo };
  }

  async delete(id: number) {
    const header = await this.prisma.transactionHeader.findUnique({ where: { id } });
    if (!header) throw new Error('Shift challan not found');
    if (header.approvalStatus === 'POSTED') {
      throw new Error('Cannot delete a posted challan. Cancel it first.');
    }
    if (header.approvalStatus === 'REVERSED') {
      throw new Error('Cannot delete a reversed challan.');
    }
    if (header.approvalStatus === 'CANCELLED') {
      throw new Error('Cannot delete a cancelled challan.');
    }

    await this.deactivateAssetInstallations(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
      await tx.transactionHeader.delete({ where: { id } });
    });

    return { success: true };
  }

  async update(id: number, data: {
    companyId: number;
    financialYearId: number;
    shiftType: ShiftType;
    date: Date;
    fromStoreId: number;
    toStoreId: number;
    shiftedBy: string;
    approvedBy?: string;
    remarks?: string;
    items: Array<{
      itemId: number;
      quantity: number;
      rate?: number;
      fromLocationId?: number;
      toLocationId?: number;
      remarks?: string;
      serialNumber?: string | null;
    }>;
  }) {
    const existing = await this.prisma.transactionHeader.findUnique({ where: { id } });
    if (!existing) throw new Error('Shift challan not found');
    if (existing.approvalStatus !== 'DRAFT') {
      throw new Error(`Only draft challans can be edited (current status: ${existing.approvalStatus})`);
    }

    await this.validateShift({ ...data, items: data.items });
    const validatedItems = await this.validateLocationIds(data.items, data.fromStoreId, data.toStoreId);

    await this.prisma.$transaction(async (tx) => {
      await tx.transactionHeader.update({
        where: { id },
        data: {
          transactionDate: data.date,
          fromStoreId: data.fromStoreId,
          toStoreId: data.toStoreId,
          issuedBy: data.shiftedBy,
          receivedBy: data.approvedBy || null,
          remarks: data.remarks,
        },
      });

      await tx.transactionDetail.deleteMany({ where: { transactionId: id } });

      if (validatedItems.length > 0) {
        await tx.transactionDetail.createMany({
          data: validatedItems.map((item) => ({
            transactionId: id,
            itemId: item.itemId,
            quantity: item.quantity,
            rate: item.rate || 0,
            amount: (item.rate || 0) * item.quantity,
            fromLocationId: item.fromLocationId || null,
            toLocationId: item.toLocationId || null,
            remarks: item.remarks || null,
            serialNumber: item.serialNumber || null,
          })),
        });
      }
    });

    return { success: true, id };
  }

  async cancel(id: number, reason: string, cancelledBy: string) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const original = await this.prisma.transactionHeader.findUnique({ where: { id } });
    if (!original) throw new Error('Shift challan not found');
    if (original.voucherType === 'RV') {
      throw new Error('Cannot cancel a reversal transaction');
    }
    if (original.approvalStatus !== 'POSTED') {
      throw new Error(`Only posted challans can be cancelled (current status: ${original.approvalStatus})`);
    }

    const details = await this.prisma.transactionDetail.findMany({
      where: { transactionId: id },
    });

    const result = await this.transactionEngine.reverseAndCancel({
      companyId: original.companyId,
      financialYearId: original.financialYearId,
      transactionDate: new Date(),
      fromStoreId: original.toStoreId,
      toStoreId: original.fromStoreId,
      remarks: `Reversal for cancelled ${original.voucherNo}: ${reason}`,
      createdBy: cancelledBy,
      items: details.map((d) => ({
        itemId: d.itemId,
        quantity: Number(d.quantity),
        rate: Number(d.rate || 0),
        serialNumber: d.serialNumber || null,
        fromLocationId: d.fromLocationId || undefined,
        toLocationId: d.toLocationId || undefined,
      })),
    }, id, reason);

    await this.deactivateAssetInstallations(id);

    return result;
  }

  async findAll(companyId: number, financialYearId: number, shiftType: ShiftType) {
    return this.prisma.transactionHeader.findMany({
      where: {
        companyId,
        financialYearId,
        voucherType: shiftType,
      },
      include: {
        fromStore: true,
        toStore: true,
        details: {
          include: { item: true, fromLocation: true, toLocation: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async findById(id: number) {
    return this.prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        details: {
          include: { item: true, fromLocation: true, toLocation: true },
        },
        ledgers: true,
      },
    });
  }

  /**
   * Ensure a Room bridge record exists for a Room-type Location.
   * Returns the Room.id. Creates the Room if it doesn't exist.
   * Safe against duplicate creation (find-or-create).
   */
  private async ensureRoomForLocation(locationId: number): Promise<number> {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw new Error(`Location not found: ${locationId}`);
    if (location.locationType !== 'Room') throw new Error(`Location ${locationId} is not a Room (type: ${location.locationType})`);

    const existing = await this.prisma.room.findFirst({
      where: { locationId: location.id, name: location.name },
    });
    if (existing) return existing.id;

    const created = await this.prisma.room.create({
      data: { locationId: location.id, name: location.name, isActive: true },
    });
    return created.id;
  }

  private async handleAssetInstallations(
    companyId: number,
    financialYearId: number,
    transactionId: number,
    items: Array<{
      itemId: number;
      quantity: number;
      fromLocationId?: number;
      toLocationId?: number;
      serialNumber?: string | null;
    }>,
    toStoreId: number,
    transactionDate: Date,
    createdBy: string,
    fromStoreId: number,
  ) {
    const itemIds = items.map(i => i.itemId);
    if (itemIds.length === 0) return;

    const allLocationIds = [
      ...items.filter(i => i.fromLocationId).map(i => i.fromLocationId!),
      ...items.filter(i => i.toLocationId).map(i => i.toLocationId!),
    ];
    const uniqueLocationIds = [...new Set(allLocationIds)];

    // Ensure Room bridge records exist for all destination Room-type Locations
    for (const locId of uniqueLocationIds) {
      const location = await this.prisma.location.findUnique({ where: { id: locId } });
      if (location && location.locationType === 'Room') {
        await this.ensureRoomForLocation(locId);
      }
    }

    const locationToRoomIds = new Map<number, number[]>();
    if (uniqueLocationIds.length > 0) {
      const rooms = await this.prisma.room.findMany({
        where: { locationId: { in: uniqueLocationIds } },
        select: { id: true, locationId: true },
      });
      for (const locId of uniqueLocationIds) {
        locationToRoomIds.set(locId, rooms.filter(r => r.locationId === locId).map(r => r.id));
      }
    }

    for (const item of items) {
      if (item.fromLocationId) {
        const sourceRoomIds = locationToRoomIds.get(item.fromLocationId) || [];
        const sourceInstallations = await this.prisma.assetInstallation.findMany({
          where: {
            itemId: item.itemId,
            roomId: { in: sourceRoomIds },
            storeId: fromStoreId,
            status: 'ACTIVE',
          },
          orderBy: { id: 'asc' },
        });

        let remaining = Number(item.quantity);
        for (const inst of sourceInstallations) {
          if (remaining <= 0) break;
          const instQty = Number(inst.quantity);
          if (instQty <= remaining) {
            remaining -= instQty;
            await this.prisma.assetInstallation.update({
              where: { id: inst.id },
              data: {
                status: 'INACTIVE',
                uninstalledDate: transactionDate,
                remarks: `Shifted via ${transactionId}`,
              },
            });
          } else {
            await this.prisma.assetInstallation.update({
              where: { id: inst.id },
              data: {
                quantity: { decrement: remaining },
                remarks: `Partial shift via ${transactionId}`,
              },
            });
            remaining = 0;
          }
        }
      }

      if (item.toLocationId) {
        const destRoomIds = locationToRoomIds.get(item.toLocationId) || [];
        const existing = await this.prisma.assetInstallation.findFirst({
          where: {
            itemId: item.itemId,
            roomId: { in: destRoomIds },
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
          const targetRoomId = destRoomIds[0];
          if (targetRoomId) {
            await this.prisma.assetInstallation.create({
              data: {
                itemId: item.itemId,
                roomId: targetRoomId,
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
    }
  }

  private async deactivateAssetInstallations(transactionId: number) {
    const details = await this.prisma.transactionDetail.findMany({
      where: { transactionId },
    });

    const header = await this.prisma.transactionHeader.findUnique({
      where: { id: transactionId },
    });
    if (!header) return;

    for (const detail of details) {
      if (detail.toLocationId) {
        const destRooms = await this.prisma.room.findMany({
          where: { locationId: detail.toLocationId },
          select: { id: true },
        });
        const destRoomIds = destRooms.map(r => r.id);

        const destInstallations = await this.prisma.assetInstallation.findMany({
          where: {
            itemId: detail.itemId,
            roomId: { in: destRoomIds },
            storeId: header.toStoreId!,
            status: 'ACTIVE',
          },
          orderBy: { id: 'asc' },
        });

        let remaining = Number(detail.quantity);
        for (const inst of destInstallations) {
          if (remaining <= 0) break;
          const instQty = Number(inst.quantity);
          if (instQty <= remaining) {
            remaining -= instQty;
            await this.prisma.assetInstallation.update({
              where: { id: inst.id },
              data: {
                status: 'INACTIVE',
                uninstalledDate: new Date(),
                remarks: `Shift ${header.voucherNo} cancelled`,
              },
            });
          } else {
            await this.prisma.assetInstallation.update({
              where: { id: inst.id },
              data: { quantity: { decrement: remaining } },
            });
            remaining = 0;
          }
        }
      }

      if (detail.fromLocationId) {
        const sourceRooms = await this.prisma.room.findMany({
          where: { locationId: detail.fromLocationId },
          select: { id: true },
        });
        const sourceRoomIds = sourceRooms.map(r => r.id);

        const deactivatedSources = await this.prisma.assetInstallation.findMany({
          where: {
            itemId: detail.itemId,
            roomId: { in: sourceRoomIds },
            storeId: header.fromStoreId!,
            status: 'INACTIVE',
            remarks: { contains: `Shifted via ${transactionId}` },
          },
        });

        for (const inst of deactivatedSources) {
          await this.prisma.assetInstallation.update({
            where: { id: inst.id },
            data: {
              status: 'ACTIVE',
              uninstalledDate: null,
              remarks: null,
            },
          });
        }

        const partialSources = await this.prisma.assetInstallation.findMany({
          where: {
            itemId: detail.itemId,
            roomId: { in: sourceRoomIds },
            storeId: header.fromStoreId!,
            status: 'ACTIVE',
            remarks: { contains: `Partial shift via ${transactionId}` },
          },
        });

        for (const inst of partialSources) {
          await this.prisma.assetInstallation.update({
            where: { id: inst.id },
            data: {
              quantity: { increment: Number(detail.quantity) },
              remarks: null,
            },
          });
        }
      }
    }
  }
}
