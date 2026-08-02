import { PrismaClient } from '@prisma/client';

export class FinancialYearService {
  constructor(private prisma: PrismaClient) {}

  async create(data: { companyId: number; label: string; startDate: Date; endDate: Date }) {
    const existing = await this.prisma.financialYear.findUnique({
      where: { companyId_label: { companyId: data.companyId, label: data.label } },
    });
    if (existing) throw new Error(`Financial year "${data.label}" already exists`);
    return this.prisma.financialYear.create({ data: { companyId: data.companyId, label: data.label, startDate: data.startDate, endDate: data.endDate } });
  }

  async findAll(companyId: number) {
    return this.prisma.financialYear.findMany({ where: { companyId }, orderBy: { startDate: 'desc' } });
  }

  async findById(id: number) {
    return this.prisma.financialYear.findUnique({ where: { id }, include: { company: true } });
  }

  async closeFinancialYear(id: number, userId?: number) {
    const fy = await this.prisma.financialYear.findUnique({
      where: { id },
      include: { company: true, receiptChallans: { where: { status: 'Draft' } }, issueChallans: { where: { status: 'Draft' } }, transferChallans: { where: { status: 'Draft' } } },
    });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Financial year is already closed');
    if (fy.receiptChallans.length > 0 || fy.issueChallans.length > 0 || fy.transferChallans.length > 0) {
      throw new Error('Cannot close financial year with draft challans');
    }

    const nextFyLabel = this.getNextFyLabel(fy.label);
    const nextStartDate = new Date(fy.endDate);
    nextStartDate.setDate(nextStartDate.getDate() + 1);
    const nextEndDate = new Date(nextStartDate);
    nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
    nextEndDate.setDate(nextEndDate.getDate() - 1);

    // FIX #7: Query per (itemId, locationId) — not just per itemId
    // This preserves location-wise stock distribution across FY boundaries
    const lastEntries = await this.prisma.$queryRaw<any[]>`
      SELECT se.itemId, se.locationId, se.balanceQty, se.condition
      FROM StockTransaction se
      WHERE se.financialYearId = ${id}
      AND se.id = (
        SELECT se2.id FROM StockTransaction se2
        WHERE se2.itemId = se.itemId
        AND ((se2.locationId = se.locationId) OR (se2.locationId IS NULL AND se.locationId IS NULL))
        AND se2.financialYearId = ${id}
        ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1
      )
      AND se.balanceQty > 0
    `;

    const nextFy = await this.prisma.financialYear.upsert({
      where: { companyId_label: { companyId: fy.companyId, label: nextFyLabel } },
      update: {},
      create: { companyId: fy.companyId, label: nextFyLabel, startDate: nextStartDate, endDate: nextEndDate },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const entry of lastEntries) {
        // FIX #7: Create OPENING_STOCK per (itemId, locationId, condition)
        await tx.stockTransaction.create({
          data: {
            companyId: fy.companyId, financialYearId: nextFy.id, itemId: entry.itemId,
            locationId: entry.locationId || undefined,
            transactionType: 'OPENING_STOCK', transactionDate: nextStartDate,
            quantityIn: entry.balanceQty, balanceQty: entry.balanceQty,
            condition: entry.condition || 'GOOD',
            remarks: `Opening balance carried forward from ${fy.label}`, createdBy: 'System',
          },
        });
      }
      // Create OpeningStock records for backward compatibility — aggregate per item
      const itemBalances = new Map<number, number>();
      for (const entry of lastEntries) {
        const current = itemBalances.get(entry.itemId) || 0;
        itemBalances.set(entry.itemId, current + Number(entry.balanceQty));
      }
      for (const [itemId, totalQty] of itemBalances) {
        await tx.openingStock.create({
          data: {
            financialYearId: nextFy.id,
            itemId,
            quantity: totalQty,
            rate: 0,
          },
        });
      }
      await tx.financialYear.update({ where: { id }, data: { isClosed: true, closedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          companyId: fy.companyId, userId: userId || undefined, action: 'UPDATE', tableName: 'FinancialYear', recordId: id, recordUuid: fy.uuid,
          description: `Financial year ${fy.label} closed. Opening balances created for ${nextFyLabel}.`,
          newValues: JSON.stringify({ isClosed: true, closedAt: new Date() }),
        },
      });
    });

    return nextFy;
  }

  private getNextFyLabel(currentLabel: string): string {
    const match = currentLabel.match(/(\d{4})-?(\d{2,4})/);
    if (!match) throw new Error('Invalid FY label format');
    const startYear = parseInt(match[1]);
    const nextStartYear = startYear + 1;
    const nextEndStr = String(nextStartYear + 1).slice(-2);
    return `${nextStartYear}-${nextEndStr}`;
  }
}
