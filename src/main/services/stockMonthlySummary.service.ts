import { PrismaClient } from '@prisma/client';

/**
 * StockMonthlySummary — O(1) monthly trend queries.
 *
 * Pre-aggregated monthly stock movement data derived from LedgerEntry.
 * Updated atomically within transactions that create/cancel ledger entries.
 * LedgerEntry remains the authoritative historical record.
 * Summary can be completely rebuilt from LedgerEntry.
 */
export class StockMonthlySummaryService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Incrementally update summary after ledger entries are created.
   * Call inside the same transaction as ledgerEntry.createMany.
   */
  async updateSummary(
    tx: Prisma.TransactionClient,
    companyId: number,
    financialYearId: number,
    entries: Array<{ quantityIn: number; quantityOut: number; transactionDate: Date }>,
  ): Promise<void> {
    // Group entries by yearMonth
    const monthlyAgg = new Map<string, { tin: number; tout: number }>();
    for (const e of entries) {
      const d = new Date(e.transactionDate);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = monthlyAgg.get(ym) || { tin: 0, tout: 0 };
      cur.tin += Number(e.quantityIn);
      cur.tout += Number(e.quantityOut);
      monthlyAgg.set(ym, cur);
    }

    for (const [ym, agg] of monthlyAgg) {
      await tx.$executeRawUnsafe(
        `INSERT INTO StockMonthlySummary (companyId, financialYearId, yearMonth, quantityIn, quantityOut)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(companyId, financialYearId, yearMonth) DO UPDATE SET
           quantityIn = quantityIn + excluded.quantityIn,
           quantityOut = quantityOut + excluded.quantityOut`,
        companyId, financialYearId, ym, agg.tin, agg.tout
      );
    }
  }

  /**
   * Read monthly trend from summary. O(12) — always returns ≤12 rows.
   */
  async getMonthlyTrend(
    companyId: number,
    financialYearId: number,
    monthsBack: number = 12,
  ): Promise<Array<{ month: string; inbound: number; outbound: number }>> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    const cutoffYM = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ yearMonth: string; quantityIn: number; quantityOut: number }>>(
      `SELECT yearMonth, quantityIn, quantityOut FROM StockMonthlySummary
       WHERE companyId = ? AND financialYearId = ? AND yearMonth >= ?
       ORDER BY yearMonth ASC`,
      companyId, financialYearId, cutoffYM
    );

    return rows.map(r => ({
      month: r.yearMonth,
      inbound: Number(r.quantityIn),
      outbound: Number(r.quantityOut),
    }));
  }

  /**
   * Rebuild all monthly summaries from LedgerEntry.
   * Called on first startup if summary is empty, or for reconciliation.
   */
  async rebuildAll(companyId: number, financialYearId: number): Promise<number> {
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM StockMonthlySummary WHERE companyId = ? AND financialYearId = ?',
      companyId, financialYearId
    );

    const rows = await this.prisma.$queryRawUnsafe<Array<{ ym: string; tin: number; tout: number }>>(
      `SELECT strftime('%Y-%m', transactionDate) as ym, CAST(SUM(quantityIn) AS TEXT) as tin, CAST(SUM(quantityOut) AS TEXT) as tout
       FROM LedgerEntry WHERE companyId = ? AND financialYearId = ?
       GROUP BY ym ORDER BY ym ASC`,
      companyId, financialYearId
    );

    for (const r of rows) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO StockMonthlySummary (companyId, financialYearId, yearMonth, quantityIn, quantityOut)
         VALUES (?, ?, ?, ?, ?)`,
        companyId, financialYearId, r.ym, Number(r.tin), Number(r.tout)
      );
    }

    return rows.length;
  }
}
