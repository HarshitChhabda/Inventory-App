import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import type { CreateTransactionInput } from '../../shared/types';

export class VendorReturnService {
  private transactionEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.transactionEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  async create(data: {
    companyId: number;
    financialYearId: number;
    vendorId: number;
    storeId: number;
    date: Date;
    reason: string;
    returnedBy: string;
    remarks?: string;
    items: Array<{ itemId: number; quantity: number; rate?: number; condition?: string }>;
  }) {
    const input: CreateTransactionInput = {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType: 'VR',
      transactionDate: data.date,
      fromStoreId: data.storeId,
      vendorId: data.vendorId,
      purpose: data.reason,
      issuedBy: data.returnedBy,
      remarks: data.remarks,
      createdBy: data.returnedBy,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        condition: item.condition || 'DAMAGED',
      })),
    };

    return this.transactionEngine.createTransaction(input);
  }

  async cancel(id: number, cancelReason: string, cancelledBy: string) {
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const original = await this.prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: true },
    });
    if (!original) throw new Error('Vendor return transaction not found');

    return this.transactionEngine.reverseAndCancel({
      companyId: original.companyId,
      financialYearId: original.financialYearId,
      transactionDate: new Date(),
      fromStoreId: original.fromStoreId,
      toStoreId: original.toStoreId,
      remarks: `Reversal for cancelled ${original.voucherNo}: ${cancelReason}`,
      createdBy: cancelledBy,
      items: original.details.map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
      })),
    }, id, cancelReason);
  }

  async findAll(companyId: number, financialYearId: number) {
    return this.prisma.transactionHeader.findMany({
      where: { companyId, financialYearId, voucherType: 'VR' },
      include: {
        details: { include: { item: true } },
        vendor: true,
      },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async findById(id: number) {
    return this.prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        details: { include: { item: true } },
        vendor: true,
      },
    });
  }
}
