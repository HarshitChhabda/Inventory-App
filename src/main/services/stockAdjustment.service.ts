import { PrismaClient } from '@prisma/client';
import { TransactionEngine, CreateTransactionInput, TransactionItem } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';

export class StockAdjustmentService {
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
    itemId: number;
    adjustmentType: 'INCREASE' | 'DECREASE';
    quantity: number;
    rate?: number;
    unitId?: number;
    fromStoreId?: number;
    toStoreId?: number;
    departmentId?: number;
    reasonId?: number;
    referenceNo?: string;
    purpose?: string;
    remarks?: string;
    createdBy: string;
  }) {
    const isIncrease = data.adjustmentType === 'INCREASE';

    const input: CreateTransactionInput = {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType: 'AD',
      transactionDate: data.transactionDate,
      fromStoreId: isIncrease ? undefined : data.fromStoreId,
      toStoreId: isIncrease ? data.toStoreId : undefined,
      departmentId: data.departmentId,
      reasonId: data.reasonId,
      referenceNo: data.referenceNo,
      purpose: data.purpose,
      remarks: data.remarks,
      createdBy: data.createdBy,
      items: [
        {
          itemId: data.itemId,
          quantity: data.quantity,
          rate: data.rate,
          condition: 'GOOD',
          unitId: data.unitId,
        },
      ],
    };

    return this.transactionEngine.createTransaction(input);
  }

  async findAll(companyId: number, financialYearId: number, page = 1, pageSize = 50) {
    const where = { companyId, financialYearId, voucherType: 'AD' as const };

    const [data, total] = await Promise.all([
      this.prisma.transactionHeader.findMany({
        where,
        include: {
          details: {
            include: { item: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.transactionHeader.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(id: number, companyId: number) {
    return this.prisma.transactionHeader.findFirst({
      where: { id, companyId, voucherType: 'AD' },
      include: {
        details: {
          include: { item: true },
        },
        fromStore: true,
        toStore: true,
        reason: true,
      },
    });
  }
}
