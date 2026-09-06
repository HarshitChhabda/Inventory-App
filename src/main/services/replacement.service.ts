import { PrismaClient, Prisma } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import type { CreateTransactionInput } from '../../shared/types';

/**
 * REPLACEMENT SERVICE
 *
 * Handles the complete replacement workflow:
 * 1. Old item: Installed → Damaged (or Repair)
 * 2. New item: Available → Installed
 *
 * Both steps are executed in a single transaction for atomicity.
 * Old asset history is preserved. New asset installation is recorded.
 */
export class ReplacementService {
  private txEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.txEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  /**
   * Replace an installed item with a new item.
   *
   * Workflow:
   * Step 1: Old item removed from location → Damaged/Repair
   * Step 2: New item from store → Installed at same location
   *
   * @param data.oldItemId - The item ID of the old/defective item
   * @param data.newItemId - The item ID of the replacement item
   * @param data.storeId - The store where the new item is available
   * @param data.roomId - The room where replacement happens
   * @param data.quantity - Number of items to replace
   * @param data.newItemFromStoreId - Store where new item comes from (defaults to storeId)
   */
  async replaceItem(data: {
    companyId: number;
    financialYearId: number;
    oldItemId: number;
    newItemId: number;
    storeId: number;
    roomId: number;
    quantity: number;
    rate?: number;
    oldItemCondition?: 'DAMAGED' | 'REPAIR';
    replacedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const {
      companyId, financialYearId, oldItemId, newItemId, storeId, roomId,
      quantity, rate = 0, oldItemCondition = 'DAMAGED', replacedBy, remarks, transactionDate,
    } = data;

    if (!transactionDate) {
      throw new Error('Transaction Date is required for asset replacement');
    }
    const now = transactionDate;

    // Validate inputs
    const [oldItem, newItem, store, room] = await Promise.all([
      this.prisma.item.findUnique({ where: { id: oldItemId } }),
      this.prisma.item.findUnique({ where: { id: newItemId } }),
      this.prisma.store.findUnique({ where: { id: storeId } }),
      this.prisma.room.findUnique({ where: { id: roomId } }),
    ]);

    if (!oldItem) throw new Error(`Old item #${oldItemId} not found`);
    if (!newItem) throw new Error(`New item #${newItemId} not found`);
    if (!store) throw new Error(`Store #${storeId} not found`);
    if (!room) throw new Error(`Room #${roomId} not found`);

    // Validate old item is installed at this room
    const installation = await this.prisma.assetInstallation.findFirst({
      where: {
        itemId: oldItemId,
        roomId,
        storeId,
        status: 'ACTIVE',
      },
    });

    if (!installation) {
      throw new Error(
        `No active installation found for ${oldItem.itemName} at room ${room.name}`
      );
    }

    if (Number(installation.quantity) < quantity) {
      throw new Error(
        `Insufficient installed quantity: ${oldItem.itemName} has ${installation.quantity} installed at ${room.name}, requested ${quantity}`
      );
    }

    // Validate new item is available in store
    const newBreakdown = await this.stockEngine.getStockBreakdown(
      companyId, financialYearId, newItemId, storeId,
    );
    if (newBreakdown.available < quantity) {
      throw new Error(
        `Insufficient stock: ${newItem.itemName} has ${newBreakdown.available} available at ${store.name}, requested ${quantity}`
      );
    }

    // Execute both steps in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // ═══════════════════════════════════════════════════
      // STEP 1: Remove old item from location → Damaged
      // ═══════════════════════════════════════════════════

      // Update AssetInstallation for old item
      const newInstallQty = Number(installation.quantity) - quantity;
      if (newInstallQty === 0) {
        await tx.assetInstallation.update({
          where: { id: installation.id },
          data: {
            status: 'INACTIVE',
            uninstalledDate: now,
            uninstalledBy: replacedBy,
            remarks: `Replaced with ${newItem.itemName} (${oldItemCondition})`,
          },
        });
      } else {
        await tx.assetInstallation.update({
          where: { id: installation.id },
          data: { quantity: newInstallQty },
        });
      }

      // Create damage transaction for old item via TransactionEngine
      const damageInput: CreateTransactionInput = {
        companyId,
        financialYearId,
        voucherType: 'DM',
        transactionDate: now,
        fromStoreId: storeId,
        purpose: `Replacement: ${oldItem.itemName} → ${newItem.itemName}`,
        remarks: remarks || `Old item replaced by ${replacedBy}. Condition: ${oldItemCondition}`,
        createdBy: replacedBy,
        items: [{
          itemId: oldItemId,
          quantity,
          rate,
          condition: oldItemCondition,
          remarks: `Replaced with ${newItem.itemName}`,
        }],
      };
      const damageResult = await this.txEngine.createMovement(damageInput);

      // ═══════════════════════════════════════════════════
      // STEP 2: Install new item at location
      // ═══════════════════════════════════════════════════

      // Create install transaction for new item via TransactionEngine
      const installInput: CreateTransactionInput = {
        companyId,
        financialYearId,
        voucherType: 'IS',
        transactionDate: now,
        fromStoreId: storeId,
        toLocationId: roomId,
        purpose: `Replacement: ${newItem.itemName} installed at ${room.name}`,
        remarks: remarks || `Installed as replacement by ${replacedBy}`,
        createdBy: replacedBy,
        items: [{
          itemId: newItemId,
          quantity,
          rate,
          condition: 'GOOD',
          toLocationId: roomId,
          remarks: `Replacement installation`,
        }],
      };
      const installResult = await this.txEngine.createMovement(installInput);

      // Create/update AssetInstallation for new item
      const existingNewInstall = await tx.assetInstallation.findFirst({
        where: { itemId: newItemId, roomId, storeId, status: 'ACTIVE' },
      });

      if (existingNewInstall) {
        await tx.assetInstallation.update({
          where: { id: existingNewInstall.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await tx.assetInstallation.create({
          data: {
            itemId: newItemId,
            roomId,
            storeId,
            installedDate: now,
            quantity,
            installedBy: replacedBy,
            status: 'ACTIVE',
            remarks: `Installed as replacement for ${oldItem.itemName}`,
          },
        });
      }

      // Create AssetProfile for new item if it's an asset-type item
      if (newItem.itemType === 'ASSET' || newItem.isSerialized) {
        await tx.assetProfile.create({
          data: {
            assetCode: `RPL-${newItem.itemCode}-${Date.now()}`,
            assetName: newItem.itemName,
            itemId: newItemId,
            companyId,
            currentStoreId: storeId,
            currentRoomId: roomId,
            status: 'INSTALLED',
            condition: 'GOOD',
            installationDate: now,
            remarks: `Replacement for ${oldItem.itemName}`,
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          companyId,
          action: 'CREATE',
          tableName: 'TransactionHeader',
          recordId: damageResult.transactionId,
          description: `Replacement: ${quantity} x ${oldItem.itemName} → ${newItem.itemName} at ${room.name}`,
          newValues: JSON.stringify({
            oldItemId, newItemId, roomId, storeId, quantity,
            damageVoucherNo: damageResult.voucherNo,
            installVoucherNo: installResult.voucherNo,
          }),
        },
      });

      return {
        damageVoucherNo: damageResult.voucherNo,
        installVoucherNo: installResult.voucherNo,
      };
    });

    return {
      success: true,
      damageVoucherNo: result.damageVoucherNo,
      installVoucherNo: result.installVoucherNo,
      oldItem: { id: oldItemId, name: oldItem.itemName, condition: oldItemCondition },
      newItem: { id: newItemId, name: newItem.itemName },
      room: { id: roomId, name: room.name },
      store: { id: storeId, name: store.name },
      quantity,
      message: `Replaced ${quantity} ${oldItem.itemName} with ${newItem.itemName} at ${room.name}`,
    };
  }

  /**
   * Get replacement history for a location.
   */
  async getReplacementHistory(
    companyId: number,
    roomId: number,
    itemId?: number,
  ) {
    const where: any = {
      companyId,
      voucherType: { in: ['DM', 'IS'] },
    };
    if (itemId) {
      where.details = { some: { itemId } };
    }

    const transactions = await this.prisma.transactionHeader.findMany({
      where,
      include: {
        details: { include: { item: true } },
        fromStore: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    // Filter for transactions involving this room
    return transactions.filter((tx) => {
      const hasRoom = tx.details.some(
        (d) => d.toLocationId === roomId || d.fromLocationId === roomId
      );
      return hasRoom;
    });
  }
}
