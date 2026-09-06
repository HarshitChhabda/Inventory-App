import { ipcMain } from 'electron';
import { MaterialConsumptionService } from '../../src/main/services/materialConsumption.service';
import { requireAuth, auditLog, serialize } from './helpers';
import { getPrismaClient } from '../../src/main/database/prisma.client';

export function registerConsumptionIPC() {
  const prisma = getPrismaClient();

  ipcMain.handle('consumption:create', async (_e, data: any) => {
    const user = requireAuth();
    data.issuedBy = user.username || user.name || 'System';
    const result = await MaterialConsumptionService.create(data);
    await auditLog('CREATE', 'MaterialConsumption', result.id, `Created consumption ${result.consumptionNumber}`);
    return serialize(result);
  });

  ipcMain.handle('consumption:cancel', async (_e, id: number, reason: string) => {
    const user = requireAuth();
    const result = await MaterialConsumptionService.cancel(id, 1, 1, reason, user.username || user.name || 'System');
    await auditLog('UPDATE', 'MaterialConsumption', id, `Cancelled consumption: ${reason}`);
    return serialize(result);
  });

  ipcMain.handle('consumption:findById', async (_e, id: number) => {
    requireAuth();
    return serialize(await MaterialConsumptionService.findById(id));
  });

  ipcMain.handle('consumption:findAll', async (_e, companyId: number, financialYearId: number, options?: any) => {
    requireAuth();
    return serialize(await MaterialConsumptionService.findAll(companyId, financialYearId, options));
  });

  ipcMain.handle('consumption:getForLocation', async (_e, storeId: number, locationId?: number) => {
    requireAuth();
    return serialize(await MaterialConsumptionService.getConsumptionForLocation(storeId, locationId));
  });

  ipcMain.handle('consumption:getForDemand', async (_e, serviceRequestId: number) => {
    requireAuth();
    return serialize(await MaterialConsumptionService.getConsumptionForDemand(serviceRequestId));
  });

  ipcMain.handle('consumption:getLocationStock', async (_e, storeId: number, locationId?: number) => {
    requireAuth();
    const where: any = { storeId };
    if (locationId) where.locationId = locationId;

    const grouped = await prisma.ledgerEntry.groupBy({
      by: ['itemId'],
      where,
      _sum: { quantityIn: true, quantityOut: true },
    });

    const stock: Record<number, { itemId: number; itemName: string; itemCode: string; received: number; consumed: number; balance: number; locationName: string }> = {};

    for (const g of grouped) {
      const received = Number(g._sum.quantityIn || 0);
      const consumed = Number(g._sum.quantityOut || 0);
      stock[g.itemId] = {
        itemId: g.itemId,
        itemName: '',
        itemCode: '',
        received,
        consumed,
        balance: received - consumed,
        locationName: '',
      };
    }

    const items = await prisma.item.findMany({
      where: { id: { in: Object.keys(stock).map(Number) } },
      include: { unit: true },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const result = Object.values(stock).map((s) => {
      const item = itemMap.get(s.itemId);
      return {
        ...s,
        itemName: item?.itemName || '',
        itemCode: item?.itemCode || '',
        unitName: item?.unit?.name || '',
        balance: s.balance,
      };
    }).filter((s) => s.balance > 0 || s.received > 0);

    return serialize(result);
  });
}
