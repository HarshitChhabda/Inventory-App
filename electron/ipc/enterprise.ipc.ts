import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { SystemConfigurationService } from '../../src/main/services/systemConfiguration.service';
import { StoreMasterService } from '../../src/main/services/storeMaster.service';
import { LocationMasterService } from '../../src/main/services/locationMaster.service';
import { ItemMasterService } from '../../src/main/services/itemMaster.service';
import { TransferMatrixService } from '../../src/main/services/transferMatrix.service';
import { TransactionEngine } from '../../src/main/services/transactionEngine.service';
import { StockEngine } from '../../src/main/services/stockEngine.service';
import { VoucherEngine } from '../../src/main/services/voucherEngine.service';

const ser = (r: any) => JSON.parse(JSON.stringify(r, (_k, v) => {
  if (typeof v === 'bigint') return v.toString();
  if (v && typeof v === 'object' && 's' in v && 'e' in v && 'd' in v && typeof v.s === 'number' && typeof v.e === 'number') return Number(v);
  return v;
}));
import { MovementRegistry } from '../../src/main/services/movementRegistry.service';
import { DataMigrationService } from '../../src/main/services/dataMigration.service';
import { requireAuth, auditLog, serialize } from './helpers';
import { convertDates } from '../../src/shared/dateUtils';

export function registerEnterpriseIpc(prisma: PrismaClient) {
  // ============================================================
  // SYSTEM CONFIGURATION
  // ============================================================
  const configService = new SystemConfigurationService(prisma);

  ipcMain.handle('config:get', async (_event, companyId: number, key: string) => {
    requireAuth();
    return configService.get(companyId, key);
  });

  ipcMain.handle('config:getBool', async (_event, companyId: number, key: string) => {
    requireAuth();
    return configService.getBool(companyId, key);
  });

  ipcMain.handle('config:getNumber', async (_event, companyId: number, key: string) => {
    requireAuth();
    return configService.getNumber(companyId, key);
  });

  ipcMain.handle('config:set', async (_event, companyId: number, key: string, value: string, category?: string, description?: string) => {
    requireAuth();
    await configService.set(companyId, key, value, category, description);
    await auditLog('UPDATE', 'SystemConfiguration', undefined, `Updated config: ${key}`);
  });

  ipcMain.handle('config:getAll', async (_event, companyId: number, category?: string) => {
    requireAuth();
    return configService.getAll(companyId, category);
  });

  ipcMain.handle('config:delete', async (_event, companyId: number, key: string) => {
    requireAuth();
    await configService.delete(companyId, key);
    await auditLog('DELETE', 'SystemConfiguration', undefined, `Deleted config: ${key}`);
  });

  ipcMain.handle('config:initializeDefaults', async (_event, companyId: number) => {
    requireAuth();
    await configService.initializeDefaults(companyId);
    await auditLog('CREATE', 'SystemConfiguration', undefined, `Initialized default system configurations`);
  });

  // ============================================================
  // STORE MASTER
  // ============================================================
  const storeService = new StoreMasterService(prisma);

  ipcMain.handle('store:create', async (_event, data: any) => {
    requireAuth();
    const result = await storeService.create(data);
    await auditLog('CREATE', 'StoreMaster', result.id, `Created store: ${result.name || result.id}`);
    return result;
  });

  ipcMain.handle('store:update', async (_event, id: number, data: any) => {
    requireAuth();
    const oldStore = await prisma.store.findUnique({ where: { id } });
    const result = await storeService.update(id, data);

    // Sync auto-created Location name if store name changed
    if (data.name && oldStore && oldStore.name !== data.name) {
      // Determine the expected auto-created Location type
      const autoLocationType = oldStore.storeType === 'MAIN_STORE' ? 'Store'
        : oldStore.storeType === 'DEPARTMENT_STORE' ? 'Department'
        : oldStore.storeType === 'DHARMSHALA_STORE' ? 'Dharamshala'
        : null;

      if (autoLocationType) {
        // Find the auto-created Location using the most precise match possible:
        // 1. If store has a departmentId, match by storeId + name + type (heuristic)
        // 2. Use findFirst to only rename ONE Location, not all matches
        const autoLoc = await prisma.location.findFirst({
          where: {
            storeId: id,
            name: oldStore.name,
            locationType: autoLocationType,
          },
          orderBy: { id: 'asc' },
        });

        if (autoLoc) {
          await prisma.location.update({
            where: { id: autoLoc.id },
            data: { name: data.name },
          });
        }
      }
    }

    await auditLog('UPDATE', 'StoreMaster', result.id, `Updated store: ${result.name || result.id}`);
    return result;
  });

  ipcMain.handle('store:getById', async (_event, id: number) => {
    requireAuth();
    return storeService.getById(id);
  });

  ipcMain.handle('store:list', async (_event, companyId: number, storeType?: string) => {
    requireAuth();
    const result = await storeService.list(companyId, storeType);
    return ser(result);
  });

  ipcMain.handle('store:delete', async (_event, id: number) => {
    requireAuth();
    const result = await storeService.delete(id);
    await auditLog('DELETE', 'StoreMaster', result.id, `Deleted store: ${result.name || result.id}`);
    return result;
  });

  ipcMain.handle('store:toggle', async (_event, id: number) => {
    requireAuth();
    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) throw new Error('Store not found');
    const newActiveState = !store.isActive;
    const result = await prisma.store.update({ where: { id }, data: { isActive: newActiveState } });

    // Propagate isActive to child locations
    await prisma.location.updateMany({ where: { storeId: id }, data: { isActive: newActiveState } });

    await auditLog('UPDATE', 'StoreMaster', id, `${store.isActive ? 'Disabled' : 'Enabled'} store: ${store.name}`, result);
    return result;
  });

  ipcMain.handle('store:bulkCreate', async (_event, stores: any[]) => {
    requireAuth();
    let created = 0, updated = 0, skipped = 0;
    for (const store of stores) {
      if (!store.name) { skipped++; continue; }
      try {
        const existing = await prisma.store.findFirst({ where: { name: store.name, companyId: store.companyId } });
        if (existing) {
          await prisma.store.update({ where: { id: existing.id }, data: { ...store, id: undefined } });
          updated++;
        } else {
          await prisma.store.create({ data: store });
          created++;
        }
      } catch { skipped++; }
    }
    await auditLog('CREATE', 'StoreMaster', undefined, `Bulk: ${created} created, ${updated} updated, ${skipped} skipped`);
    return { created, updated, skipped };
  });

  ipcMain.handle('store:getMainStores', async (_event, companyId: number) => {
    requireAuth();
    return storeService.getMainStores(companyId);
  });

  ipcMain.handle('store:getByType', async (_event, companyId: number, storeType: string) => {
    requireAuth();
    return storeService.getStoresByType(companyId, storeType);
  });

  ipcMain.handle('store:getHierarchy', async (_event, companyId: number) => {
    requireAuth();
    return storeService.getStoreHierarchy(companyId);
  });

  // ============================================================
  // LOCATION MASTER
  // ============================================================
  const locationService = new LocationMasterService(prisma);

  ipcMain.handle('location:create', async (_event, data: any) => {
    requireAuth();
    const result = await locationService.create(data);
    await auditLog('CREATE', 'LocationMaster', result.id, `Created location: ${result.name || result.id}`);
    return result;
  });

  ipcMain.handle('location:update', async (_event, id: number, data: any) => {
    requireAuth();
    const result = await locationService.update(id, data);
    await auditLog('UPDATE', 'LocationMaster', result.id, `Updated location: ${result.name || result.id}`);
    return result;
  });

  ipcMain.handle('location:getById', async (_event, id: number) => {
    requireAuth();
    return locationService.getById(id);
  });

  ipcMain.handle('location:list', async (_event, companyId: number, locationType?: string, storeId?: number) => {
    requireAuth();
    return locationService.list(companyId, locationType, storeId);
  });

  ipcMain.handle('location:delete', async (_event, id: number) => {
    requireAuth();
    const result = await locationService.delete(id);
    await auditLog('DELETE', 'LocationMaster', result.id, `Deleted location: ${result.name || result.id}`);
    return result;
  });

  ipcMain.handle('location:getHierarchy', async (_event, companyId: number) => {
    requireAuth();
    return locationService.getHierarchy(companyId);
  });

  // ============================================================
  // ITEM MASTER
  // ============================================================
  const itemService = new ItemMasterService(prisma);

  ipcMain.handle('item:create', async (_event, data: any) => {
    requireAuth();
    const result = await itemService.create(data);
    await auditLog('CREATE', 'ItemMaster', result.id, `Created item: ${result.itemName || result.id}`);
    return result;
  });

  ipcMain.handle('item:update', async (_event, id: number, data: any) => {
    requireAuth();
    const result = await itemService.update(id, data);
    await auditLog('UPDATE', 'ItemMaster', result.id, `Updated item: ${result.itemName || result.id}`);
    return result;
  });

  ipcMain.handle('item:getById', async (_event, id: number) => {
    requireAuth();
    return itemService.getById(id);
  });

  ipcMain.handle('item:list', async (_event, companyId: number, categoryId?: number, itemType?: string, isSerialized?: boolean) => {
    requireAuth();
    const result = await itemService.list(companyId, categoryId, itemType, isSerialized);
    return ser(result);
  });

  ipcMain.handle('item:delete', async (_event, id: number) => {
    requireAuth();
    const result = await itemService.delete(id);
    await auditLog('DELETE', 'ItemMaster', result.id, `Deleted item: ${result.itemName || result.id}`);
    return result;
  });

  ipcMain.handle('item:createSerialized', async (_event, data: any) => {
    requireAuth();
    const result = await itemService.createSerializedItem(data);
    await auditLog('CREATE', 'ItemMaster', result.id, `Created serialized item: ${result.serialNumber || result.id}`);
    return result;
  });

  ipcMain.handle('item:getSerialized', async (_event, itemId: number, storeId?: number) => {
    requireAuth();
    return itemService.getSerializedItems(itemId, storeId);
  });

  ipcMain.handle('item:updateSerializedStatus', async (_event, id: number, status: string, locationId?: number) => {
    requireAuth();
    const result = await itemService.updateSerializedItemStatus(id, status, locationId);
    await auditLog('UPDATE', 'ItemMaster', result.id, `Updated serialized item status: ${result.serialNumber || result.id}`);
    return result;
  });

  // ============================================================
  // TRANSFER MATRIX
  // ============================================================
  const matrixService = new TransferMatrixService(prisma);

  ipcMain.handle('transferMatrix:initializeDefaults', async (_event, companyId: number) => {
    requireAuth();
    await matrixService.initializeDefaults(companyId);
    await auditLog('CREATE', 'TransferMatrix', undefined, `Initialized default transfer matrix`);
  });

  ipcMain.handle('transferMatrix:isAllowed', async (_event, companyId: number, fromStoreType: string, toStoreType: string) => {
    requireAuth();
    return matrixService.isTransferAllowed(companyId, fromStoreType, toStoreType);
  });

  ipcMain.handle('transferMatrix:updateRule', async (_event, companyId: number, fromStoreType: string, toStoreType: string, isAllowed: boolean, requiresApproval: boolean) => {
    requireAuth();
    const result = await matrixService.updateRule(companyId, fromStoreType, toStoreType, isAllowed, requiresApproval);
    await auditLog('UPDATE', 'TransferMatrix', result.id, `Updated transfer rule: ${fromStoreType} → ${toStoreType}`);
    return result;
  });

  ipcMain.handle('transferMatrix:getRules', async (_event, companyId: number) => {
    requireAuth();
    return matrixService.getRules(companyId);
  });

  ipcMain.handle('transferMatrix:validate', async (_event, companyId: number, fromStoreId: number, toStoreId: number) => {
    requireAuth();
    return matrixService.validateTransfer(companyId, fromStoreId, toStoreId);
  });

  // ============================================================
  // UNIVERSAL MOVEMENT ENGINE
  // ============================================================
  const txEngine = new TransactionEngine(prisma);

  ipcMain.handle('tx:create', async (_event, data: any) => {
    requireAuth();
    const converted = convertDates(data);
    if (converted.transactionDate && !(converted.transactionDate instanceof Date)) {
      const d = new Date(converted.transactionDate);
      if (!isNaN(d.getTime())) converted.transactionDate = d;
    }
    return txEngine.createMovement(converted);
  });

  ipcMain.handle('tx:approve', async (_event, companyId: number, transactionId: number, approvedBy: string) => {
    requireAuth();
    return txEngine.approveMovement(companyId, transactionId, approvedBy);
  });

  ipcMain.handle('tx:reject', async (_event, companyId: number, transactionId: number, rejectedBy: string, reason: string) => {
    requireAuth();
    return txEngine.rejectMovement(companyId, transactionId, rejectedBy, reason);
  });

  ipcMain.handle('tx:cancel', async (_event, companyId: number, transactionId: number, cancelledBy: string, reason: string) => {
    requireAuth();
    return txEngine.cancelMovement(companyId, transactionId, cancelledBy, reason);
  });

  // ============================================================
  // MOVEMENT REGISTRY
  // ============================================================
  const movementRegistry = new MovementRegistry(prisma);

  ipcMain.handle('movement:getAll', async () => {
    requireAuth();
    return movementRegistry.getAll();
  });

  ipcMain.handle('movement:getByCode', async (_event, code: string) => {
    requireAuth();
    return movementRegistry.getByCode(code);
  });

  ipcMain.handle('movement:getByCategory', async (_event, category: string) => {
    requireAuth();
    return movementRegistry.getByCategory(category);
  });

  ipcMain.handle('movement:getCategories', async () => {
    requireAuth();
    return movementRegistry.getCategories();
  });

  // ============================================================
  // STOCK ENGINE
  // ============================================================
  const stockEngine = new StockEngine(prisma);

  ipcMain.handle('stock:getBalance', async (_event, companyId: number, financialYearId: number, itemId: number, storeId: number) => {
    requireAuth();
    return stockEngine.getStockBalance(companyId, financialYearId, itemId, storeId);
  });

  ipcMain.handle('stock:getBreakdown', async (_event, companyId: number, financialYearId: number, itemId: number, storeId: number) => {
    requireAuth();
    return stockEngine.getStockBreakdown(companyId, financialYearId, itemId, storeId);
  });

  ipcMain.handle('stock:getStoreStock', async (_event, companyId: number, financialYearId: number, storeId: number) => {
    requireAuth();
    const result = await stockEngine.getStoreStock(companyId, financialYearId, storeId);
    return ser(result);
  });

  ipcMain.handle('stock:getItemAcrossStores', async (_event, companyId: number, financialYearId: number, itemId: number) => {
    requireAuth();
    const result = await stockEngine.getItemStockAcrossStores(companyId, financialYearId, itemId);
    return ser(result);
  });

  ipcMain.handle('stock:getLowStockAlerts', async (_event, companyId: number, financialYearId: number) => {
    requireAuth();
    return stockEngine.getLowStockAlerts(companyId, financialYearId);
  });

  ipcMain.handle('stock:getLocationItems', async (_event, companyId: number, financialYearId: number, roomId: number) => {
    requireAuth();
    const result = await stockEngine.getLocationItems(companyId, financialYearId, roomId);
    return ser(result);
  });

  ipcMain.handle('stock:getAllLocationItems', async (_event, companyId: number, financialYearId: number) => {
    requireAuth();
    const result = await stockEngine.getAllLocationItems(companyId, financialYearId);
    return ser(result);
  });

  ipcMain.handle('stock:validate', async (_event, companyId: number, financialYearId: number, itemId: number, storeId: number, quantity: number) => {
    requireAuth();
    return stockEngine.validateStock(companyId, financialYearId, itemId, storeId, quantity);
  });

  // ============================================================
  // VOUCHER ENGINE
  // ============================================================
  const voucherEngine = new VoucherEngine(prisma);

  ipcMain.handle('voucher:preview', async (_event, companyId: number, financialYearId: number, voucherType: string) => {
    requireAuth();
    return voucherEngine.previewNextVoucherNo(companyId, financialYearId, voucherType as any);
  });

  ipcMain.handle('voucher:currentSequence', async (_event, companyId: number, financialYearId: number, voucherType: string) => {
    requireAuth();
    return voucherEngine.getCurrentSequence(companyId, financialYearId, voucherType as any);
  });

  ipcMain.handle('voucher:isValidType', async (_event, type: string) => {
    requireAuth();
    return voucherEngine.isValidType(type);
  });

  ipcMain.handle('voucher:getPrefixes', async () => {
    requireAuth();
    return voucherEngine.getPrefixes();
  });

  // ============================================================
  // DATA MIGRATION
  // ============================================================
  const migrationService = new DataMigrationService(prisma);

  ipcMain.handle('migration:migrate', async (_event, companyId: number) => {
    requireAuth();
    const result = await migrationService.migrate(companyId);
    await auditLog('UPDATE', 'DataMigration', undefined, `Ran data migration for company ${companyId}`);
    return result;
  });

  ipcMain.handle('migration:isNeeded', async (_event, companyId: number) => {
    requireAuth();
    return migrationService.isMigrationNeeded(companyId);
  });
}
