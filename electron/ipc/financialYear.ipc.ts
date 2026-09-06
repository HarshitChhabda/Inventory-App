import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { FinancialYearService } from '../../src/main/services/financialYear.service';
import { requireAuth, serialize } from './helpers';
import { hasPermission, PERMISSION_KEYS } from '../../src/main/services/auth.service';

function requireFYPermission() {
  const session = requireAuth();
  if (!hasPermission(session, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
    throw new Error('Permission denied: manage_financial_year');
  }
  return session;
}

export function registerFinancialYearIPC(prisma: PrismaClient) {
  const svc = new FinancialYearService(prisma);

  ipcMain.handle('fy:create', async (_e, data: { companyId: number; label: string; startDate: string; endDate: string }) => {
    requireFYPermission();
    return serialize(await svc.create({ ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) }));
  });

  ipcMain.handle('fy:findAll', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.findAll(companyId));
  });

  ipcMain.handle('fy:findById', async (_e, id: number) => {
    requireAuth();
    return serialize(await svc.findById(id));
  });

  ipcMain.handle('fy:update', async (_e, id: number, data: any) => {
    requireFYPermission();
    return serialize(await svc.update(id, data));
  });

  ipcMain.handle('fy:validateClosing', async (_e, fyId: number) => {
    requireAuth();
    return serialize(await svc.validateClosing(fyId));
  });

  ipcMain.handle('fy:getClosingSummary', async (_e, fyId: number) => {
    requireAuth();
    return serialize(await svc.getClosingSummary(fyId));
  });

  ipcMain.handle('fy:close', async (_e, id: number) => {
    const session = requireFYPermission();
    return serialize(await svc.closeFinancialYear(id, session.id));
  });

  ipcMain.handle('fy:reopen', async (_e, id: number) => {
    const session = requireFYPermission();
    return serialize(await svc.reopenFinancialYear(id, session.id));
  });

  ipcMain.handle('fy:importOpeningBalance', async (_e, data: any) => {
    requireFYPermission();
    return serialize(await svc.importOpeningBalance(data));
  });

  ipcMain.handle('fy:carryForward', async (_e, companyId: number, fromFyId: number) => {
    const session = requireFYPermission();
    return serialize(await svc.carryForward(companyId, fromFyId, session.id));
  });

  ipcMain.handle('fy:getVoucherSequences', async (_e, fyId: number) => {
    requireAuth();
    return serialize(await svc.getVoucherSequences(fyId));
  });

  ipcMain.handle('fy:archive', async (_e, id: number) => {
    const session = requireFYPermission();
    return serialize(await svc.archive(id, session.id));
  });

  ipcMain.handle('fy:deleteDuplicate', async (_e, id: number) => {
    try {
      const session = requireFYPermission();
      return serialize(await svc.deleteDuplicate(id, session.id));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete duplicate financial year');
    }
  });

  ipcMain.handle('fy:getDeletionDependencyInfo', async (_e, id: number) => {
    requireAuth();
    return serialize(await svc.getDeletionDependencyInfo(id));
  });

  ipcMain.handle('fy:permanentDelete', async (_e, id: number, confirmLabel: string) => {
    const session = requireFYPermission();
    const fy = await prisma.financialYear.findUnique({ where: { id } });
    if (!fy) throw new Error('Financial year not found');
    if (confirmLabel !== fy.label) {
      throw new Error(`Confirmation failed: expected "${fy.label}" but got "${confirmLabel}"`);
    }
    return serialize(await svc.permanentDelete(id, session.id));
  });

  ipcMain.handle('fy:getFullDeletionDependencyInfo', async (_e, id: number) => {
    requireAuth();
    return serialize(await svc.getFullDeletionDependencyInfo(id));
  });

  ipcMain.handle('fy:current', async (_e, companyId: number) => {
    requireAuth();
    const fy = await prisma.financialYear.findFirst({
      where: { companyId, isClosed: false },
      orderBy: { startDate: 'desc' },
    });
    return serialize(fy);
  });
}
