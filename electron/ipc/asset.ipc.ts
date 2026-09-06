import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { AssetService } from '../../src/main/services/asset.service';
import { getSession, requirePermission, PERMISSION_KEYS } from '../../src/main/services/auth.service';
import { serialize, requireAuth, auditLog } from './helpers';

export function registerAssetIpc() {
  const prisma = getPrismaClient();
  const assetService = new AssetService(prisma);

  // ─── CRUD ──────────────────────────────────────

  ipcMain.handle('asset:create', async (_event, data: any) => {
    requireAuth();
    const result = await assetService.createAsset(data);
    await auditLog('CREATE', 'Asset', result.id, `Created asset: ${result.assetCode}`);
    return serialize(result);
  });

  ipcMain.handle('asset:get', async (_event, id: number) => {
    requireAuth();
    return serialize(await assetService.getAsset(id));
  });

  ipcMain.handle('asset:getByCode', async (_event, assetCode: string) => {
    requireAuth();
    return serialize(await assetService.getAssetByCode(assetCode));
  });

  ipcMain.handle('asset:update', async (_event, id: number, data: any) => {
    requireAuth();
    const result = await assetService.updateAsset(id, data);
    await auditLog('UPDATE', 'Asset', id, `Updated asset: ${result.assetCode}`);
    return serialize(result);
  });

  ipcMain.handle('asset:delete', async (_event, id: number) => {
    requireAuth();
    await requirePermission(getSession()!.id, PERMISSION_KEYS.DELETE_CHALLAN);
    await assetService.deleteAsset(id);
    await auditLog('DELETE', 'Asset', id, `Deleted asset: ${id}`);
    return { success: true };
  });

  // ─── SEARCH ────────────────────────────────────

  ipcMain.handle('asset:search', async (_event, filters: any) => {
    requireAuth();
    return serialize(await assetService.searchAssets(filters));
  });

  // ─── LIFECYCLE ─────────────────────────────────

  ipcMain.handle('asset:install', async (_event, assetId: number, storeId: number, locationId?: number, roomId?: number, departmentId?: number, installedBy?: string, remarks?: string) => {
    requireAuth();
    const result = await assetService.installAsset(assetId, storeId, locationId, roomId, departmentId, installedBy, remarks);
    await auditLog('UPDATE', 'Asset', assetId, `Installed asset`);
    return serialize(result);
  });

  ipcMain.handle('asset:uninstall', async (_event, assetId: number, uninstalledBy?: string, remarks?: string) => {
    requireAuth();
    const result = await assetService.uninstallAsset(assetId, uninstalledBy, remarks);
    await auditLog('UPDATE', 'Asset', assetId, `Uninstalled asset`);
    return serialize(result);
  });

  ipcMain.handle('asset:transfer', async (_event, assetId: number, toStoreId: number, toLocationId?: number, toRoomId?: number, toDepartmentId?: number, transactionId?: number, voucherNo?: string, performedBy?: string, reason?: string, remarks?: string) => {
    requireAuth();
    const result = await assetService.transferAsset(assetId, toStoreId, toLocationId, toRoomId, toDepartmentId, transactionId, voucherNo, performedBy, reason, remarks);
    await auditLog('UPDATE', 'Asset', assetId, `Transferred asset`);
    return serialize(result);
  });

  ipcMain.handle('asset:repair', async (_event, assetId: number, data: any) => {
    requireAuth();
    const result = await assetService.recordRepair(assetId, data);
    await auditLog('UPDATE', 'Asset', assetId, `Recorded repair`);
    return serialize(result);
  });

  ipcMain.handle('asset:damage', async (_event, assetId: number, condition: string, reportedBy?: string, remarks?: string) => {
    requireAuth();
    const result = await assetService.recordDamage(assetId, condition as any, reportedBy, remarks);
    await auditLog('UPDATE', 'Asset', assetId, `Recorded damage`);
    return serialize(result);
  });

  ipcMain.handle('asset:scrap', async (_event, assetId: number, performedBy?: string, remarks?: string) => {
    requireAuth();
    const result = await assetService.scrapAsset(assetId, performedBy, remarks);
    await auditLog('UPDATE', 'Asset', assetId, `Scrapped asset`);
    return serialize(result);
  });

  ipcMain.handle('asset:dispose', async (_event, assetId: number, reason: string, performedBy?: string) => {
    requireAuth();
    const result = await assetService.disposeAsset(assetId, reason, performedBy);
    await auditLog('UPDATE', 'Asset', assetId, `Disposed asset`);
    return serialize(result);
  });

  // ─── TIMELINE ──────────────────────────────────

  ipcMain.handle('asset:timeline', async (_event, assetId: number) => {
    requireAuth();
    return serialize(await assetService.getTimeline(assetId));
  });

  ipcMain.handle('asset:addTimelineEvent', async (_event, assetId: number, eventType: string, data: any) => {
    requireAuth();
    const result = await assetService.addTimelineEvent(assetId, eventType as any, data);
    await auditLog('CREATE', 'AssetTimeline', assetId, `Added timeline event: ${eventType}`);
    return serialize(result);
  });

  // ─── PHOTOS & DOCUMENTS ────────────────────────

  ipcMain.handle('asset:addPhoto', async (_event, assetId: number, photoType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, caption?: string, takenBy?: string) => {
    requireAuth();
    const result = await assetService.addPhoto(assetId, photoType as any, fileName, filePath, fileSize, mimeType, caption, takenBy);
    await auditLog('CREATE', 'AssetPhoto', assetId, `Added photo: ${fileName}`);
    return serialize(result);
  });

  ipcMain.handle('asset:getPhotos', async (_event, assetId: number, photoType?: string) => {
    requireAuth();
    return serialize(await assetService.getPhotos(assetId, photoType as any));
  });

  ipcMain.handle('asset:deletePhoto', async (_event, photoId: number) => {
    requireAuth();
    await assetService.deletePhoto(photoId);
    await auditLog('DELETE', 'AssetPhoto', photoId, `Deleted photo: ${photoId}`);
    return { success: true };
  });

  ipcMain.handle('asset:addDocument', async (_event, assetId: number, documentType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, description?: string, uploadedBy?: string) => {
    requireAuth();
    const result = await assetService.addDocument(assetId, documentType as any, fileName, filePath, fileSize, mimeType, description, uploadedBy);
    await auditLog('CREATE', 'AssetDocument', assetId, `Added document: ${fileName}`);
    return serialize(result);
  });

  ipcMain.handle('asset:getDocuments', async (_event, assetId: number, documentType?: string) => {
    requireAuth();
    return serialize(await assetService.getDocuments(assetId, documentType as any));
  });

  ipcMain.handle('asset:deleteDocument', async (_event, docId: number) => {
    requireAuth();
    await assetService.deleteDocument(docId);
    await auditLog('DELETE', 'AssetDocument', docId, `Deleted document: ${docId}`);
    return { success: true };
  });

  // ─── REPORTS ───────────────────────────────────

  ipcMain.handle('asset:report:installed', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getInstalledAssetsReport(companyId));
  });

  ipcMain.handle('asset:report:warrantyExpiring', async (_event, companyId: number, days?: number) => {
    requireAuth();
    return serialize(await assetService.getWarrantyExpiringReport(companyId, days));
  });

  ipcMain.handle('asset:report:amcExpiring', async (_event, companyId: number, days?: number) => {
    requireAuth();
    return serialize(await assetService.getAmcExpiringReport(companyId, days));
  });

  ipcMain.handle('asset:report:repairHistory', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getRepairHistoryReport(companyId));
  });

  ipcMain.handle('asset:report:health', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getAssetHealthReport(companyId));
  });

  ipcMain.handle('asset:report:age', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getAssetAgeReport(companyId));
  });

  ipcMain.handle('asset:report:scrapped', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getScrappedAssetsReport(companyId));
  });

  ipcMain.handle('asset:report:disposed', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getDisposedAssetsReport(companyId));
  });

  ipcMain.handle('asset:report:lost', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getLostAssetsReport(companyId));
  });

  ipcMain.handle('asset:report:replacementSuggestions', async (_event, companyId: number, costThreshold?: number, repairThreshold?: number) => {
    requireAuth();
    return serialize(await assetService.getReplacementSuggestions(companyId, costThreshold, repairThreshold));
  });

  // ─── DASHBOARD ─────────────────────────────────

  ipcMain.handle('asset:dashboard', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getDashboardStats(companyId));
  });

  // ─── IMPORT ────────────────────────────────────

  ipcMain.handle('asset:import', async (_event, companyId: number, assets: any[]) => {
    requireAuth();
    const result = await assetService.importAssets(companyId, assets);
    await auditLog('IMPORT', 'Asset', undefined, `Imported ${assets.length} assets`);
    return serialize(result);
  });

  ipcMain.handle('asset:bulkUpdateCondition', async (_event, assetIds: number[], condition: string, updatedBy?: string) => {
    requireAuth();
    const result = await assetService.bulkUpdateCondition(assetIds, condition as any, updatedBy);
    await auditLog('UPDATE', 'Asset', undefined, `Bulk updated condition for ${assetIds.length} assets`);
    return serialize(result);
  });

  // ─── EXPIRY REMINDERS ──────────────────────────

  ipcMain.handle('asset:expiringWarranties', async (_event, companyId: number, days?: number) => {
    requireAuth();
    return serialize(await assetService.getExpiringWarranties(companyId, days));
  });

  ipcMain.handle('asset:expiringAMCs', async (_event, companyId: number, days?: number) => {
    requireAuth();
    return serialize(await assetService.getExpiringAMCs(companyId, days));
  });

  ipcMain.handle('asset:endOfLife', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await assetService.getEndOfLifeAssets(companyId));
  });

  // ─── QR CODE ────────────────────────────────────

  ipcMain.handle('asset:qr:generate', async (_event, assetId: number) => {
    requireAuth();
    const asset = await prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    const qrData = JSON.stringify({ type: 'ASSET', code: asset.assetCode, id: asset.id, name: asset.assetName });
    const dataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } });
    return { assetCode: asset.assetCode, qrDataUrl: dataUrl, raw: qrData };
  });

  ipcMain.handle('asset:qr:print', async (_event, assetId: number) => {
    requireAuth();
    const asset = await prisma.assetProfile.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    const qrData = JSON.stringify({ type: 'ASSET', code: asset.assetCode, id: asset.id, name: asset.assetName });
    const dataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
    const html = `<!DOCTYPE html><html><head><title>Asset QR</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:40px}.card{border:2px solid #333;border-radius:8px;padding:20px;display:inline-block}img{margin:10px 0}h2{margin:0 0 4px 0}p{margin:4px 0;color:#666}</style></head>
      <body><div class="card"><h2>Mahaveerji Jewellers</h2><p>Asset: ${asset.assetCode}</p>
      <img src="${dataUrl}" /><p>${asset.assetName}</p>
      <p style="font-size:12px;color:#999">Scan to view asset details</p></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
    const win = new BrowserWindow({ width: 400, height: 500, show: true, title: `QR - ${asset.assetCode}` });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return { success: true };
  });

  // ─── FILE UPLOAD (photo/document) ────────────────

  ipcMain.handle('asset:file:select', async (_event, options?: { type?: 'photo' | 'document' }) => {
    requireAuth();
    const filters = options?.type === 'photo'
      ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
      : options?.type === 'document'
        ? [{ name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'] }]
        : [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'] },
            { name: 'All Files', extensions: ['*'] },
          ];
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    return { filePath, fileName: path.basename(filePath), fileSize: stat.size, mimeType: getMimeType(filePath) };
  });

  ipcMain.handle('asset:file:copyToAssets', async (_event, sourcePath: string, assetCode: string, subfolder: string) => {
    requireAuth();
    const safeSubfolder = subfolder.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeAssetCode = assetCode.replace(/[^a-zA-Z0-9_-]/g, '');
    const assetsDir = path.join(app.getPath('userData'), 'assets', safeAssetCode, safeSubfolder);
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    const destPath = path.join(assetsDir, path.basename(sourcePath));
    fs.copyFileSync(sourcePath, destPath);
    return { savedPath: destPath, fileName: path.basename(sourcePath) };
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.bmp': 'image/bmp', '.webp': 'image/webp', '.pdf': 'application/pdf',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}
