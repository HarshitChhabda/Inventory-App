import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../../src/main/services/audit.service';
import { requireAuth, serialize } from './helpers';
import { setActiveCompanyId } from './helpers';

export function registerAuditIPC(prisma: PrismaClient) {
  const svc = new AuditService(prisma);

  ipcMain.handle('audit:setCompanyId', async (_e, companyId: number | null) => {
    requireAuth();
    setActiveCompanyId(companyId);
    return { success: true };
  });

  ipcMain.handle('audit:findAll', async (_e, filter: any) => {
    requireAuth();
    if (filter.fromDate) filter.fromDate = new Date(filter.fromDate);
    if (filter.toDate) filter.toDate = new Date(filter.toDate);
    return serialize(await svc.findAll(filter));
  });

  ipcMain.handle('audit:getStats', async (_e, companyId: number, fromDate?: string, toDate?: string) => {
    requireAuth();
    return serialize(await svc.getStats(companyId, fromDate ? new Date(fromDate) : undefined, toDate ? new Date(toDate) : undefined));
  });

  ipcMain.handle('audit:getActionTypes', async () => {
    requireAuth();
    return serialize(await svc.getActionTypes());
  });
}
