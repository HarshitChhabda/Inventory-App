import { PrismaClient } from '@prisma/client';

export interface CreateLocationInput {
  storeId: number;
  name: string;
  locationType: string;
  code?: string;
  parentId?: number;
}

export interface UpdateLocationInput {
  name?: string;
  locationType?: string;
  code?: string;
  parentId?: number | null;
  isActive?: boolean;
}

export class LocationMasterService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateLocationInput) {
    const store = await this.prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store) throw new Error('Store not found');

    if (data.parentId) {
      const parent = await this.prisma.location.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new Error('Parent location not found');
    }

    return this.prisma.location.create({
      data: {
        storeId: data.storeId,
        name: data.name,
        locationType: data.locationType,
        code: data.code,
        parentId: data.parentId,
      },
    });
  }

  async update(id: number, data: UpdateLocationInput) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) throw new Error('Location not found');
    if (data.parentId === id) throw new Error('Location cannot be its own parent');

    return this.prisma.location.update({ where: { id }, data });
  }

  async getById(id: number) {
    return this.prisma.location.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        store: { select: { id: true, name: true, storeType: true } },
        rooms: { include: { installations: true } },
        _count: { select: { rooms: true } },
      },
    });
  }

  async list(companyId: number, locationType?: string, storeId?: number) {
    const where: any = {};
    if (locationType) where.locationType = locationType;
    if (storeId) where.storeId = storeId;

    return this.prisma.location.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, storeType: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { rooms: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.location.findUnique({
      where: { id },
      include: { _count: { select: { children: true, rooms: true, ledgers: true, assets: true, transactionsTo: true, transactionsFrom: true } } },
    });
    if (!existing) throw new Error('Location not found');
    if (existing._count.children > 0) throw new Error('Cannot delete location with child locations');
    if (existing._count.rooms > 0) throw new Error('Cannot delete location with rooms');

    const blockers: string[] = [];

    if (existing._count.ledgers > 0) {
      blockers.push(`${existing._count.ledgers} ledger entries`);
    }
    if (existing._count.assets > 0) {
      blockers.push(`${existing._count.assets} asset(s)`);
    }
    if (existing._count.transactionsTo > 0) {
      blockers.push(`${existing._count.transactionsTo} incoming transaction(s)`);
    }
    if (existing._count.transactionsFrom > 0) {
      blockers.push(`${existing._count.transactionsFrom} outgoing transaction(s)`);
    }

    // Check TransactionDetail references (fromLocationId / toLocationId)
    // TransactionDetail has these fields but no Prisma @relation, so we query directly
    const txDetailFromCount = await (this.prisma as any).transactionDetail.count({
      where: { fromLocationId: id },
    });
    if (txDetailFromCount > 0) {
      blockers.push(`${txDetailFromCount} transaction detail(s) as source`);
    }

    const txDetailToCount = await (this.prisma as any).transactionDetail.count({
      where: { toLocationId: id },
    });
    if (txDetailToCount > 0) {
      blockers.push(`${txDetailToCount} transaction detail(s) as destination`);
    }

    // Check AssetInstallation references (roomId → Location via Room)
    // AssetInstallation references Room, not Location directly. Room deletion is already blocked above.

    if (blockers.length > 0) {
      throw new Error(`Cannot delete location: has existing records (${blockers.join(', ')}). Deactivate instead.`);
    }

    return this.prisma.location.delete({ where: { id } });
  }

  async getHierarchy(companyId: number) {
    return this.prisma.location.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
