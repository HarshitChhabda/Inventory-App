import { PrismaClient, Prisma } from '@prisma/client';
import { StockEngine } from './stockEngine.service';
import { StockBalanceService } from './stockBalance.service';

export class StockLedgerService {
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.stockEngine = new StockEngine(prisma);
  }

  async getLedger(filters: {
    companyId: number;
    financialYearId: number;
    itemId?: number;
    storeId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Record<string, unknown> = {
      companyId: filters.companyId,
      financialYearId: filters.financialYearId,
    };

    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.startDate || filters.endDate) {
      where.transactionDate = {};
      if (filters.startDate) (where.transactionDate as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate) (where.transactionDate as Record<string, Date>).lte = filters.endDate;
    }

    return this.prisma.ledgerEntry.findMany({
      where,
      include: {
        item: true,
        store: true,
        transaction: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: filters.pageSize || 200,
      skip: filters.page ? (filters.page - 1) * (filters.pageSize || 200) : 0,
    });
  }

  async getLedgerBalance(
    companyId: number,
    financialYearId: number,
    itemId: number,
    storeId: number,
  ): Promise<number> {
    return this.stockEngine.getStockBalance(companyId, financialYearId, itemId, storeId);
  }

  async getLedgerByItem(companyId: number, financialYearId: number, itemId: number, page?: number, pageSize?: number) {
    return this.prisma.ledgerEntry.findMany({
      where: { companyId, financialYearId, itemId },
      include: {
        item: true,
        store: true,
        transaction: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize || 200,
      skip: page ? (page - 1) * (pageSize || 200) : 0,
    });
  }

  async getLedgerByStore(companyId: number, financialYearId: number, storeId: number, page?: number, pageSize?: number) {
    return this.prisma.ledgerEntry.findMany({
      where: { companyId, financialYearId, storeId },
      include: {
        item: true,
        store: true,
        transaction: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize || 200,
      skip: page ? (page - 1) * (pageSize || 200) : 0,
    });
  }

  async getRoomStock(
    companyId: number,
    financialYearId: number,
    itemId: number,
    storeId: number,
    locationId: number,
  ): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: {
        companyId,
        financialYearId,
        itemId,
        storeId,
        locationId,
      },
      _sum: { quantityIn: true, quantityOut: true },
    });
    return Number(result._sum.quantityIn || 0) - Number(result._sum.quantityOut || 0);
  }

  async getRoomStockByStore(
    companyId: number,
    financialYearId: number,
    storeId: number,
  ) {
    return this.prisma.ledgerEntry.groupBy({
      by: ['itemId', 'locationId'],
      where: {
        companyId,
        financialYearId,
        storeId,
        locationId: { not: null },
      },
      _sum: { quantityIn: true, quantityOut: true },
    });
  }

  async getItemHistory(companyId: number, financialYearId: number, itemId: number) {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, financialYearId, itemId },
      include: {
        item: true,
        store: true,
        transaction: { include: { department: true, fromStore: true, toStore: true } },
        location: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    return entries.map((entry) => ({
      id: entry.id,
      uuid: entry.uuid,
      voucherNo: entry.voucherNo,
      voucherType: entry.voucherType,
      movementType: entry.movementType,
      quantityIn: Number(entry.quantityIn),
      quantityOut: Number(entry.quantityOut),
      balanceQty: Number(entry.balanceQty),
      rate: Number(entry.rate),
      condition: entry.condition,
      serialNumber: entry.serialNumber,
      batchNumber: entry.batchNumber,
      transactionDate: entry.transactionDate,
      createdBy: entry.createdBy,
      itemName: entry.item?.itemName,
      itemCode: entry.item?.itemCode,
      storeName: entry.store?.name,
      locationId: entry.locationId,
      locationName: entry.location?.name || null,
      departmentId: entry.transaction?.departmentId || null,
      departmentName: entry.transaction?.department?.name || null,
      unitId: entry.item?.unitId || null,
      transactionId: entry.transactionId,
      remarks: entry.transaction?.remarks || null,
    }));
  }

  async getItemHistoryPaginated(
    companyId: number,
    financialYearId: number,
    itemId: number,
    filters: {
      storeId?: number;
      locationId?: number;
      departmentId?: number;
      startDate?: Date;
      endDate?: Date;
      voucherType?: string;
      movementType?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 50, 100);

    const where: Record<string, unknown> = {
      companyId,
      financialYearId,
      itemId,
    };
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.voucherType) where.voucherType = filters.voucherType;
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.departmentId) {
      where.transaction = { departmentId: filters.departmentId };
    }
    if (filters.startDate || filters.endDate) {
      where.transactionDate = {};
      if (filters.startDate) (where.transactionDate as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate) (where.transactionDate as Record<string, Date>).lte = filters.endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        include: {
          item: true,
          store: true,
          transaction: { include: { department: true, fromStore: true, toStore: true } },
          location: true,
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      data: data.map((entry) => ({
        id: entry.id,
        uuid: entry.uuid,
        voucherNo: entry.voucherNo,
        voucherType: entry.voucherType,
        movementType: entry.movementType,
        quantityIn: Number(entry.quantityIn),
        quantityOut: Number(entry.quantityOut),
        balanceQty: Number(entry.balanceQty),
        rate: Number(entry.rate),
        condition: entry.condition,
        serialNumber: entry.serialNumber,
        batchNumber: entry.batchNumber,
        transactionDate: entry.transactionDate,
        createdBy: entry.createdBy,
        itemName: entry.item?.itemName,
        itemCode: entry.item?.itemCode,
        storeName: entry.store?.name,
        locationId: entry.locationId,
        locationName: entry.location?.name || null,
        departmentId: entry.transaction?.departmentId || null,
        departmentName: entry.transaction?.department?.name || null,
        unitId: entry.item?.unitId || null,
        unitName: (entry.item as any)?.unit?.name || null,
        transactionId: entry.transactionId,
        remarks: entry.transaction?.remarks || null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async auditNegativeBalances(companyId: number, financialYearId: number) {
    const negatives = await this.prisma.ledgerEntry.findMany({
      where: {
        companyId,
        financialYearId,
        balanceQty: { lt: 0 },
      },
      include: { item: true, store: true },
      orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
    });

    const pairs = [...new Map(negatives.map((e) => [`${e.itemId}-${e.storeId}`, { itemId: e.itemId, storeId: e.storeId }])).values()];
    const aggregates = await Promise.all(pairs.map((p) => this.prisma.ledgerEntry.aggregate({
      where: { companyId, financialYearId, itemId: p.itemId, storeId: p.storeId },
      _sum: { quantityIn: true, quantityOut: true },
    })));
    const balanceMap = new Map(aggregates.map((a, i) => [
      `${pairs[i].itemId}-${pairs[i].storeId}`,
      Number(a._sum.quantityIn || 0) - Number(a._sum.quantityOut || 0),
    ]));

    return negatives.map((entry) => ({
      ledgerId: entry.id,
      itemCode: entry.item?.itemCode,
      itemName: entry.item?.itemName,
      storeName: entry.store?.name,
      transactionDate: entry.transactionDate,
      voucherNo: entry.voucherNo,
      quantityIn: Number(entry.quantityIn),
      quantityOut: Number(entry.quantityOut),
      oldBalanceQty: Number(entry.balanceQty),
      correctFinalBalance: balanceMap.get(`${entry.itemId}-${entry.storeId}`) || 0,
    }));
  }

  async repairRunningBalances(companyId: number, financialYearId: number) {
    const affectedPairs = await this.prisma.ledgerEntry.groupBy({
      by: ['itemId', 'storeId'],
      where: { companyId, financialYearId },
    });

    // Rebuild CurrentStockBalance for affected pairs (replaces O(N²) running balance recalc)
    const csb = new StockBalanceService(this.prisma);

    let repairedCount = 0;
    for (const pair of affectedPairs) {
      // Delete existing CSB for this pair and rebuild from ledger
      await this.prisma.$executeRawUnsafe(
        'DELETE FROM CurrentStockBalance WHERE companyId = ? AND financialYearId = ? AND storeId = ? AND itemId = ?',
        companyId, financialYearId, pair.storeId, pair.itemId
      );

      const entries = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT itemId, storeId, locationId, movementType, CAST(quantityIn AS TEXT) as quantityIn, CAST(quantityOut AS TEXT) as quantityOut, CAST(rate AS TEXT) as rate
         FROM LedgerEntry WHERE companyId = ? AND financialYearId = ? AND itemId = ? AND storeId = ?
         ORDER BY transactionDate ASC, createdAt ASC, id ASC`,
        companyId, financialYearId, pair.itemId, pair.storeId
      );

      let av = 0, inst = 0, dmg = 0, rep = 0, scr = 0, tv = 0;
      for (const e of entries) {
        const d = csb.computeDelta(e.movementType, Number(e.quantityIn), Number(e.quantityOut), e.locationId);
        av += d.availableDelta; inst += d.installedDelta; dmg += d.damagedDelta;
        rep += d.repairDelta; scr += d.scrapDelta;
        tv += (Number(e.quantityIn) - Number(e.quantityOut)) * Number(e.rate || 0);
      }

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO CurrentStockBalance (companyId, financialYearId, storeId, itemId, availableQty, installedQty, damagedQty, repairQty, scrapQty, totalValue)
         VALUES (?, ?, ?, ?, MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?))`,
        companyId, financialYearId, pair.storeId, pair.itemId, av, inst, dmg, rep, scr, tv
      );
      repairedCount++;
    }
    return { repairedCount, pairsProcessed: affectedPairs.length };
  }
}
