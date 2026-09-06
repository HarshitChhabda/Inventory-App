import { ipcMain } from 'electron';
import { MaterialInstallationService } from '../../src/main/services/materialInstallation.service';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { requireAuth, auditLog, serialize } from './helpers';

export function registerInstallationIPC() {
  ipcMain.handle('installation:create', async (_e, data: any) => {
    const user = requireAuth();
    data.installedBy = user.username || user.name || 'System';
    const result = await MaterialInstallationService.create(data);
    await auditLog('CREATE', 'MaterialInstallation', result.id, `Created installation ${result.installationNumber}`);
    return serialize(result);
  });

  ipcMain.handle('installation:cancel', async (_e, id: number, reason: string) => {
    const user = requireAuth();
    const companyId = 1;
    const financialYearId = 1;
    const result = await MaterialInstallationService.cancel(id, companyId, financialYearId, reason, user.username || user.name || 'System');
    await auditLog('UPDATE', 'MaterialInstallation', id, `Cancelled installation: ${reason}`);
    return serialize(result);
  });

  ipcMain.handle('installation:findById', async (_e, id: number) => {
    requireAuth();
    return serialize(await MaterialInstallationService.findById(id));
  });

  ipcMain.handle('installation:findAll', async (_e, companyId: number, financialYearId: number, options?: any) => {
    requireAuth();
    return serialize(await MaterialInstallationService.findAll(companyId, financialYearId, options));
  });

  ipcMain.handle('installation:getForDemand', async (_e, serviceRequestId: number) => {
    requireAuth();
    return serialize(await MaterialInstallationService.getInstallationForDemand(serviceRequestId));
  });

  ipcMain.handle('installation:getForLocation', async (_e, storeId: number, locationId?: number) => {
    requireAuth();
    return serialize(await MaterialInstallationService.getInstallationForLocation(storeId, locationId));
  });

  ipcMain.handle('preference:get', async (_e, userId: number, key: string) => {
    requireAuth();
    const prisma = getPrismaClient();
    const pref = await prisma.userPreference.findUnique({ where: { userId_key: { userId, key } } });
    return pref ? pref.value : null;
  });

  ipcMain.handle('preference:set', async (_e, userId: number, key: string, value: string) => {
    requireAuth();
    const prisma = getPrismaClient();
    await prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value },
    });
    return true;
  });

  ipcMain.handle('preference:getAll', async (_e, userId: number) => {
    requireAuth();
    const prisma = getPrismaClient();
    const prefs = await prisma.userPreference.findMany({ where: { userId } });
    const result: Record<string, string> = {};
    prefs.forEach((p: any) => { result[p.key] = p.value; });
    return result;
  });
}
