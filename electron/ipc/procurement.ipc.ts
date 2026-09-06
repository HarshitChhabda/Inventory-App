import { ipcMain } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { VendorService } from '../../src/main/services/vendor.service';
import { PurchaseOrderService } from '../../src/main/services/purchaseOrder.service';
import { GoodsReceiptService } from '../../src/main/services/goodsReceipt.service';
import { serialize, requireAuth, auditLog } from './helpers';

export function registerProcurementIpc() {
  const prisma = getPrismaClient();
  const vendorService = new VendorService(prisma);
  const poService = new PurchaseOrderService(prisma);
  const grnService = new GoodsReceiptService(prisma);

  // ─── VENDOR CRUD ───────────────────────────────

  ipcMain.handle('vendor:create', async (_event, data: any) => {
    requireAuth();
    const result = await vendorService.createVendor(data);
    await auditLog('CREATE', 'Vendor', result.id, `Created vendor: ${result.name || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('vendor:get', async (_event, id: number) => {
    return serialize(await vendorService.getVendor(id));
  });

  ipcMain.handle('vendor:getByCode', async (_event, code: string) => {
    return serialize(await vendorService.getVendorByCode(code));
  });

  ipcMain.handle('vendor:update', async (_event, id: number, data: any) => {
    requireAuth();
    const result = await vendorService.updateVendor(id, data);
    await auditLog('UPDATE', 'Vendor', result.id, `Updated vendor: ${result.name || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('vendor:delete', async (_event, id: number) => {
    requireAuth();
    await vendorService.deleteVendor(id);
    await auditLog('DELETE', 'Vendor', id, `Deleted vendor: ${id}`);
    return { success: true };
  });

  ipcMain.handle('vendor:search', async (_event, filters: any) => {
    return serialize(await vendorService.searchVendors(filters));
  });

  ipcMain.handle('vendor:toggle', async (_event, id: number, isActive: boolean) => {
    requireAuth();
    const result = await vendorService.toggleVendor(id, isActive);
    await auditLog('UPDATE', 'Vendor', result.id, `Toggled vendor: ${result.name || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('vendor:updateRating', async (_event, id: number, rating: number) => {
    requireAuth();
    const result = await vendorService.updateRating(id, rating);
    await auditLog('UPDATE', 'Vendor', result.id, `Updated vendor rating: ${result.name || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('vendor:performance', async (_event, vendorId: number) => {
    return serialize(await vendorService.getVendorPerformance(vendorId));
  });

  ipcMain.handle('vendor:dashboard', async (_event, companyId: number) => {
    return serialize(await vendorService.getVendorDashboard(companyId));
  });

  // ─── VENDOR DOCUMENTS ─────────────────────────

  ipcMain.handle('vendor:addDocument', async (_event, vendorId: number, docType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, description?: string, uploadedBy?: string) => {
    requireAuth();
    const doc = await prisma.vendorDocument.create({
      data: { vendorId, documentType: docType, fileName, filePath, fileSize, mimeType, description, uploadedBy },
    });
    await auditLog('CREATE', 'VendorDocument', doc.id, `Added vendor document: ${fileName}`);
    return serialize(doc);
  });

  ipcMain.handle('vendor:getDocuments', async (_event, vendorId: number) => {
    return serialize(await prisma.vendorDocument.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } }));
  });

  ipcMain.handle('vendor:deleteDocument', async (_event, docId: number) => {
    requireAuth();
    await prisma.vendorDocument.delete({ where: { id: docId } });
    await auditLog('DELETE', 'VendorDocument', docId, `Deleted vendor document: ${docId}`);
    return { success: true };
  });

  // ─── ITEM-VENDOR MAPPING ───────────────────────

  ipcMain.handle('vendor:addItemMapping', async (_event, data: any) => {
    requireAuth();
    const mapping = await prisma.itemVendorMapping.create({ data });
    await auditLog('CREATE', 'ItemVendorMapping', mapping.id, `Created item vendor mapping: ${mapping.id}`);
    return serialize(mapping);
  });

  ipcMain.handle('vendor:getItemMappings', async (_event, itemId: number) => {
    return serialize(await prisma.itemVendorMapping.findMany({
      where: { itemId },
      include: { vendor: true },
      orderBy: { isDefault: 'desc' },
    }));
  });

  ipcMain.handle('vendor:deleteItemMapping', async (_event, id: number) => {
    requireAuth();
    await prisma.itemVendorMapping.delete({ where: { id } });
    await auditLog('DELETE', 'ItemVendorMapping', id, `Deleted item vendor mapping: ${id}`);
    return { success: true };
  });

  // ─── PURCHASE ORDER ────────────────────────────

  ipcMain.handle('po:create', async (_event, data: any) => {
    requireAuth();
    const result = await poService.createPO(data);
    await auditLog('CREATE', 'PurchaseOrder', result.id, `Created purchase order: ${result.poNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('po:get', async (_event, id: number) => {
    return serialize(await poService.getPO(id));
  });

  ipcMain.handle('po:search', async (_event, filters: any) => {
    return serialize(await poService.searchPOs(filters));
  });

  ipcMain.handle('po:update', async (_event, id: number, data: any) => {
    requireAuth();
    const result = await poService.updatePO(id, data);
    await auditLog('UPDATE', 'PurchaseOrder', result.id, `Updated purchase order: ${result.poNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('po:approve', async (_event, id: number, approvedBy: string) => {
    requireAuth();
    const result = await poService.approvePO(id, approvedBy);
    await auditLog('APPROVE', 'PurchaseOrder', result.id, `Approved purchase order: ${result.poNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('po:order', async (_event, id: number, orderedBy: string) => {
    requireAuth();
    const result = await poService.orderPO(id, orderedBy);
    await auditLog('UPDATE', 'PurchaseOrder', result.id, `Ordered purchase order: ${result.poNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('po:cancel', async (_event, id: number) => {
    requireAuth();
    const result = await poService.cancelPO(id);
    await auditLog('UPDATE', 'PurchaseOrder', id, `Cancelled purchase order: ${result.poNumber || id}`);
    return serialize(result);
  });

  ipcMain.handle('po:close', async (_event, id: number) => {
    requireAuth();
    const result = await poService.closePO(id);
    await auditLog('UPDATE', 'PurchaseOrder', id, `Closed purchase order: ${result.poNumber || id}`);
    return serialize(result);
  });

  ipcMain.handle('po:dashboard', async (_event, companyId: number) => {
    return serialize(await poService.getDashboard(companyId));
  });

  // ─── GOODS RECEIPT ─────────────────────────────

  ipcMain.handle('grn:create', async (_event, data: any) => {
    requireAuth();
    const result = await grnService.createGRN(data);
    await auditLog('CREATE', 'GoodsReceipt', result.id, `Created goods receipt: ${result.grnNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('grn:get', async (_event, id: number) => {
    return serialize(await grnService.getGRN(id));
  });

  ipcMain.handle('grn:search', async (_event, filters: any) => {
    return serialize(await grnService.searchGRNs(filters));
  });

  ipcMain.handle('grn:recordQC', async (_event, data: any) => {
    requireAuth();
    const result = await grnService.recordQC(data);
    await auditLog('UPDATE', 'GoodsReceipt', result.id, `Recorded QC for goods receipt: ${result.grnNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('grn:postToInventory', async (_event, grnId: number, postedById: string) => {
    requireAuth();
    const result = await grnService.postToInventory(grnId, postedById);
    await auditLog('UPDATE', 'GoodsReceipt', grnId, `Posted goods receipt to inventory: ${grnId}`);
    return serialize(result);
  });

  ipcMain.handle('grn:dashboard', async (_event, companyId: number) => {
    return serialize(await grnService.getDashboard(companyId));
  });

  // ─── PURCHASE HISTORY ──────────────────────────

  ipcMain.handle('procurement:purchaseHistory', async (_event, companyId: number, itemId?: number, vendorId?: number) => {
    const where: any = { companyId };
    if (itemId) where.itemId = itemId;
    if (vendorId) where.vendorId = vendorId;
    return serialize(await prisma.purchaseHistory.findMany({
      where,
      include: { item: true, vendor: true },
      orderBy: { purchaseDate: 'desc' },
      take: 100,
    }));
  });

  ipcMain.handle('procurement:priceHistory', async (_event, companyId: number, itemId?: number) => {
    const where: any = { companyId };
    if (itemId) where.itemId = itemId;
    return serialize(await prisma.priceHistory.findMany({
      where,
      include: { item: true, vendor: true },
      orderBy: { effectiveDate: 'desc' },
      take: 100,
    }));
  });

}
