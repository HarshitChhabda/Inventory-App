import { PrismaClient, Prisma } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

export type AssetStatus =
  | 'PURCHASED' | 'AVAILABLE' | 'RESERVED' | 'INSTALLED' | 'IN_TRANSIT'
  | 'REPAIR' | 'DAMAGED' | 'REPLACEMENT' | 'SCRAPPED' | 'DISPOSED'
  | 'LOST' | 'ARCHIVED';

export type AssetCondition =
  | 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'CRITICAL' | 'SCRAP';

export type AssetEventType =
  | 'PURCHASED' | 'RECEIVED' | 'STORED' | 'ISSUED' | 'TRANSFERRED'
  | 'INSTALLED' | 'UNINSTALLED' | 'REPAIRED' | 'DAMAGED' | 'RETURNED'
  | 'REPLACED' | 'SCRAPPED' | 'DISPOSED' | 'LOST' | 'ARCHIVED'
  | 'CONDITION_CHANGED' | 'STATUS_CHANGED';

export type PhotoType = 'PURCHASE' | 'INSTALLATION' | 'DAMAGE' | 'REPAIR' | 'CURRENT' | 'DOCUMENT';
export type DocumentType = 'INVOICE' | 'WARRANTY_CARD' | 'AMC_CONTRACT' | 'MANUAL' | 'SERVICE_REPORT' | 'REPAIR_INVOICE' | 'OTHER';
export type ServiceType = 'REPAIR' | 'MAINTENANCE' | 'INSPECTION' | 'CALIBRATION' | 'CLEANING';

export interface CreateAssetInput {
  companyId: number;
  itemId: number;
  assetName: string;
  brandId?: number;
  modelNumber?: string;
  description?: string;
  serialNumber?: string;
  barcode?: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  vendorId?: number;
  invoiceNumber?: string;
  purchaseOrderId?: string;
  grnNumber?: string;
  currentStoreId?: number;
  currentLocationId?: number;
  currentRoomId?: number;
  currentDepartmentId?: number;
  expectedLifeYears?: number;
  expectedLifeMonths?: number;
  warrantyStart?: Date;
  warrantyEnd?: Date;
  warrantyVendor?: string;
  warrantyTerms?: string;
  amcStart?: Date;
  amcEnd?: Date;
  amcVendor?: string;
  amcAmount?: number;
  amcTerms?: string;
  remarks?: string;
  createdBy?: string;
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  status?: AssetStatus;
  condition?: AssetCondition;
  healthScore?: number;
  disposalDate?: Date;
  disposalReason?: string;
  photoUrl?: string;
  isActive?: boolean;
}

export interface AssetSearchFilters {
  companyId?: number;
  search?: string;                    // Free-text: assetCode, name, serial, barcode, QR
  itemId?: number;
  brandId?: number;
  vendorId?: number;
  status?: AssetStatus | AssetStatus[];
  condition?: AssetCondition | AssetCondition[];
  storeId?: number;
  locationId?: number;
  roomId?: number;
  departmentId?: number;
  warrantyExpiringDays?: number;      // Warranty expiring within N days
  amcExpiringDays?: number;           // AMC expiring within N days
  healthScoreMin?: number;
  healthScoreMax?: number;
  purchaseDateFrom?: Date;
  purchaseDateTo?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssetReport {
  type: string;
  title: string;
  data: any[];
  generatedAt: Date;
}

// ============================================================
// ASSET SERVICE
// ============================================================

export class AssetService {
  constructor(private prisma: PrismaClient) {}

  // ─── SEQUENCE GENERATOR ─────────────────────────

  private async generateAssetCode(companyId: number): Promise<string> {
    const fy = await this.prisma.financialYear.findFirst({
      where: { companyId, isClosed: false },
      orderBy: { startDate: 'desc' },
    });
    const year = fy ? new Date(fy.startDate).getFullYear() : new Date().getFullYear();

    const last = await this.prisma.assetProfile.findFirst({
      where: { companyId, assetCode: { startsWith: `AST-${year}` } },
      orderBy: { id: 'desc' },
      select: { assetCode: true },
    });

    let seq = 1;
    if (last) {
      const parts = last.assetCode.split('-');
      seq = parseInt(parts[2] || '0') + 1;
    }

    return `AST-${year}-${String(seq).padStart(6, '0')}`;
  }

  // ─── HEALTH SCORE ENGINE ─────────────────────────

  async calculateHealthScore(assetId: number): Promise<number> {
    const asset = await this.prisma.assetProfile.findUnique({
      where: { id: assetId },
      include: { services: true },
    });
    if (!asset) return 0;

    let score = 100;

    // Age penalty: -2% per year of expected life used
    if (asset.purchaseDate && asset.expectedLifeYears) {
      const ageYears = (Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const lifeUsed = ageYears / asset.expectedLifeYears;
      if (lifeUsed > 1) {
        score -= 40; // Past expected life
      } else {
        score -= Math.floor(lifeUsed * 30); // Up to -30% for age
      }
    }

    // Repair penalty: -5% per repair, max -30%
    const repairPenalty = Math.min(asset.repairCount * 5, 30);
    score -= repairPenalty;

    // Condition penalty
    const conditionPenalty: Record<string, number> = {
      'EXCELLENT': 0, 'GOOD': 5, 'AVERAGE': 15, 'POOR': 30, 'CRITICAL': 50, 'SCRAP': 80,
    };
    score -= conditionPenalty[asset.condition] || 0;

    // Repair cost penalty: -1% per 10000 spent, max -20%
    if (asset.totalRepairCost && Number(asset.totalRepairCost) > 0) {
      const costPenalty = Math.min(Math.floor(Number(asset.totalRepairCost) / 10000), 20);
      score -= costPenalty;
    }

    score = Math.max(0, Math.min(100, score));

    await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: { healthScore: score },
    });

    return score;
  }

  // ─── CRUD OPERATIONS ─────────────────────────────

  async createAsset(input: CreateAssetInput): Promise<any> {
    const assetCode = await this.generateAssetCode(input.companyId);

    // Generate QR code data (assetCode + timestamp hash)
    const qrData = `${assetCode}|${Date.now().toString(36).toUpperCase()}`;

    const asset = await this.prisma.assetProfile.create({
      data: {
        assetCode,
        qrCode: qrData,
        companyId: input.companyId,
        itemId: input.itemId,
        assetName: input.assetName,
        brandId: input.brandId || null,
        modelNumber: input.modelNumber || null,
        description: input.description || null,
        serialNumber: input.serialNumber || null,
        barcode: input.barcode || null,
        purchaseDate: input.purchaseDate || null,
        purchaseCost: input.purchaseCost || 0,
        vendorId: input.vendorId || null,
        invoiceNumber: input.invoiceNumber || null,
        purchaseOrderId: input.purchaseOrderId || null,
        grnNumber: input.grnNumber || null,
        currentStoreId: input.currentStoreId || null,
        currentLocationId: input.currentLocationId || null,
        currentRoomId: input.currentRoomId || null,
        currentDepartmentId: input.currentDepartmentId || null,
        expectedLifeYears: input.expectedLifeYears || 5,
        expectedLifeMonths: input.expectedLifeMonths || 0,
        warrantyStart: input.warrantyStart || null,
        warrantyEnd: input.warrantyEnd || null,
        warrantyVendor: input.warrantyVendor || null,
        warrantyTerms: input.warrantyTerms || null,
        amcStart: input.amcStart || null,
        amcEnd: input.amcEnd || null,
        amcVendor: input.amcVendor || null,
        amcAmount: input.amcAmount || 0,
        amcTerms: input.amcTerms || null,
        remarks: input.remarks || null,
        createdBy: input.createdBy || null,
        status: 'AVAILABLE',
        condition: 'EXCELLENT',
        healthScore: 100,
      },
      include: {
        item: true,
        brand: true,
        vendor: true,
        currentStore: true,
        currentLocation: true,
        currentRoom: true,
        currentDepartment: true,
      },
    });

    // Create initial timeline event
    await this.addTimelineEvent(asset.id, 'PURCHASED', {
      eventDate: input.purchaseDate || new Date(),
      performedBy: input.createdBy,
      remarks: `Asset created: ${assetCode}`,
    });

    return asset;
  }

  async getAsset(id: number): Promise<any> {
    return this.prisma.assetProfile.findUnique({
      where: { id },
      include: {
        item: { include: { category: true, unit: true, brand: true } },
        brand: true,
        vendor: true,
        currentStore: true,
        currentLocation: true,
        currentRoom: true,
        currentDepartment: true,
        timeline: { orderBy: { eventDate: 'desc' } },
        photos: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        services: { orderBy: { serviceDate: 'desc' } },
        movements: { orderBy: { movementDate: 'desc' } },
      },
    });
  }

  async getAssetByCode(assetCode: string): Promise<any> {
    return this.prisma.assetProfile.findUnique({
      where: { assetCode },
      include: {
        item: true,
        brand: true,
        vendor: true,
        currentStore: true,
        currentRoom: true,
        currentDepartment: true,
        timeline: { orderBy: { eventDate: 'desc' } },
      },
    });
  }

  async updateAsset(id: number, input: UpdateAssetInput): Promise<any> {
    const existing = await this.prisma.assetProfile.findUnique({ where: { id } });
    if (!existing) throw new Error('Asset not found');

    const updateData: any = {};
    if (input.itemId !== undefined) updateData.itemId = input.itemId;
    if (input.assetName !== undefined) updateData.assetName = input.assetName;
    if (input.brandId !== undefined) updateData.brandId = input.brandId;
    if (input.modelNumber !== undefined) updateData.modelNumber = input.modelNumber;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.serialNumber !== undefined) updateData.serialNumber = input.serialNumber;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;
    if (input.purchaseDate !== undefined) updateData.purchaseDate = input.purchaseDate;
    if (input.purchaseCost !== undefined) updateData.purchaseCost = input.purchaseCost;
    if (input.vendorId !== undefined) updateData.vendorId = input.vendorId;
    if (input.invoiceNumber !== undefined) updateData.invoiceNumber = input.invoiceNumber;
    if (input.currentStoreId !== undefined) updateData.currentStoreId = input.currentStoreId;
    if (input.currentLocationId !== undefined) updateData.currentLocationId = input.currentLocationId;
    if (input.currentRoomId !== undefined) updateData.currentRoomId = input.currentRoomId;
    if (input.currentDepartmentId !== undefined) updateData.currentDepartmentId = input.currentDepartmentId;
    if (input.expectedLifeYears !== undefined) updateData.expectedLifeYears = input.expectedLifeYears;
    if (input.expectedLifeMonths !== undefined) updateData.expectedLifeMonths = input.expectedLifeMonths;
    if (input.warrantyStart !== undefined) updateData.warrantyStart = input.warrantyStart;
    if (input.warrantyEnd !== undefined) updateData.warrantyEnd = input.warrantyEnd;
    if (input.warrantyVendor !== undefined) updateData.warrantyVendor = input.warrantyVendor;
    if (input.warrantyTerms !== undefined) updateData.warrantyTerms = input.warrantyTerms;
    if (input.amcStart !== undefined) updateData.amcStart = input.amcStart;
    if (input.amcEnd !== undefined) updateData.amcEnd = input.amcEnd;
    if (input.amcVendor !== undefined) updateData.amcVendor = input.amcVendor;
    if (input.amcAmount !== undefined) updateData.amcAmount = input.amcAmount;
    if (input.amcTerms !== undefined) updateData.amcTerms = input.amcTerms;
    if (input.remarks !== undefined) updateData.remarks = input.remarks;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.condition !== undefined) updateData.condition = input.condition;
    if (input.healthScore !== undefined) updateData.healthScore = input.healthScore;
    if (input.disposalDate !== undefined) updateData.disposalDate = input.disposalDate;
    if (input.disposalReason !== undefined) updateData.disposalReason = input.disposalReason;
    if (input.photoUrl !== undefined) updateData.photoUrl = input.photoUrl;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    // Track status/condition changes
    if (input.status && input.status !== existing.status) {
      await this.addTimelineEvent(id, input.status as AssetEventType, {
        eventDate: new Date(),
        remarks: `Status changed: ${existing.status} → ${input.status}`,
      });
    }
    if (input.condition && input.condition !== existing.condition) {
      await this.addTimelineEvent(id, 'CONDITION_CHANGED', {
        eventDate: new Date(),
        remarks: `Condition changed: ${existing.condition} → ${input.condition}`,
      });
      // Recalculate health score on condition change
      updateData.healthScore = undefined; // Will recalculate below
    }

    const updated = await this.prisma.assetProfile.update({
      where: { id },
      data: updateData,
      include: {
        item: true,
        brand: true,
        vendor: true,
        currentStore: true,
        currentRoom: true,
        currentDepartment: true,
      },
    });

    // Recalculate health score if condition changed
    if (input.condition && input.condition !== existing.condition) {
      await this.calculateHealthScore(id);
    }

    return updated;
  }

  async deleteAsset(id: number): Promise<void> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'INSTALLED') throw new Error('Cannot delete an installed asset. Uninstall first.');

    await this.prisma.$transaction([
      this.prisma.assetTimeline.deleteMany({ where: { assetId: id } }),
      this.prisma.assetPhoto.deleteMany({ where: { assetId: id } }),
      this.prisma.assetDocument.deleteMany({ where: { assetId: id } }),
      this.prisma.assetServiceHistory.deleteMany({ where: { assetId: id } }),
      this.prisma.assetMovement.deleteMany({ where: { assetId: id } }),
      this.prisma.assetProfile.delete({ where: { id } }),
    ]);
  }

  // ─── LIFECYCLE OPERATIONS ────────────────────────

  async installAsset(
    assetId: number,
    storeId: number,
    locationId?: number,
    roomId?: number,
    departmentId?: number,
    installedBy?: string,
    remarks?: string,
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'INSTALLED') throw new Error('Asset is already installed');
    if (asset.status === 'SCRAPPED' || asset.status === 'DISPOSED') throw new Error('Cannot install a scrapped/disposed asset');

    const updated = await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        status: 'INSTALLED',
        installationDate: new Date(),
        currentStoreId: storeId,
        currentLocationId: locationId || null,
        currentRoomId: roomId || null,
        currentDepartmentId: departmentId || null,
      },
    });

    await this.addTimelineEvent(assetId, 'INSTALLED', {
      eventDate: new Date(),
      toStoreId: storeId,
      toLocationId: locationId,
      toRoomId: roomId,
      toDepartmentId: departmentId,
      performedBy: installedBy,
      remarks: remarks || `Installed at store #${storeId}`,
    });

    return updated;
  }

  async uninstallAsset(
    assetId: number,
    uninstalledBy?: string,
    remarks?: string,
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (asset.status !== 'INSTALLED') throw new Error('Asset is not installed');

    const fromStoreId = asset.currentStoreId;
    const fromLocationId = asset.currentLocationId;
    const fromRoomId = asset.currentRoomId;
    const fromDepartmentId = asset.currentDepartmentId;

    const updated = await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        status: 'AVAILABLE',
        installationDate: null,
        currentStoreId: null,
        currentLocationId: null,
        currentRoomId: null,
        currentDepartmentId: null,
      },
    });

    await this.addTimelineEvent(assetId, 'UNINSTALLED', {
      eventDate: new Date(),
      fromStoreId: fromStoreId || undefined,
      fromLocationId: fromLocationId || undefined,
      fromRoomId: fromRoomId || undefined,
      fromDepartmentId: fromDepartmentId || undefined,
      performedBy: uninstalledBy,
      remarks: remarks || 'Uninstalled',
    });

    return updated;
  }

  async transferAsset(
    assetId: number,
    toStoreId: number,
    toLocationId?: number,
    toRoomId?: number,
    toDepartmentId?: number,
    transactionId?: number,
    voucherNo?: string,
    performedBy?: string,
    reason?: string,
    remarks?: string,
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'SCRAPPED' || asset.status === 'DISPOSED') throw new Error('Cannot transfer a scrapped/disposed asset');

    const fromStoreId = asset.currentStoreId;
    const fromLocationId = asset.currentLocationId;
    const fromRoomId = asset.currentRoomId;
    const fromDepartmentId = asset.currentDepartmentId;

    const updated = await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        status: 'IN_TRANSIT',
        currentStoreId: toStoreId,
        currentLocationId: toLocationId || null,
        currentRoomId: toRoomId || null,
        currentDepartmentId: toDepartmentId || null,
      },
    });

    await this.addTimelineEvent(assetId, 'TRANSFERRED', {
      eventDate: new Date(),
      transactionId: transactionId || undefined,
      voucherNo: voucherNo || undefined,
      fromStoreId: fromStoreId || undefined,
      fromLocationId: fromLocationId || undefined,
      fromRoomId: fromRoomId || undefined,
      fromDepartmentId: fromDepartmentId || undefined,
      toStoreId,
      toLocationId: toLocationId || undefined,
      toRoomId: toRoomId || undefined,
      toDepartmentId: toDepartmentId || undefined,
      performedBy,
      reason,
      remarks: remarks || `Transferred to store #${toStoreId}`,
    });

    // Create movement record
    await this.prisma.assetMovement.create({
      data: {
        assetId,
        transactionId: transactionId || undefined,
        voucherNo: voucherNo || undefined,
        movementType: 'TC',
        movementDate: new Date(),
        fromStoreId: fromStoreId || undefined,
        fromLocationId: fromLocationId || undefined,
        fromRoomId: fromRoomId || undefined,
        fromDepartmentId: fromDepartmentId || undefined,
        toStoreId,
        toLocationId: toLocationId || undefined,
        toRoomId: toRoomId || undefined,
        toDepartmentId: toDepartmentId || undefined,
        performedBy,
        reason,
        remarks,
      },
    });

    // Auto-install at destination if room specified
    if (toRoomId) {
      await this.prisma.assetProfile.update({
        where: { id: assetId },
        data: { status: 'INSTALLED', installationDate: new Date() },
      });
    }

    return updated;
  }

  async recordRepair(
    assetId: number,
    input: {
      serviceDate: Date;
      description?: string;
      engineerName?: string;
      engineerContact?: string;
      vendorId?: number;
      vendorName?: string;
      cost: number;
      conditionBefore?: string;
      conditionAfter?: string;
      warrantyClaim?: boolean;
      nextServiceDate?: Date;
      remarks?: string;
    },
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');

    const service = await this.prisma.assetServiceHistory.create({
      data: {
        assetId,
        serviceType: 'REPAIR',
        serviceDate: input.serviceDate,
        description: input.description || null,
        engineerName: input.engineerName || null,
        engineerContact: input.engineerContact || null,
        vendorId: input.vendorId || null,
        vendorName: input.vendorName || null,
        cost: input.cost || 0,
        conditionBefore: input.conditionBefore || asset.condition,
        conditionAfter: input.conditionAfter || null,
        warrantyClaim: input.warrantyClaim || false,
        nextServiceDate: input.nextServiceDate || null,
        remarks: input.remarks || null,
      },
    });

    // Update asset repair count and cost
    await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        repairCount: { increment: 1 },
        totalRepairCost: { increment: input.cost || 0 },
        condition: input.conditionAfter as any || asset.condition,
      },
    });

    await this.addTimelineEvent(assetId, 'REPAIRED', {
      eventDate: input.serviceDate,
      performedBy: input.engineerName,
      remarks: `Repair: ${input.description || 'No description'}. Cost: ${input.cost}`,
    });

    // Recalculate health score
    await this.calculateHealthScore(assetId);

    return service;
  }

  async recordDamage(
    assetId: number,
    condition: AssetCondition,
    reportedBy?: string,
    remarks?: string,
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');

    const updated = await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        status: condition === 'SCRAP' ? 'SCRAPPED' : 'DAMAGED',
        condition,
      },
    });

    await this.addTimelineEvent(assetId, 'DAMAGED', {
      eventDate: new Date(),
      performedBy: reportedBy,
      reason: condition,
      remarks: remarks || `Asset damaged: ${condition}`,
    });

    await this.calculateHealthScore(assetId);
    return updated;
  }

  async scrapAsset(
    assetId: number,
    performedBy?: string,
    remarks?: string,
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'INSTALLED') throw new Error('Uninstall the asset first');

    const updated = await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        status: 'SCRAPPED',
        condition: 'SCRAP',
        disposalDate: new Date(),
        disposalReason: remarks || 'Scrapped',
      },
    });

    await this.addTimelineEvent(assetId, 'SCRAPPED', {
      eventDate: new Date(),
      performedBy,
      remarks: remarks || 'Asset scrapped',
    });

    await this.calculateHealthScore(assetId);
    return updated;
  }

  async disposeAsset(
    assetId: number,
    reason: string,
    performedBy?: string,
  ): Promise<any> {
    const asset = await this.prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'INSTALLED') throw new Error('Uninstall the asset first');

    const updated = await this.prisma.assetProfile.update({
      where: { id: assetId },
      data: {
        status: 'DISPOSED',
        condition: 'SCRAP',
        disposalDate: new Date(),
        disposalReason: reason,
      },
    });

    await this.addTimelineEvent(assetId, 'DISPOSED', {
      eventDate: new Date(),
      performedBy,
      reason,
      remarks: `Disposed: ${reason}`,
    });

    return updated;
  }

  // ─── TIMELINE ───────────────────────────────────

  async addTimelineEvent(
    assetId: number,
    eventType: AssetEventType,
    data: {
      eventDate?: Date;
      transactionId?: number;
      voucherNo?: string;
      fromStoreId?: number;
      fromLocationId?: number;
      fromRoomId?: number;
      fromDepartmentId?: number;
      toStoreId?: number;
      toLocationId?: number;
      toRoomId?: number;
      toDepartmentId?: number;
      performedBy?: string;
      reason?: string;
      remarks?: string;
      metadata?: string;
    } = {},
  ): Promise<any> {
    return this.prisma.assetTimeline.create({
      data: {
        assetId,
        eventType,
        eventDate: data.eventDate || new Date(),
        transactionId: data.transactionId || null,
        voucherNo: data.voucherNo || null,
        fromStoreId: data.fromStoreId || null,
        fromLocationId: data.fromLocationId || null,
        fromRoomId: data.fromRoomId || null,
        fromDepartmentId: data.fromDepartmentId || null,
        toStoreId: data.toStoreId || null,
        toLocationId: data.toLocationId || null,
        toRoomId: data.toRoomId || null,
        toDepartmentId: data.toDepartmentId || null,
        performedBy: data.performedBy || null,
        reason: data.reason || null,
        remarks: data.remarks || null,
        metadata: data.metadata || null,
      },
    });
  }

  async getTimeline(assetId: number): Promise<any[]> {
    return this.prisma.assetTimeline.findMany({
      where: { assetId },
      orderBy: { eventDate: 'desc' },
    });
  }

  // ─── PHOTOS & DOCUMENTS ─────────────────────────

  async addPhoto(
    assetId: number,
    photoType: PhotoType,
    fileName: string,
    filePath: string,
    fileSize?: number,
    mimeType?: string,
    caption?: string,
    takenBy?: string,
  ): Promise<any> {
    return this.prisma.assetPhoto.create({
      data: {
        assetId,
        photoType,
        fileName,
        filePath,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        caption: caption || null,
        takenAt: new Date(),
        takenBy: takenBy || null,
      },
    });
  }

  async getPhotos(assetId: number, photoType?: PhotoType): Promise<any[]> {
    const where: any = { assetId };
    if (photoType) where.photoType = photoType;
    return this.prisma.assetPhoto.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async deletePhoto(photoId: number): Promise<void> {
    await this.prisma.assetPhoto.delete({ where: { id: photoId } });
  }

  async addDocument(
    assetId: number,
    documentType: DocumentType,
    fileName: string,
    filePath: string,
    fileSize?: number,
    mimeType?: string,
    description?: string,
    uploadedBy?: string,
  ): Promise<any> {
    return this.prisma.assetDocument.create({
      data: {
        assetId,
        documentType,
        fileName,
        filePath,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        description: description || null,
        uploadedBy: uploadedBy || null,
      },
    });
  }

  async getDocuments(assetId: number, documentType?: DocumentType): Promise<any[]> {
    const where: any = { assetId };
    if (documentType) where.documentType = documentType;
    return this.prisma.assetDocument.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async deleteDocument(docId: number): Promise<void> {
    await this.prisma.assetDocument.delete({ where: { id: docId } });
  }

  // ─── SEARCH ─────────────────────────────────────

  async searchAssets(filters: AssetSearchFilters): Promise<{ data: any[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const where: any = {};

    if (filters.companyId) where.companyId = filters.companyId;

    // Free-text search
    if (filters.search) {
      where.OR = [
        { assetCode: { contains: filters.search } },
        { assetName: { contains: filters.search } },
        { serialNumber: { contains: filters.search } },
        { barcode: { contains: filters.search } },
        { qrCode: { contains: filters.search } },
        { modelNumber: { contains: filters.search } },
        { invoiceNumber: { contains: filters.search } },
        { remarks: { contains: filters.search } },
      ];
    }

    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.brandId) where.brandId = filters.brandId;
    if (filters.vendorId) where.vendorId = filters.vendorId;

    if (filters.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }
    if (filters.condition) {
      where.condition = Array.isArray(filters.condition) ? { in: filters.condition } : filters.condition;
    }

    if (filters.storeId) where.currentStoreId = filters.storeId;
    if (filters.locationId) where.currentLocationId = filters.locationId;
    if (filters.roomId) where.currentRoomId = filters.roomId;
    if (filters.departmentId) where.currentDepartmentId = filters.departmentId;

    if (filters.healthScoreMin !== undefined || filters.healthScoreMax !== undefined) {
      where.healthScore = {};
      if (filters.healthScoreMin !== undefined) where.healthScore.gte = filters.healthScoreMin;
      if (filters.healthScoreMax !== undefined) where.healthScore.lte = filters.healthScoreMax;
    }

    if (filters.purchaseDateFrom || filters.purchaseDateTo) {
      where.purchaseDate = {};
      if (filters.purchaseDateFrom) where.purchaseDate.gte = filters.purchaseDateFrom;
      if (filters.purchaseDateTo) where.purchaseDate.lte = filters.purchaseDateTo;
    }

    // Warranty expiring
    if (filters.warrantyExpiringDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.warrantyExpiringDays);
      where.warrantyEnd = { lte: futureDate, gte: new Date() };
    }

    // AMC expiring
    if (filters.amcExpiringDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.amcExpiringDays);
      where.amcEnd = { lte: futureDate, gte: new Date() };
    }

    const [data, total] = await Promise.all([
      this.prisma.assetProfile.findMany({
        where,
        include: {
          item: true,
          brand: true,
          vendor: true,
          currentStore: true,
          currentRoom: true,
          currentDepartment: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: filters.sortBy
          ? { [filters.sortBy]: filters.sortOrder || 'desc' }
          : { createdAt: 'desc' },
      }),
      this.prisma.assetProfile.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ─── REPORTS ────────────────────────────────────

  async getInstalledAssetsReport(companyId: number): Promise<any[]> {
    return this.prisma.assetProfile.findMany({
      where: { companyId, status: 'INSTALLED', isActive: true },
      include: {
        item: true,
        currentStore: true,
        currentRoom: true,
        currentDepartment: true,
      },
      orderBy: { installationDate: 'desc' },
    });
  }

  async getWarrantyExpiringReport(companyId: number, days: number = 30): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.prisma.assetProfile.findMany({
      where: {
        companyId,
        warrantyEnd: { lte: futureDate, gte: new Date() },
        isActive: true,
      },
      include: { item: true, vendor: true },
      orderBy: { warrantyEnd: 'asc' },
    });
  }

  async getAmcExpiringReport(companyId: number, days: number = 30): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.prisma.assetProfile.findMany({
      where: {
        companyId,
        amcEnd: { lte: futureDate, gte: new Date() },
        isActive: true,
      },
      include: { item: true },
      orderBy: { amcEnd: 'asc' },
    });
  }

  async getRepairHistoryReport(companyId: number): Promise<any[]> {
    return this.prisma.assetServiceHistory.findMany({
      where: {
        asset: { companyId, isActive: true },
        serviceType: 'REPAIR',
      },
      include: { asset: { include: { item: true } } },
      orderBy: { serviceDate: 'desc' },
    });
  }

  async getAssetHealthReport(companyId: number): Promise<any[]> {
    return this.prisma.assetProfile.findMany({
      where: { companyId, isActive: true },
      include: { item: true },
      orderBy: { healthScore: 'asc' },
    });
  }

  async getAssetAgeReport(companyId: number): Promise<any[]> {
    const assets = await this.prisma.assetProfile.findMany({
      where: { companyId, isActive: true, purchaseDate: { not: null } },
      include: { item: true },
      orderBy: { purchaseDate: 'asc' },
    });

    return assets.map(a => {
      const ageMs = Date.now() - new Date(a.purchaseDate!).getTime();
      const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
      const ageMonths = Math.floor((ageMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
      return { ...a, ageYears, ageMonths };
    });
  }

  async getScrappedAssetsReport(companyId: number): Promise<any[]> {
    return this.prisma.assetProfile.findMany({
      where: { companyId, status: 'SCRAPPED' },
      include: { item: true },
      orderBy: { disposalDate: 'desc' },
    });
  }

  async getDisposedAssetsReport(companyId: number): Promise<any[]> {
    return this.prisma.assetProfile.findMany({
      where: { companyId, status: 'DISPOSED' },
      include: { item: true },
      orderBy: { disposalDate: 'desc' },
    });
  }

  async getLostAssetsReport(companyId: number): Promise<any[]> {
    return this.prisma.assetProfile.findMany({
      where: { companyId, status: 'LOST' },
      include: { item: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ─── BULK OPERATIONS ────────────────────────────

  async importAssets(companyId: number, assets: CreateAssetInput[]): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const asset of assets) {
      try {
        await this.createAsset({ ...asset, companyId });
        imported++;
      } catch (e: any) {
        errors.push(`Failed to import ${asset.assetName}: ${e.message}`);
      }
    }

    return { imported, errors };
  }

  async bulkUpdateCondition(
    assetIds: number[],
    condition: AssetCondition,
    updatedBy?: string,
  ): Promise<{ updated: number }> {
    let updated = 0;
    for (const id of assetIds) {
      try {
        await this.recordDamage(id, condition, updatedBy, `Bulk condition update to ${condition}`);
        updated++;
      } catch (e) {
        // Skip individual failures
      }
    }
    return { updated };
  }

  // ─── EXPIRY REMINDERS ───────────────────────────

  async getExpiringWarranties(companyId: number, days: number = 30): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.prisma.assetProfile.findMany({
      where: {
        companyId,
        warrantyEnd: { lte: futureDate, gte: new Date() },
        isActive: true,
      },
      include: { item: true, vendor: true },
    });
  }

  async getExpiringAMCs(companyId: number, days: number = 30): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.prisma.assetProfile.findMany({
      where: {
        companyId,
        amcEnd: { lte: futureDate, gte: new Date() },
        isActive: true,
      },
      include: { item: true },
    });
  }

  async getEndOfLifeAssets(companyId: number): Promise<any[]> {
    const assets = await this.prisma.assetProfile.findMany({
      where: { companyId, isActive: true, purchaseDate: { not: null } },
      include: { item: true },
    });

    return assets.filter(a => {
      if (!a.expectedLifeYears) return false;
      const ageMs = Date.now() - new Date(a.purchaseDate!).getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      return ageYears >= a.expectedLifeYears;
    });
  }

  async getReplacementSuggestions(companyId: number, costThreshold: number = 50000, repairThreshold: number = 5): Promise<any[]> {
    return this.prisma.assetProfile.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { totalRepairCost: { gte: costThreshold } },
          { repairCount: { gte: repairThreshold } },
        ],
      },
      include: { item: true },
      orderBy: { totalRepairCost: 'desc' },
    });
  }

  // ─── DASHBOARD STATS ────────────────────────────

  async getDashboardStats(companyId: number): Promise<any> {
    const [total, byStatus, byCondition, avgHealth, expiringWarranty, expiringAMC, endOfLife] = await Promise.all([
      this.prisma.assetProfile.count({ where: { companyId, isActive: true } }),
      this.prisma.assetProfile.groupBy({ by: ['status'], where: { companyId, isActive: true }, _count: true }),
      this.prisma.assetProfile.groupBy({ by: ['condition'], where: { companyId, isActive: true }, _count: true }),
      this.prisma.assetProfile.aggregate({ where: { companyId, isActive: true }, _avg: { healthScore: true } }),
      this.getExpiringWarranties(companyId, 30),
      this.getExpiringAMCs(companyId, 30),
      this.getEndOfLifeAssets(companyId),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {}),
      byCondition: byCondition.reduce((acc, r) => ({ ...acc, [r.condition]: r._count }), {}),
      averageHealthScore: Math.round((avgHealth._avg.healthScore as number) || 0),
      expiringWarrantyCount: expiringWarranty.length,
      expiringAMCCount: expiringAMC.length,
      endOfLifeCount: endOfLife.length,
    };
  }
}
