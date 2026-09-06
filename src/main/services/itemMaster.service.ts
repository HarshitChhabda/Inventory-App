import { PrismaClient, Prisma } from '@prisma/client';

export interface CreateItemInput {
  companyId: number;
  itemCode: string;
  itemName: string;
  categoryId: number;
  subCategoryId?: number;
  brandId?: number;
  unitId: number;
  minimumStockLevel?: number;
  maximumStockLevel?: number;
  itemType?: string;
  isSerialized?: boolean;
  hasWarranty?: boolean;
  warrantyMonths?: number;
  hsnCode?: string;
  description?: string;
}

export interface UpdateItemInput {
  itemName?: string;
  categoryId?: number;
  subCategoryId?: number;
  brandId?: number;
  unitId?: number;
  minimumStockLevel?: number;
  maximumStockLevel?: number;
  itemType?: string;
  isSerialized?: boolean;
  hasWarranty?: boolean;
  warrantyMonths?: number;
  hsnCode?: string;
  description?: string;
  isActive?: boolean;
}

export class ItemMasterService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateItemInput) {
    const existing = await this.prisma.item.findUnique({ where: { itemCode: data.itemCode } });
    if (existing) throw new Error(`Item with code "${data.itemCode}" already exists`);

    const category = await this.prisma.itemCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error('Category not found');

    const unit = await this.prisma.unit.findUnique({ where: { id: data.unitId } });
    if (!unit) throw new Error('Unit not found');

    return this.prisma.item.create({
      data: {
        itemCode: data.itemCode,
        itemName: data.itemName,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId || null,
        brandId: data.brandId || null,
        unitId: data.unitId,
        minimumStockLevel: new Prisma.Decimal(data.minimumStockLevel || 0),
        maximumStockLevel: data.maximumStockLevel ? new Prisma.Decimal(data.maximumStockLevel) : null,
        itemType: data.itemType || 'NON_SERIALIZED',
        isSerialized: data.isSerialized || false,
        hasWarranty: data.hasWarranty || false,
        warrantyMonths: data.warrantyMonths || null,
        hsnCode: data.hsnCode || null,
        description: data.description || null,
      },
      include: { category: true, unit: true, subCategory: true, brand: true },
    });
  }

  async update(id: number, data: UpdateItemInput) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new Error('Item not found');

    return this.prisma.item.update({
      where: { id },
      data: {
        ...data,
        minimumStockLevel: data.minimumStockLevel !== undefined ? new Prisma.Decimal(data.minimumStockLevel) : undefined,
        maximumStockLevel: data.maximumStockLevel !== undefined ? (data.maximumStockLevel ? new Prisma.Decimal(data.maximumStockLevel) : null) : undefined,
      },
      include: { category: true, unit: true, subCategory: true, brand: true },
    });
  }

  async getById(id: number) {
    return this.prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        unit: true,
        subCategory: true,
        brand: true,
        serializedItems: { where: { status: { not: 'SCRAPPED' } } },
        _count: { select: { assetInstallations: true } },
      },
    });
  }

  async list(companyId: number, categoryId?: number, itemType?: string, isSerialized?: boolean) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (itemType) where.itemType = itemType;
    if (isSerialized !== undefined) where.isSerialized = isSerialized;

    return this.prisma.item.findMany({
      where,
      include: { category: true, unit: true, subCategory: true, brand: true },
      orderBy: { itemName: 'asc' },
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.item.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactionDetails: true,
            assetInstallations: true,
          },
        },
      },
    });
    if (!existing) throw new Error('Item not found');
    if (existing._count.transactionDetails > 0) throw new Error('Cannot delete item with transaction details');
    if (existing._count.assetInstallations > 0) throw new Error('Cannot delete item with installed assets');

    return this.prisma.item.update({ where: { id }, data: { isActive: false } });
  }

  // ============================================================
  // SERIALIZED ITEM OPERATIONS
  // ============================================================

  async createSerializedItem(data: {
    itemId: number;
    serialNumber: string;
    batchNumber?: string;
    manufactureDate?: Date;
    purchaseDate?: Date;
    warrantyExpiry?: Date;
    currentStoreId?: number;
    purchasePrice?: number;
    assetTag?: string;
  }) {
    const existing = await this.prisma.serializedItem.findFirst({
      where: { itemId: data.itemId, serialNumber: data.serialNumber },
    });
    if (existing) throw new Error(`Serial number "${data.serialNumber}" already exists for this item`);

    return this.prisma.serializedItem.create({
      data: {
        itemId: data.itemId,
        serialNumber: data.serialNumber,
        batchNumber: data.batchNumber || null,
        manufactureDate: data.manufactureDate || null,
        purchaseDate: data.purchaseDate || null,
        warrantyExpiry: data.warrantyExpiry || null,
        currentStoreId: data.currentStoreId || null,
        purchasePrice: data.purchasePrice ? new Prisma.Decimal(data.purchasePrice) : null,
        assetTag: data.assetTag || null,
      },
      include: { item: true, currentStore: true },
    });
  }

  async getSerializedItems(itemId: number, storeId?: number) {
    const where: any = { itemId };
    if (storeId) where.currentStoreId = storeId;

    return this.prisma.serializedItem.findMany({
      where,
      include: { item: true, currentStore: true },
      orderBy: { serialNumber: 'asc' },
    });
  }

  async updateSerializedItemStatus(id: number, status: string, storeId?: number) {
    return this.prisma.serializedItem.update({
      where: { id },
      data: {
        status,
        currentStoreId: storeId || null,
      },
    });
  }
}
