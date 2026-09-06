import { PrismaClient, Prisma } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import { formatDateDDMMYYYY } from '../../shared/dateUtils';
import type { CreateTransactionInput } from '../../shared/types';

export class InstallationService {
  private txEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.txEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  /**
   * Install items at a location (Room).
   * Deducts from store stock, creates AssetInstallation record.
   * Uses TransactionEngine for stock movements.
   */
  async install(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    storeId: number;
    targetLocationId: number;
    quantity: number;
    rate?: number;
    installedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const { companyId, financialYearId, itemId, storeId, targetLocationId, quantity, rate = 0, installedBy, remarks, transactionDate } = data;

    if (!transactionDate) {
      throw new Error('Transaction Date is required for asset installation');
    }
    const now = transactionDate;

    // Validate sufficient stock
    const validation = await this.stockEngine.validateStock(companyId, financialYearId, itemId, storeId, quantity);
    if (!validation.valid) {
      throw new Error(`Insufficient stock: ${validation.itemName} has ${validation.available} at store, requested ${quantity}`);
    }

    // Resolve the Room to get its parent Location ID
    const room = await this.prisma.room.findUnique({ where: { id: targetLocationId } });
    if (!room) {
      throw new Error(`Room not found: ${targetLocationId}`);
    }
    const parentLocationId = room.locationId;

    // Create installation transaction through TransactionEngine
    const txInput: CreateTransactionInput = {
      companyId,
      financialYearId,
      voucherType: 'IS',
      transactionDate: now,
      fromStoreId: storeId,
      toStoreId: undefined,
      fromLocationId: undefined,
      toLocationId: parentLocationId,
      toRoomId: targetLocationId,
      purpose: `Installed at location ${targetLocationId}`,
      remarks: remarks || `Installed by ${installedBy}`,
      createdBy: installedBy,
      items: [{
        itemId,
        quantity,
        rate,
        condition: 'GOOD',
        toLocationId: parentLocationId,
        remarks: remarks || `Installed at location ${targetLocationId}`,
      }],
    };

    const result = await this.txEngine.createTransaction(txInput);

    // Create or update AssetInstallation within a transaction for atomicity
    const installation = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.assetInstallation.findFirst({
        where: { itemId, roomId: targetLocationId, status: 'ACTIVE' },
      });

      let install;
      if (existing) {
        install = await tx.assetInstallation.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        install = await tx.assetInstallation.create({
          data: {
            itemId,
            roomId: targetLocationId,
            storeId,
            installedDate: now,
            quantity,
            installedBy,
            status: 'ACTIVE',
            remarks: remarks || `Installed from store ${storeId}`,
          },
        });
      }

      // Audit log within same transaction
      await tx.auditLog.create({
        data: {
          companyId,
          action: 'CREATE',
          tableName: 'AssetInstallation',
          recordId: install.id,
          description: `Installed ${quantity} of item ${itemId} at location ${targetLocationId}`,
          newValues: JSON.stringify({ storeId, targetLocationId, quantity, installVoucherNo: result.voucherNo }),
        },
      });

      return install;
    });

    return { installVoucherNo: result.voucherNo, installation };
  }

  /**
   * Uninstall items from a location.
   * Removes from AssetInstallation, returns stock to a store.
   * Uses TransactionEngine for stock movements.
   */
  async uninstall(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    sourceLocationId: number;
    targetStoreId: number;
    quantity: number;
    rate?: number;
    uninstalledBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const { companyId, financialYearId, itemId, sourceLocationId, targetStoreId, quantity, rate = 0, uninstalledBy, remarks, transactionDate } = data;

    if (!transactionDate) {
      throw new Error('Transaction Date is required for asset un-installation');
    }
    const now = transactionDate;

    // Verify there are enough active installations to uninstall
    const installation = await this.prisma.assetInstallation.findFirst({
      where: { itemId, roomId: sourceLocationId, status: 'ACTIVE' },
    });

    if (!installation) {
      throw new Error(`No active installation found for item ${itemId} at location ${sourceLocationId}`);
    }

    if (Number(installation.quantity) < quantity) {
      throw new Error(`Insufficient installed quantity: ${installation.quantity} installed, requested uninstall ${quantity}`);
    }

    // Resolve the Room to get its parent Location ID
    const room = await this.prisma.room.findUnique({ where: { id: sourceLocationId } });
    if (!room) {
      throw new Error(`Room not found: ${sourceLocationId}`);
    }
    const parentLocationId = room.locationId;

    // Create uninstall transaction through TransactionEngine
    const txInput: CreateTransactionInput = {
      companyId,
      financialYearId,
      voucherType: 'UN',
      transactionDate: now,
      fromStoreId: installation.storeId,
      toStoreId: targetStoreId,
      fromLocationId: parentLocationId,
      toLocationId: undefined,
      purpose: `Uninstalled from location ${sourceLocationId}`,
      remarks: remarks || `Uninstalled by ${uninstalledBy}`,
      createdBy: uninstalledBy,
      items: [{
        itemId,
        quantity,
        rate,
        condition: 'GOOD',
        fromLocationId: parentLocationId,
        remarks: remarks || `Uninstalled from location ${sourceLocationId}`,
      }],
    };

    const result = await this.txEngine.createTransaction(txInput);

    // Update AssetInstallation and audit log atomically
    await this.prisma.$transaction(async (tx) => {
      const newInstallQty = Number(installation.quantity) - quantity;
      if (newInstallQty === 0) {
        await tx.assetInstallation.update({
          where: { id: installation.id },
          data: {
            status: 'INACTIVE',
            remarks: `Uninstalled ${quantity} on ${formatDateDDMMYYYY(now)} by ${uninstalledBy}${remarks ? `: ${remarks}` : ''}`,
          },
        });
      } else {
        await tx.assetInstallation.update({
          where: { id: installation.id },
          data: { quantity: newInstallQty },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          companyId,
          action: 'UPDATE',
          tableName: 'AssetInstallation',
          recordId: installation.id,
          description: `Uninstalled ${quantity} of item ${itemId} from location ${sourceLocationId} to store ${targetStoreId}`,
          oldValues: JSON.stringify({ installedQty: installation.quantity, sourceLocationId }),
          newValues: JSON.stringify({ newInstallQty, targetStoreId, uninstallVoucherNo: result.voucherNo }),
        },
      });
    });

    return { uninstallVoucherNo: result.voucherNo, newInstallQty: Number(installation.quantity) - quantity };
  }

  /**
   * Get all active installations for an item.
   */
  async getActiveInstallations(companyId: number, itemId?: number) {
    const where: any = { status: 'ACTIVE' };
    if (itemId) where.itemId = itemId;
    return this.prisma.assetInstallation.findMany({
      where,
      include: { item: true, room: true, store: true },
      orderBy: { installedDate: 'desc' },
    });
  }

  /**
   * Get installation history for a location.
   */
  async getInstallationsByLocation(locationId: number) {
    return this.prisma.assetInstallation.findMany({
      where: { roomId: locationId },
      include: { item: true, room: true },
      orderBy: { installedDate: 'desc' },
    });
  }
}
