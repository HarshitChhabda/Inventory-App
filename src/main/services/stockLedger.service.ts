import { PrismaClient, Prisma } from '@prisma/client';
import { validateSufficientStock, getLatestBalance, recalculateBalancesAfterInsert } from './stockValidation.service';

export class StockLedgerService {
  constructor(private prisma: PrismaClient) {}

  async getBalance(companyId: number, financialYearId: number, itemId: number, departmentId: number | null, locationId: number): Promise<number> {
    return getLatestBalance(this.prisma, companyId, financialYearId, itemId, departmentId, locationId);
  }

  /**
   * FIX #2: Balance check + write are now atomic inside $transaction.
   * FIX #4: Supports backdated transactions with automatic recalculation of subsequent balances.
   */
  async createTransfer(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    sourceLocationId: number;
    destLocationId: number;
    qty: number;
    rate?: number;
    transferredBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const { companyId, financialYearId, itemId, sourceLocationId, destLocationId, qty, rate = 0, transferredBy, remarks, transactionDate } = data;

    if (sourceLocationId === destLocationId) {
      throw new Error('Source and destination locations cannot be the same');
    }

    const now = transactionDate || new Date();
    const transferId = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // FIX #2: Atomic balance check — read latest balance inside the same transaction
      const validation = await validateSufficientStock(tx, companyId, financialYearId, itemId, null, sourceLocationId, qty);
      if (!validation.sufficient) {
        throw new Error(`Insufficient stock: ${validation.itemName} has ${validation.available} at source location, requested ${validation.requested}`);
      }

      const sourceBalance = validation.available;
      const sourceNewBalance = sourceBalance - qty;
      const destBalance = await getLatestBalance(tx, companyId, financialYearId, itemId, null, destLocationId);
      const destNewBalance = destBalance + qty;

      const sourceTxn = {
        companyId, financialYearId, itemId,
        locationId: sourceLocationId,
        transactionType: 'TRANSFER_OUT',
        transactionDate: now,
        quantityIn: new Prisma.Decimal(0),
        quantityOut: new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(rate),
        balanceQty: new Prisma.Decimal(sourceNewBalance),
        refTransferId: transferId,
        condition: 'GOOD',
        referenceType: 'Transfer',
        referenceNo: transferId,
        remarks: remarks || `Transfer out to location ${destLocationId}`,
        createdBy: transferredBy,
      };

      const destTxn = {
        companyId, financialYearId, itemId,
        locationId: destLocationId,
        transactionType: 'TRANSFER_IN',
        transactionDate: now,
        quantityIn: new Prisma.Decimal(qty),
        quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(rate),
        balanceQty: new Prisma.Decimal(destNewBalance),
        refTransferId: transferId,
        condition: 'GOOD',
        referenceType: 'Transfer',
        referenceId: null as number | null,
        referenceNo: transferId,
        remarks: remarks || `Transfer in from location ${sourceLocationId}`,
        createdBy: transferredBy,
      };

      await tx.stockTransaction.createMany({ data: [sourceTxn, destTxn] });

      // FIX #4: If backdated, recalculate all subsequent balances
      await this.recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, null, sourceLocationId, now);
      await this.recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, null, destLocationId, now);

      // FIX #9: Close out any active asset installations at the source location
      await this.closeAssetInstallations(tx, companyId, itemId, sourceLocationId, now, transferredBy, `Stock transferred to location ${destLocationId}`);

      await tx.auditLog.create({
        data: {
          companyId,
          action: 'TRANSFER',
          tableName: 'StockTransaction',
          description: `Transfer ${qty} of item ${itemId} from location ${sourceLocationId} to ${destLocationId}`,
          oldValues: JSON.stringify({ sourceLocationId, sourceBalance }),
          newValues: JSON.stringify({ destLocationId, sourceNewBalance, destNewBalance, transferId }),
        },
      });

      return { transferId, sourceNewBalance, destNewBalance };
    });

    return result;
  }

  /**
   * FIX #2: Atomic balance check for damage entry.
   * FIX #9: Closes out asset installations at the damaged location.
   */
  async createDamageEntry(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    locationId: number;
    qty: number;
    targetStoreLocationId: number;
    rate?: number;
    reportedBy: string;
    reason: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const { companyId, financialYearId, itemId, locationId, qty, targetStoreLocationId, rate = 0, reportedBy, reason, remarks, transactionDate } = data;

    const now = transactionDate || new Date();
    const damageId = `DMG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // FIX #2: Atomic balance check inside the transaction
      const validation = await validateSufficientStock(tx, companyId, financialYearId, itemId, null, locationId, qty);
      if (!validation.sufficient) {
        throw new Error(`Insufficient stock: ${validation.itemName} has ${validation.available} at location ${locationId}, requested ${validation.requested}`);
      }

      const locationBalance = validation.available;
      const locationNewBalance = locationBalance - qty;
      const storeBalance = await getLatestBalance(tx, companyId, financialYearId, itemId, null, targetStoreLocationId);
      const storeNewBalance = storeBalance + qty;

      const damageOutTxn = {
        companyId, financialYearId, itemId,
        locationId,
        transactionType: 'DAMAGE_OUT',
        transactionDate: now,
        quantityIn: new Prisma.Decimal(0),
        quantityOut: new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(rate),
        balanceQty: new Prisma.Decimal(locationNewBalance),
        condition: 'GOOD',
        referenceType: 'DamageEntry',
        referenceId: null as number | null,
        referenceNo: damageId,
        remarks: remarks || `Damage: ${reason}`,
        createdBy: reportedBy,
      };

      const damageTransferInTxn = {
        companyId, financialYearId, itemId,
        locationId: targetStoreLocationId,
        transactionType: 'DAMAGE_TRANSFER_IN',
        transactionDate: now,
        quantityIn: new Prisma.Decimal(qty),
        quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(rate),
        balanceQty: new Prisma.Decimal(storeNewBalance),
        condition: 'DAMAGED',
        referenceType: 'DamageEntry',
        referenceNo: damageId,
        remarks: remarks || `Damaged item from location ${locationId}`,
        createdBy: reportedBy,
      };

      await tx.damageEntry.create({
        data: {
          companyId, itemId, locationId, date: now, quantity: qty,
          reason, reportedBy, remarks, status: 'Posted',
        },
      });

      await tx.stockTransaction.createMany({ data: [damageOutTxn, damageTransferInTxn] });

      // FIX #4: Recalculate balances if backdated
      await this.recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, null, locationId, now);
      await this.recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, null, targetStoreLocationId, now);

      // FIX #9: Close out active asset installations at the damaged location
      await this.closeAssetInstallations(tx, companyId, itemId, locationId, now, reportedBy, `Item damaged: ${reason}`);

      await tx.auditLog.create({
        data: {
          companyId,
          action: 'DAMAGE',
          tableName: 'StockTransaction',
          description: `Damage ${qty} of item ${itemId} at location ${locationId}, moved to store ${targetStoreLocationId}`,
          oldValues: JSON.stringify({ locationId, locationBalance }),
          newValues: JSON.stringify({ targetStoreLocationId, locationNewBalance, storeNewBalance, damageId }),
        },
      });

      return { damageId, locationNewBalance, storeNewBalance };
    });

    return result;
  }

  async createReplacement(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    damagedLocationId: number;
    replacementLocationId: number;
    qty: number;
    sourceStoreLocationId: number;
    rate?: number;
    replacedBy: string;
    remarks?: string;
  }) {
    const { companyId, financialYearId, itemId, damagedLocationId, replacementLocationId, qty, sourceStoreLocationId, rate = 0, replacedBy, remarks } = data;

    const storeBalance = await this.getBalance(companyId, financialYearId, itemId, null, sourceStoreLocationId);
    if (storeBalance < qty) {
      const item = await this.prisma.item.findUnique({ where: { id: itemId } });
      throw new Error(`Insufficient stock: ${item?.itemName || 'Unknown'} has ${storeBalance} at store ${sourceStoreLocationId}, requested ${qty}`);
    }

    const transferResult = await this.createTransfer({
      companyId, financialYearId, itemId,
      sourceLocationId: sourceStoreLocationId,
      destLocationId: replacementLocationId,
      qty, rate, transferredBy: replacedBy,
      remarks: remarks || `Replacement for damaged item at location ${damagedLocationId}`,
    });

    return { ...transferResult, damagedLocationId };
  }

  /**
   * FIX #4: After inserting a potentially backdated transaction, recalculate
   * balanceQty for all rows at the same item+location, starting from the
   * inserted row onwards. Ordered by (transactionDate, id) for chronological consistency.
   */
  private async recalculateBalancesAfterInsert(
    tx: Prisma.TransactionClient,
    companyId: number,
    financialYearId: number,
    itemId: number,
    departmentId: number | null,
    locationId: number | null,
    insertedDate: Date,
  ): Promise<void> {
    return recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, departmentId, locationId, insertedDate);
  }

  /**
   * FIX #9: Close out active asset installations when stock moves away.
   * Called when TRANSFER_OUT or DAMAGE_OUT is created for an item+location.
   */
  private async closeAssetInstallations(
    tx: Prisma.TransactionClient,
    companyId: number,
    itemId: number,
    locationId: number,
    closedDate: Date,
    closedBy: string,
    reason: string,
  ): Promise<void> {
    const activeInstallations = await tx.assetInstallation.findMany({
      where: {
        itemId,
        locationId,
        status: 'Active',
      },
    });

    for (const installation of activeInstallations) {
      await tx.assetInstallation.update({
        where: { id: installation.id },
        data: {
          status: 'Inactive',
          remarks: `${reason} (closed on ${closedDate.toISOString().split('T')[0]} by ${closedBy})`,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          action: 'UPDATE',
          tableName: 'AssetInstallation',
          recordId: installation.id,
          description: `Asset installation #${installation.id} deactivated: ${reason}`,
          oldValues: JSON.stringify({ status: 'Active' }),
          newValues: JSON.stringify({ status: 'Inactive', closedDate }),
        },
      });
    }
  }
}
