import { PrismaClient } from '@prisma/client';
import { TransactionEngine, TransactionResult } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import { CreateTransactionInput } from '../../shared/types';

export class ReceiptChallanService {
  private transactionEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.transactionEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  async create(data: {
    companyId: number;
    financialYearId: number;
    transactionDate: Date;
    toStoreId?: number;
    vendorId?: number;
    departmentId?: number;
    referenceNo?: string;
    vehicleNumber?: string;
    receivedBy?: string;
    remarks?: string;
    createdBy: string;
    items: Array<{
      itemId: number;
      quantity: number;
      rate?: number;
      unitId?: number;
      serialNumber?: string;
      batchNumber?: string;
      condition?: string;
      remarks?: string;
    }>;
  }): Promise<TransactionResult> {
    const input: CreateTransactionInput = {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType: 'RC',
      transactionDate: data.transactionDate,
      toStoreId: data.toStoreId,
      vendorId: data.vendorId,
      departmentId: data.departmentId,
      referenceNo: data.referenceNo,
      vehicleNumber: data.vehicleNumber,
      receivedBy: data.receivedBy,
      remarks: data.remarks,
      createdBy: data.createdBy,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        unitId: item.unitId,
        serialNumber: item.serialNumber,
        batchNumber: item.batchNumber,
        condition: item.condition || 'GOOD',
        remarks: item.remarks,
      })),
    };

    return this.transactionEngine.createTransaction(input);
  }

  async post(id: number, postedBy: string) {
    const transaction = await this.prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            item: true,
          },
        },
        vendor: true,
        toStore: true,
      },
    });

    if (!transaction) throw new Error('Receipt challan not found');
    if (transaction.approvalStatus !== 'DRAFT') {
      throw new Error(`Challan is not in Draft status (current: ${transaction.approvalStatus})`);
    }

    return this.prisma.transactionHeader.update({
      where: { id },
      data: {
        approvalStatus: 'POSTED',
        postedBy,
        postedAt: new Date(),
      },
      include: {
        details: {
          include: {
            item: true,
          },
        },
        vendor: true,
        toStore: true,
      },
    });
  }

  async findAll(
    companyId: number,
    financialYearId: number,
    options?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    },
  ) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;

    const where: any = {
      companyId,
      financialYearId,
      voucherType: 'RC',
    };

    if (options?.status) {
      where.approvalStatus = options.status;
    }

    if (options?.search) {
      where.OR = [
        { voucherNo: { contains: options.search, mode: 'insensitive' } },
        { referenceNo: { contains: options.search, mode: 'insensitive' } },
        { vendor: { vendorName: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.transactionHeader.findMany({
        where,
        include: {
        details: {
          include: {
            item: true,
          },
        },
        vendor: true,
        toStore: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transactionHeader.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: number) {
    const transaction = await this.prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            item: true,
          },
        },
        vendor: true,
        toStore: true,
      },
    });

    if (!transaction) throw new Error('Receipt challan not found');
    if (transaction.voucherType !== 'RC') {
      throw new Error('Transaction is not a receipt challan');
    }

    return transaction;
  }

  async cancel(id: number, cancelReason: string, cancelledBy: string) {
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new Error('Cancel reason is required');
    }

    const transaction = await this.prisma.transactionHeader.findUnique({
      where: { id },
    });

    if (!transaction) throw new Error('Receipt challan not found');
    if (transaction.voucherType !== 'RC') {
      throw new Error('Transaction is not a receipt challan');
    }
    if (transaction.approvalStatus !== 'POSTED') {
      throw new Error(`Only posted challans can be cancelled (current status: ${transaction.approvalStatus})`);
    }

    const details = await this.prisma.transactionDetail.findMany({
      where: { transactionId: id },
    });

    return this.transactionEngine.reverseAndCancel({
      companyId: transaction.companyId,
      financialYearId: transaction.financialYearId,
      transactionDate: new Date(),
      fromStoreId: transaction.toStoreId,
      remarks: `Reversal for cancelled ${transaction.voucherNo}: ${cancelReason}`,
      createdBy: cancelledBy,
      items: details.map((d) => ({
        itemId: d.itemId,
        quantity: Number(d.quantity),
        rate: Number(d.rate || 0),
        serialNumber: d.serialNumber || null,
      })),
    }, id, cancelReason);
  }

  async delete(id: number) {
    const transaction = await this.prisma.transactionHeader.findUnique({
      where: { id },
    });

    if (!transaction) throw new Error('Receipt challan not found');
    if (transaction.voucherType !== 'RC') {
      throw new Error('Transaction is not a receipt challan');
    }
    if (transaction.approvalStatus === 'POSTED') {
      throw new Error('Cannot delete a posted challan. Use cancel instead to preserve audit trail.');
    }
    if (transaction.approvalStatus === 'REVERSED') {
      throw new Error('Cannot delete a reversed challan');
    }
    if (transaction.approvalStatus === 'CANCELLED') {
      throw new Error('Cannot delete a cancelled challan');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });
      await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
      await tx.transactionHeader.delete({ where: { id } });
      return { success: true };
    });
  }
}
