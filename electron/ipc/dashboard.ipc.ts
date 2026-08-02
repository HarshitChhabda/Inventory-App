import { ipcMain } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { requireAuth } from './helpers';

function settle<T>(result: PromiseSettledResult<T>, fallback: T, label: string): { data: T; warning?: string } {
  if (result.status === 'fulfilled') return { data: result.value };
  console.error(`[Dashboard] ${label} failed:`, result.reason?.message || result.reason);
  return { data: fallback, warning: `${label}: ${result.reason?.message || 'unknown error'}` };
}

export function registerDashboardIpc() {
  const prisma = getPrismaClient();

  ipcMain.handle('dashboard:getData', async (_event, companyId: number, financialYearId: number) => {
    requireAuth();
    const warnings: string[] = [];

    const results = await Promise.allSettled([
      prisma.stockTransaction.findMany({                           // 0: stock
        where: { companyId, financialYearId },
        select: {
          itemId: true, quantityIn: true, quantityOut: true, rate: true,
          transactionDate: true, item: { include: { category: true } }, department: true,
        },
      }),
      prisma.item.findMany({                                       // 1: items
        where: { isActive: true },
        include: { unit: true, category: true },
        take: 2000,
      }),
      prisma.receiptChallan.findMany({                             // 2: receipts
        where: { companyId, financialYearId, status: 'Posted' },
        include: { items: { include: { item: true } } },
        take: 2000,
      }),
      prisma.issueChallan.findMany({                               // 3: issues
        where: { companyId, financialYearId, status: 'Posted' },
        include: { items: { include: { item: true } } },
        take: 2000,
      }),
      prisma.receiptChallan.findMany({                             // 4: pendingReceipts
        where: { companyId, financialYearId, status: 'Draft' }, take: 500,
      }),
      prisma.issueChallan.findMany({                               // 5: pendingIssues
        where: { companyId, financialYearId, status: 'Draft' }, take: 500,
      }),
      prisma.transferChallan.findMany({                            // 6: pendingTransfers
        where: { companyId, financialYearId, status: 'Draft' }, take: 500,
      }),
      prisma.stockTransaction.findMany({                           // 7: recentTransactions
        where: { companyId, financialYearId },
        include: { item: true, department: true },
        orderBy: { transactionDate: 'desc' },
        take: 50,
      }),
    ]);

    const stock = settle(results[0], [], 'Stock transactions').data;
    const items = settle(results[1], [], 'Items').data;
    const receipts = settle(results[2], [], 'Receipt challans').data;
    const issues = settle(results[3], [], 'Issue challans').data;
    const pendingReceipts = settle(results[4], [], 'Pending receipts').data;
    const pendingIssues = settle(results[5], [], 'Pending issues').data;
    const pendingTransfers = settle(results[6], [], 'Pending transfers').data;
    const recentTransactions = settle(results[7], [], 'Recent transactions').data;

    for (const r of results) {
      if (r.status === 'rejected') warnings.push(r.reason?.message || 'Query failed');
    }

    const totalItems = items.length;
    const totalReceiptQty = receipts.length;
    const totalIssueQty = issues.length;
    const stockValue = stock.reduce((sum, t) => sum + (Number(t.quantityIn || 0) * Number(t.rate || 0)) - (Number(t.quantityOut || 0) * Number(t.rate || 0)), 0);
    const availableQty = stock.reduce((sum, t) => sum + Number(t.quantityIn || 0) - Number(t.quantityOut || 0), 0);
    const pendingDrafts = pendingReceipts.length + pendingIssues.length + pendingTransfers.length;

    const monthlyData: Record<string, { inbound: number; outbound: number; inboundValue: number; outboundValue: number; month: string }> = {};
    stock.forEach((t) => {
      const d = new Date(t.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        monthlyData[key] = { inbound: 0, outbound: 0, inboundValue: 0, outboundValue: 0, month: monthNames[d.getMonth()] };
      }
      const qtyIn = Number(t.quantityIn || 0);
      const qtyOut = Number(t.quantityOut || 0);
      const rate = Number(t.rate || 0);
      monthlyData[key].inbound += qtyIn;
      monthlyData[key].outbound += qtyOut;
      monthlyData[key].inboundValue += qtyIn * rate;
      monthlyData[key].outboundValue += qtyOut * rate;
    });
    const monthlyMovement = Object.entries(monthlyData).slice(-12).map(([, v]) => v);

    const stockTrend: { month: string; value: number }[] = [];
    let cumulative = 0;
    monthlyMovement.forEach((m) => {
      cumulative += m.inboundValue - m.outboundValue;
      stockTrend.push({ month: m.month, value: Math.max(0, cumulative) });
    });

    const itemConsumption: Record<string, { name: string; consumed: number }> = {};
    stock.forEach((t) => {
      if (Number(t.quantityOut || 0) > 0) {
        const name = t.item?.itemName || `Item #${t.itemId}`;
        if (!itemConsumption[name]) itemConsumption[name] = { name: name.slice(0, 25), consumed: 0 };
        itemConsumption[name].consumed += Number(t.quantityOut || 0);
      }
    });
    const topConsumed = Object.values(itemConsumption).sort((a, b) => b.consumed - a.consumed).slice(0, 10);

    const deptConsumption: Record<string, { name: string; consumed: number }> = {};
    stock.forEach((t) => {
      if (Number(t.quantityOut || 0) > 0) {
        const name = t.department?.name || 'General';
        if (!deptConsumption[name]) deptConsumption[name] = { name, consumed: 0 };
        deptConsumption[name].consumed += Number(t.quantityOut || 0);
      }
    });
    const deptWise = Object.values(deptConsumption).slice(0, 8);

    const catDistribution: Record<string, { name: string; value: number }> = {};
    stock.forEach((t) => {
      const name = t.item?.category?.name || 'Uncategorized';
      if (!catDistribution[name]) catDistribution[name] = { name, value: 0 };
      catDistribution[name].value += Number(t.quantityIn || 0) - Number(t.quantityOut || 0);
    });
    const categoryData = Object.values(catDistribution).filter((c) => c.value > 0).slice(0, 6);

    const receiptVsIssue = monthlyMovement.map((m) => ({ month: m.month, receipts: m.inbound, issues: m.outbound }));

    const lowStockItems = items
      .filter((i) => Number(i.minimumStockLevel) > 0)
      .map((i) => {
        const bal = stock.reduce((sum, t) => {
          if (t.itemId === i.id) return sum + Number(t.quantityIn || 0) - Number(t.quantityOut || 0);
          return sum;
        }, 0);
        return {
          id: i.id,
          itemName: i.itemName,
          itemCode: i.itemCode,
          minimumStockLevel: Number(i.minimumStockLevel),
          categoryName: i.category?.name || '',
          unitName: i.unit?.name || '',
          currentBalance: bal,
          deficit: Number(i.minimumStockLevel) - bal,
        };
      })
      .filter((i) => i.currentBalance < i.minimumStockLevel)
      .sort((a, b) => a.deficit - b.deficit)
      .slice(0, 6);

    const serializedRecent = recentTransactions.map((t) => ({
      id: t.id,
      transactionType: t.transactionType,
      quantityIn: Number(t.quantityIn || 0),
      quantityOut: Number(t.quantityOut || 0),
      rate: Number(t.rate || 0),
      balanceQty: Number(t.balanceQty || 0),
      transactionDate: t.transactionDate instanceof Date ? t.transactionDate.toISOString() : String(t.transactionDate),
      itemName: t.item?.itemName || '',
      departmentName: t.department?.name || '',
    }));

    return {
      totalItems, lowStockItems: lowStockItems.length, lowStockItemsDetail: lowStockItems,
      totalReceiptQty, totalIssueQty, stockValue, availableQty,
      pendingDrafts, recentTransactions: serializedRecent, monthlyMovement, stockTrend,
      topConsumed, deptWise, categoryData, receiptVsIssue,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  });
}
