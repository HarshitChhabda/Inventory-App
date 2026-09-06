import { PrismaClient, Prisma } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import { formatDateDDMMYYYY } from '../../shared/dateUtils';
import type { TransactionItem, CreateTransactionInput } from '../../shared/types';

export type DamageType = 'SCRAP' | 'REPAIRABLE' | 'LOST' | 'BROKEN' | 'EXPIRED';

export class DamageService {
  private txEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.txEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  /**
   * Create a damage entry using the unified TransactionEngine.
   * All damage movements go through the engine as DAMAGE_OUT transactions.
   */
  async create(data: {
    companyId?: number; itemId: number; departmentId?: number; locationId?: number;
    financialYearId?: number;
    assetInstallationId?: number; date: Date; quantity: number;
    reason: string; reportedBy: string; remarks?: string;
    damageType?: DamageType;
    storeId?: number;
  }) {
    const item = await this.prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw new Error('Item not found');

    if (!data.companyId) throw new Error('Company ID is required for damage entry');
    const companyId = data.companyId;
    const damageType = data.damageType || 'SCRAP';

    // Resolve financial year
    let financialYearId = data.financialYearId;
    if (!financialYearId) {
      const matchingFY = await this.prisma.financialYear.findFirst({
        where: {
          companyId,
          startDate: { lte: data.date },
          endDate: { gte: data.date },
          isClosed: false,
        },
      });
      if (!matchingFY) {
        throw new Error(`No open financial year found for date ${formatDateDDMMYYYY(data.date)}`);
      }
      financialYearId = matchingFY.id;
    }

    // Resolve store - damage always affects a specific store
    if (!data.storeId) {
      throw new Error('Store ID is required for damage entry. Cannot default to a fallback store.');
    }
    const storeId = data.storeId;

    // Validate sufficient stock
    const validation = await this.stockEngine.validateStock(
      companyId, financialYearId, data.itemId, storeId, data.quantity
    );
    if (!validation.valid) {
      throw new Error(`Insufficient stock for damage. Available: ${validation.available}, Damage: ${data.quantity}`);
    }

    // Create damage transaction through TransactionEngine
    const txInput: CreateTransactionInput = {
      companyId,
      financialYearId,
      voucherType: 'DM',
      transactionDate: data.date,
      fromStoreId: storeId,
      toStoreId: undefined, // Damage doesn't transfer to another store
      fromLocationId: data.locationId,
      reasonId: undefined,
      departmentId: data.departmentId,
      referenceNo: `DMG-${damageType}-${data.itemId}`,
      purpose: `Damage (${damageType}): ${data.reason}`,
      remarks: data.remarks || `Reported by ${data.reportedBy}`,
      createdBy: data.reportedBy,
      items: [{
        itemId: data.itemId,
        quantity: data.quantity,
        condition: 'DAMAGED',
        remarks: `Damage (${damageType}): ${data.reason}`,
      }],
    };

    const result = await this.txEngine.createTransaction(txInput);

    // Close out active asset installations if location specified
    if (data.locationId) {
      await this.prisma.$transaction(async (tx) => {
        const activeInstallations = await tx.assetInstallation.findMany({
          where: { itemId: data.itemId, roomId: data.locationId, status: 'ACTIVE' },
        });
        for (const installation of activeInstallations) {
          await tx.assetInstallation.update({
            where: { id: installation.id },
            data: {
              status: 'INACTIVE',
              remarks: `Item damaged (${damageType}): ${data.reason} (closed on ${formatDateDDMMYYYY(data.date)} by ${data.reportedBy})`,
            },
          });
        }
      });
    }

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'CREATE',
        tableName: 'TransactionHeader',
        recordId: result.transactionId,
        description: `Damage entry (${damageType}): ${data.quantity} x ${item.itemName} (${data.reason})`,
        newValues: JSON.stringify({ damageType, quantity: data.quantity, reason: data.reason }),
      },
    });

    return {
      id: result.transactionId,
      voucherNo: result.voucherNo,
      damageType,
      quantity: data.quantity,
      item: { itemName: item.itemName, itemCode: item.itemCode },
    };
  }

  async findAll(companyId?: number, page = 1, pageSize = 50, itemId?: number, startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (itemId) where.itemId = itemId;
    if (startDate && endDate) where.transactionDate = { gte: startDate, lte: endDate };

    const [data, total] = await Promise.all([
      this.prisma.transactionHeader.findMany({
        where: { ...where, voucherType: 'DM' },
        include: {
          details: { include: { item: true } },
          fromStore: true,
          reason: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.transactionHeader.count({ where: { ...where, voucherType: 'DM' } }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(id: number) {
    return this.prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        details: { include: { item: true } },
        fromStore: true,
        toStore: true,
        fromLocation: true,
        reason: true,
      },
    });
  }

  /**
   * Recover a damaged item — mark it as good again.
   * Creates a REVERSAL movement that reverses the DAMAGE_OUT, restoring available stock.
   *
   * Workflow: Damaged → Reversal → Available
   */
  async recoverFromDamage(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    storeId: number;
    quantity: number;
    originalDamageVoucherNo?: string;
    recoveredBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const {
      companyId, financialYearId, itemId, storeId, quantity,
      originalDamageVoucherNo, recoveredBy, remarks, transactionDate,
    } = data;

    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Item not found');

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new Error('Store not found');

    // Validate that damaged stock exists
    const breakdown = await this.stockEngine.getStockBreakdown(
      companyId, financialYearId, itemId, storeId,
    );
    if (breakdown.damaged < quantity) {
      throw new Error(
        `Insufficient damaged stock: ${item.itemName} has ${breakdown.damaged} damaged at ${store.name}, requested recovery ${quantity}`
      );
    }

    if (!transactionDate) {
      throw new Error('Transaction Date is required for damaged stock recovery');
    }
    const now = transactionDate;

    // Create reversal transaction through TransactionEngine
    const txInput: CreateTransactionInput = {
      companyId,
      financialYearId,
      voucherType: 'RV',
      transactionDate: now,
      fromStoreId: storeId,
      referenceNo: originalDamageVoucherNo,
      purpose: `Damage recovery: ${item.itemName}`,
      remarks: remarks || `Item found good after damage inspection. Recovered by ${recoveredBy}`,
      createdBy: recoveredBy,
      items: [{
        itemId,
        quantity,
        condition: 'GOOD',
        remarks: `Damage reversal: ${remarks || 'Item found good'}`,
      }],
    };

    const result = await this.txEngine.createTransaction(txInput);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'CREATE',
        tableName: 'TransactionHeader',
        recordId: result.transactionId,
        description: `Damage recovery: ${quantity} x ${item.itemName} at ${store.name}`,
        newValues: JSON.stringify({
          originalDamageVoucherNo,
          recoveredQuantity: quantity,
          recoveredBy,
        }),
      },
    });

    return {
      id: result.transactionId,
      voucherNo: result.voucherNo,
      itemName: item.itemName,
      itemCode: item.itemCode,
      storeName: store.name,
      quantity,
      message: `${quantity} ${item.itemName} recovered from damage at ${store.name}`,
    };
  }

  /**
   * Repair workflow — send damaged item for repair.
   * Creates REPAIR_OUT movement: Damaged → Repair
   */
  async sendToRepair(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    storeId: number;
    quantity: number;
    sentBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const { companyId, financialYearId, itemId, storeId, quantity, sentBy, remarks, transactionDate } = data;

    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Item not found');

    // Validate damaged stock
    const breakdown = await this.stockEngine.getStockBreakdown(
      companyId, financialYearId, itemId, storeId,
    );
    if (breakdown.damaged < quantity) {
      throw new Error(`Insufficient damaged stock: ${item.itemName} has ${breakdown.damaged} damaged`);
    }

    if (!transactionDate) {
      throw new Error('Transaction Date is required for vendor return');
    }
    const now = transactionDate;

    const txInput: CreateTransactionInput = {
      companyId,
      financialYearId,
      voucherType: 'RO',
      transactionDate: now,
      fromStoreId: storeId,
      purpose: `Send to repair: ${item.itemName}`,
      remarks: remarks || `Sent to repair by ${sentBy}`,
      createdBy: sentBy,
      items: [{
        itemId,
        quantity,
        condition: 'DAMAGED',
        remarks: remarks || `Sent to repair`,
      }],
    };

    const result = await this.txEngine.createTransaction(txInput);

    return {
      id: result.transactionId,
      voucherNo: result.voucherNo,
      itemName: item.itemName,
      quantity,
      message: `${quantity} ${item.itemName} sent to repair`,
    };
  }

  /**
   * Receive repaired item — item returns from repair to available stock.
   * Creates REPAIR_IN movement: Repair → Available
   */
  async receiveFromRepair(data: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    storeId: number;
    quantity: number;
    receivedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }) {
    const { companyId, financialYearId, itemId, storeId, quantity, receivedBy, remarks, transactionDate } = data;

    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Item not found');

    if (!transactionDate) {
      throw new Error('Transaction Date is required for vendor return receipt');
    }
    const now = transactionDate;

    const txInput: CreateTransactionInput = {
      companyId,
      financialYearId,
      voucherType: 'RI',
      transactionDate: now,
      toStoreId: storeId,
      purpose: `Receive from repair: ${item.itemName}`,
      remarks: remarks || `Received from repair by ${receivedBy}`,
      createdBy: receivedBy,
      items: [{
        itemId,
        quantity,
        condition: 'GOOD',
        remarks: remarks || `Received from repair`,
      }],
    };

    const result = await this.txEngine.createTransaction(txInput);

    return {
      id: result.transactionId,
      voucherNo: result.voucherNo,
      itemName: item.itemName,
      quantity,
      message: `${quantity} ${item.itemName} received from repair`,
    };
  }
}
