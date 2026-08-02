import { ipcMain } from 'electron';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { getSession, PERMISSION_KEYS, hasPermission } from '../../src/main/services/auth.service';
import { serialize, requireAuth } from './helpers';

export function registerSettingsIpc() {
  const prisma = getPrismaClient();

  // ─── Company ────────────────────────────────────────────────────
  ipcMain.handle('settings:createCompany', async (_event, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    return serialize(await prisma.company.create({ data }));
  });

  ipcMain.handle('settings:updateCompany', async (_event, id: number, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    return serialize(await prisma.company.update({ where: { id }, data }));
  });

  ipcMain.handle('settings:deleteCompany', async (_event, id: number) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    // Check if company has data
    const fyCount = await prisma.financialYear.count({ where: { companyId: id } });
    if (fyCount > 0) {
      throw new Error('Cannot delete company: it has financial years. Remove them first.');
    }
    return serialize(await prisma.company.delete({ where: { id } }));
  });

  // ─── Financial Year ─────────────────────────────────────────────
  ipcMain.handle('settings:createFinancialYear', async (_event, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }
    return serialize(await prisma.financialYear.create({
      data: {
        ...data,
        companyId: data.companyId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    }));
  });

  ipcMain.handle('settings:updateFinancialYear', async (_event, id: number, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }
    return serialize(await prisma.financialYear.update({
      where: { id },
      data: {
        label: data.label,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    }));
  });

  ipcMain.handle('settings:closeFinancialYear', async (_event, fyId: number) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }

    const fy = await prisma.financialYear.findUnique({
      where: { id: fyId },
      include: { company: true, receiptChallans: { where: { status: 'Draft' } }, issueChallans: { where: { status: 'Draft' } }, transferChallans: { where: { status: 'Draft' } } },
    });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Financial year is already closed');
    if (fy.receiptChallans.length > 0 || fy.issueChallans.length > 0 || fy.transferChallans.length > 0) {
      throw new Error('Cannot close financial year with draft challans');
    }

    // Calculate next FY label using proper parser
    const match = fy.label.match(/(\d{4})-?(\d{2,4})/);
    if (!match) throw new Error('Invalid FY label format');
    const startYear = parseInt(match[1]);
    const nextStartYear = startYear + 1;
    const nextEndStr = String(nextStartYear + 1).slice(-2);
    const nextLabel = `${nextStartYear}-${nextEndStr}`;

    const nextStart = new Date(fy.endDate);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);

    // Get closing balances per (itemId, departmentId, locationId)
    const lastEntries = await prisma.$queryRaw<any[]>`
      SELECT se.itemId, se.departmentId, se.locationId, se.balanceQty, se.rate
      FROM StockTransaction se
      WHERE se.financialYearId = ${fyId}
      AND se.id = (
        SELECT se2.id FROM StockTransaction se2
        WHERE se2.itemId = se.itemId
        AND ((se2.departmentId = se.departmentId) OR (se2.departmentId IS NULL AND se.departmentId IS NULL))
        AND ((se2.locationId = se.locationId) OR (se2.locationId IS NULL AND se.locationId IS NULL))
        AND se2.financialYearId = ${fyId}
        ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1
      )
      AND se.balanceQty > 0
    `;

    const nextFy = await prisma.financialYear.upsert({
      where: { companyId_label: { companyId: fy.companyId, label: nextLabel } },
      update: {},
      create: { companyId: fy.companyId, label: nextLabel, startDate: nextStart, endDate: nextEnd },
    });

    await prisma.$transaction(async (tx) => {
      // Create OPENING_STOCK entries per (itemId, departmentId, locationId)
      // Always use condition='GOOD' — balanceQty is the aggregate balance regardless of condition labels
      for (const entry of lastEntries) {
        const rateValue = entry.rate ?? new Prisma.Decimal(0);
        if (!entry.rate || Number(entry.rate) === 0) {
          console.warn(`[FY-CLOSE] rate fallback for itemId=${entry.itemId}, deptId=${entry.departmentId}, locId=${entry.locationId}: entry.rate was ${entry.rate}, using 0`);
        }
        await tx.stockTransaction.create({
          data: {
            companyId: fy.companyId, financialYearId: nextFy.id, itemId: entry.itemId,
            departmentId: entry.departmentId || undefined,
            locationId: entry.locationId || undefined,
            transactionType: 'OPENING_STOCK', transactionDate: nextStart,
            quantityIn: entry.balanceQty, quantityOut: new Prisma.Decimal(0),
            rate: rateValue, balanceQty: entry.balanceQty,
            condition: 'GOOD',
            remarks: `Opening balance carried forward from ${fy.label}`, createdBy: 'System',
          },
        });
      }
      // Create OpeningStock records for backward compatibility — aggregate per item
      const itemBalances = new Map<number, { qty: number; rate: number }>();
      for (const entry of lastEntries) {
        const current = itemBalances.get(entry.itemId) || { qty: 0, rate: 0 };
        current.qty += Number(entry.balanceQty);
        current.rate = Number(entry.rate) || current.rate; // last known rate wins
        itemBalances.set(entry.itemId, current);
      }
      for (const [itemId, { qty, rate }] of itemBalances) {
        await tx.openingStock.create({
          data: { financialYearId: nextFy.id, itemId, quantity: qty, rate },
        });
      }
      await tx.financialYear.update({ where: { id: fyId }, data: { isClosed: true, closedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          companyId: fy.companyId, userId: user.id, action: 'UPDATE', tableName: 'FinancialYear', recordId: fyId, recordUuid: fy.uuid,
          description: `Financial year ${fy.label} closed. Opening balances created for ${nextLabel}.`,
          newValues: JSON.stringify({ isClosed: true, closedAt: new Date() }),
        },
      });
    });

    return { success: true, nextFy };
  });
}
