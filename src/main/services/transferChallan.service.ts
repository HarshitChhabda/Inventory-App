import { PrismaClient } from '@prisma/client';
import { TransactionEngine, CreateTransactionInput } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';

export class TransferChallanService {
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
    transferredBy: string;
    approvedBy?: string;
    remarks?: string;
    items: Array<{
      itemId: number;
      quantity: number;
      rate?: number;
      fromLocationId?: number;
      toLocationId?: number;
      remarks?: string;
    }>;
  }) {
    const input: CreateTransactionInput = {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType: 'TC',
      transactionDate: data.date,
      fromStoreId: data.fromStoreId,
      toStoreId: data.toStoreId,
      issuedBy: data.transferredBy,
      receivedBy: data.approvedBy,
      remarks: data.remarks,
      createdBy: data.transferredBy,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        fromLocationId: item.fromLocationId,
        toLocationId: item.toLocationId,
        remarks: item.remarks,
      })),
    };

    return this.transactionEngine.createTransaction(input);
  }

  async cancel(id: number, reason: string, cancelledBy: string) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const original = await this.prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: true },
    });
    if (!original) throw new Error('Transfer challan not found');
    if (original.approvalStatus !== 'POSTED') {
      throw new Error(`Only posted challans can be cancelled (current status: ${original.approvalStatus})`);
    }

    return this.transactionEngine.reverseAndCancel({
      companyId: original.companyId,
      financialYearId: original.financialYearId,
      transactionDate: new Date(),
      fromStoreId: original.fromStoreId,
      toStoreId: original.toStoreId,
      remarks: `Reversal for cancelled ${original.voucherNo}: ${reason}`,
      createdBy: cancelledBy,
      items: original.details.map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
        fromLocationId: item.fromLocationId || null,
        toLocationId: item.toLocationId || null,
      })),
    }, id, reason);
  }

  async findAll(companyId: number, financialYearId: number) {
    return this.prisma.transactionHeader.findMany({
      where: {
        companyId,
        financialYearId,
        voucherType: 'TC',
      },
      include: {
        fromStore: true,
        toStore: true,
        details: {
          include: { item: true },
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
          include: { item: true },
        },
      },
    });
  }
}
