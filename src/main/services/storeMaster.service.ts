import { PrismaClient } from '@prisma/client';

export interface CreateStoreInput {
  companyId: number;
  name: string;
  code?: string;
  storeType: 'MAIN_STORE' | 'DEPARTMENT_STORE' | 'DHARMSHALA_STORE';
  parentStoreId?: number;
  departmentId?: number;
}

export interface UpdateStoreInput {
  name?: string;
  code?: string;
  storeType?: string;
  parentStoreId?: number | null;
  departmentId?: number | null;
  isActive?: boolean;
}

export class StoreMasterService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateStoreInput) {
    const existing = await this.prisma.store.findFirst({
      where: { companyId: data.companyId, name: data.name },
    });
    if (existing) throw new Error(`Store "${data.name}" already exists`);

    if (data.parentStoreId) {
      const parent = await this.prisma.store.findUnique({ where: { id: data.parentStoreId } });
      if (!parent) throw new Error('Parent store not found');
      if (parent.companyId !== data.companyId) throw new Error('Parent store must be in the same company');
    }

    return this.prisma.store.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        storeType: data.storeType,
        parentStoreId: data.parentStoreId || null,
        departmentId: data.departmentId || null,
      },
    });
  }

  async update(id: number, data: UpdateStoreInput) {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    if (!existing) throw new Error('Store not found');

    if (data.name && data.name !== existing.name) {
      const duplicate = await this.prisma.store.findFirst({
        where: { companyId: existing.companyId, name: data.name, id: { not: id } },
      });
      if (duplicate) throw new Error(`Store "${data.name}" already exists`);
    }

    if (data.parentStoreId === id) {
      throw new Error('Store cannot be its own parent');
    }

    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  async getById(id: number) {
    return this.prisma.store.findUnique({
      where: { id },
      include: {
        parentStore: true,
        childStores: true,
        locations: true,
        ledgers: true,
        transactionsFrom: true,
        transactionsTo: true,
        serializedItems: true,
        assetInstallations: true,
      },
    });
  }

  async list(companyId: number, storeType?: string) {
    const where: any = { companyId };
    if (storeType) where.storeType = storeType;

    return this.prisma.store.findMany({
      where,
      include: {
        parentStore: { select: { id: true, name: true, storeType: true } },
        childStores: { select: { id: true, name: true, storeType: true } },
        _count: {
          select: {
            locations: true,
            assetInstallations: true,
          },
        },
      },
      orderBy: [{ storeType: 'asc' }, { name: 'asc' }],
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assetInstallations: true,
            ledgers: true,
            transactionsTo: true,
            transactionsFrom: true,
            goodsReceipts: true,
            serializedItems: true,
            destRequisitions: true,
            sourceRequisitions: true,
            categories: true,
          },
        },
      },
    });
    if (!existing) throw new Error('Store not found');

    const blockers: string[] = [];

    if (existing._count.ledgers > 0) {
      blockers.push(`${existing._count.ledgers} ledger entries`);
    }
    if (existing._count.transactionsTo > 0) {
      blockers.push(`${existing._count.transactionsTo} incoming transactions`);
    }
    if (existing._count.transactionsFrom > 0) {
      blockers.push(`${existing._count.transactionsFrom} outgoing transactions`);
    }
    if (existing._count.goodsReceipts > 0) {
      blockers.push(`${existing._count.goodsReceipts} goods receipts`);
    }
    if (existing._count.serializedItems > 0) {
      blockers.push(`${existing._count.serializedItems} serialized items`);
    }
    if (existing._count.destRequisitions > 0) {
      blockers.push(`${existing._count.destRequisitions} destination requisitions`);
    }
    if (existing._count.sourceRequisitions > 0) {
      blockers.push(`${existing._count.sourceRequisitions} source requisitions`);
    }
    if (existing._count.assetInstallations > 0) {
      blockers.push(`${existing._count.assetInstallations} installed assets`);
    }
    if (existing._count.categories > 0) {
      blockers.push(`${existing._count.categories} item categories`);
    }

    if (blockers.length > 0) {
      throw new Error(
        `Cannot delete store "${existing.name}": has existing data (${blockers.join(', ')}). Deactivate instead.`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.location.deleteMany({ where: { storeId: id } });
      return tx.store.delete({ where: { id } });
    });
  }

  async getMainStores(companyId: number) {
    return this.prisma.store.findMany({
      where: { companyId, storeType: 'MAIN_STORE', isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getStoresByType(companyId: number, storeType: string) {
    return this.prisma.store.findMany({
      where: { companyId, storeType, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getStoreHierarchy(companyId: number) {
    const stores = await this.prisma.store.findMany({
      where: { companyId, parentStoreId: null, isActive: true },
      include: {
        childStores: {
          include: {
            childStores: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return stores;
  }
}
