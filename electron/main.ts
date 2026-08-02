import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';

import { initializeDatabase, getPrismaClient, disconnectPrisma, runMigrations } from '../src/main/database/prisma.client';
import { seedDatabase } from '../src/main/database/seed';
import { registerChallanIpc } from './ipc/challan.ipc';
import { registerImportIpc } from './ipc/import.ipc';
import { registerStockIpc } from './ipc/stock.ipc';
import { registerDashboardIpc } from './ipc/dashboard.ipc';
import { registerAuthIpc } from './ipc/auth.ipc';
import { registerMasterDataIpc } from './ipc/masterData.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { runHeavyTask } from './worker/worker-manager';
import { loadDemoData, clearDemoData } from '../src/main/database/demo-data';
import { BackupService } from '../src/main/services/backup.service';
import { XpsConverterService } from '../src/main/services/xps-converter/index';
import { ItemImportService } from '../src/main/services/xps-converter/item-import.service';
import { initUpdater, checkForUpdates } from './updater';
import { registerUtilsIpc } from './ipc/utils.ipc';
import { requireAuth } from './ipc/helpers';

let mainWindow: BrowserWindow | null = null;
let backupService: BackupService;
const xpsConverterService = new XpsConverterService();
const itemImportService = new ItemImportService();

const DIST = path.join(__dirname, '../dist');
const PRELOAD = path.join(__dirname, './preload.js');
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Mahaveerji Inventory Management',
    fullscreen: false,
    maximized: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: (() => {
      const distIcon = path.join(DIST, 'favicon.ico');
      const buildIcon = path.join(__dirname, '../build/icon.ico');
      if (fs.existsSync(distIcon)) return distIcon;
      if (fs.existsSync(buildIcon)) return buildIcon;
      return undefined;
    })(),
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
    initUpdater(mainWindow!);
    setTimeout(() => checkForUpdates(), 5000);
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  const [dbReady] = await Promise.all([
    initializeDatabase(),
  ]);

  await runMigrations();
  
  const prisma = getPrismaClient();
  
  // Parallel initialization
  await Promise.all([
    seedDatabase(prisma),
    (async () => {
      backupService = new BackupService();
      backupService.startScheduledBackups();
    })(),
  ]);
  
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', async () => {
  await disconnectPrisma();
  if (process.platform !== 'darwin') app.quit();
});

function registerIpcHandlers() {
  const prisma = getPrismaClient();
  registerChallanIpc();
  registerStockIpc();
  registerImportIpc(mainWindow);
  registerDashboardIpc();
  registerAuthIpc();
  registerMasterDataIpc();
  registerSettingsIpc();
  registerUtilsIpc(mainWindow);

  ipcMain.handle('db:getPath', () => { requireAuth(); return backupService.getBaseDir(); });
  ipcMain.handle('backup:create', async () => { requireAuth(); return backupService.performBackup(); });
  ipcMain.handle('backup:list', () => { requireAuth(); return backupService.listBackups(); });
  ipcMain.handle('backup:restore', async (_event, backupPath: string) => {
    requireAuth();
    await backupService.restoreBackup(backupPath);
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle('backup:getExportsDir', () => { requireAuth(); return backupService.getExportsDir(); });

  // Open folder in file explorer
  ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
    await shell.openPath(folderPath);
  });

  // Change backup location (admin only)
  ipcMain.handle('backup:changeLocation', async (_event, newDir: string) => {
    requireAuth();
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    const settingsPath = path.join(app.getPath('userData'), 'InventoryData', 'settings.json');
    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {}
    }
    settings.backupLocation = newDir;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    backupService.updateBaseDir(newDir);
    return { success: true, path: newDir };
  });

  ipcMain.handle('backup:getLocation', () => {
    const settingsPath = path.join(app.getPath('userData'), 'InventoryData', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        return settings.backupLocation || path.join(app.getPath('userData'), 'InventoryData');
      } catch {}
    }
    return path.join(app.getPath('userData'), 'InventoryData');
  });

  ipcMain.handle('dialog:saveFile', async (_event, options) => dialog.showSaveDialog(mainWindow!, options));
  ipcMain.handle('dialog:openFile', async (_event, options) => dialog.showOpenDialog(mainWindow!, options));
  ipcMain.handle('dialog:showMessage', async (_event, options) => dialog.showMessageBox(mainWindow!, options));

  const DB_WRITE_METHODS = new Set([
    'create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
  ]);

  ipcMain.handle('db:query', async (_event, model: string, method: string, ...args: any[]) => {
    requireAuth();
    if (DB_WRITE_METHODS.has(method)) {
      throw new Error(
        `Write operation '${method}' on '${model}' is not allowed through db:query. ` +
        `Use the dedicated IPC handler instead.`
      );
    }

    const modelDelegate = (prisma as any)[model];
    if (!modelDelegate) throw new Error(`Model ${model} not found`);
    const fn = modelDelegate[method];
    if (!fn) throw new Error(`Method ${method} not found on ${model}`);

    // Auto-convert date strings to Date objects in data args
    const dateFields = ['date', 'invoiceDate', 'postedAt', 'createdAt', 'updatedAt', 'financialYearStart', 'financialYearEnd', 'transactionDate'];
    function convertDates(obj: any): any {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(convertDates);
      const out: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (dateFields.includes(k)) {
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}($|T)/.test(v)) {
            out[k] = new Date(v);
          } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            // Handle { gte: "dateStr", lte: "dateStr" } filter objects
            const nested: any = {};
            for (const [nk, nv] of Object.entries(v as any)) {
              if (typeof nv === 'string' && /^\d{4}-\d{2}-\d{2}($|T)/.test(nv)) {
                nested[nk] = new Date(nv);
              } else {
                nested[nk] = nv;
              }
            }
            out[k] = nested;
          } else if (v === '' || v === null || v === undefined) {
            out[k] = null;
          } else {
            out[k] = v;
          }
        } else if (typeof v === 'object' && v !== null) {
          out[k] = convertDates(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    }
    const convertedArgs = args.map(convertDates);

    try {
      const result = await fn.apply(modelDelegate, convertedArgs);
      // Serialize to plain JSON to avoid IPC cloning issues with Date, BigInt, etc.
      return JSON.parse(JSON.stringify(result, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    } catch (err: any) {
      console.error(`[db:query] ERROR on ${model}.${method}:`, err.message);
      console.error(`[db:query] args:`, JSON.stringify(convertedArgs, null, 2).substring(0, 2000));
      throw err;
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0); });

  // Demo data handlers
  ipcMain.handle('demo:load', async () => {
    requireAuth();
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    if (!company) return 'No company found. Create a company first.';
    const fy = await prisma.financialYear.findFirst({ where: { companyId: company.id, isClosed: false } });
    if (!fy) return 'No active financial year found. Create a financial year first.';
    return loadDemoData(prisma, company.id, fy.id);
  });

  ipcMain.handle('demo:clear', async () => {
    requireAuth();
    return clearDemoData(prisma);
  });

  // XPS Converter handlers
  ipcMain.handle('xps:convert', async (_event, buffer: ArrayBuffer, onProgress?: (p: any) => void) => {
    return xpsConverterService.convert(Buffer.from(buffer), onProgress);
  });

  ipcMain.handle('xps:convertText', async (_event, text: string, fontType: string) => {
    return xpsConverterService.convertText(text, fontType as any);
  });

  ipcMain.handle('xps:export', async (_event, result: any, format: string, options: any, fileName: string) => {
    return xpsConverterService.export(result, format as any, options, fileName);
  });

  ipcMain.handle('xps:getPagePreview', async (_event, doc: any, pageNumber: number) => {
    return xpsConverterService.getPagePreview(doc, pageNumber);
  });

  ipcMain.handle('xps:saveFile', async (_event, buffer: ArrayBuffer, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, Buffer.from(buffer));
      return result.filePath;
    }
    return null;
  });

  // PDF text extraction
  ipcMain.handle('pdf:extractText', async (_event, buffer: ArrayBuffer) => {
    // Simple polyfills for pdfjs-dist
    if (typeof (global as any).DOMMatrix === 'undefined') {
      (global as any).DOMMatrix = class DOMMatrix {
        constructor() {}
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
      };
    }
    if (typeof (global as any).ImageData === 'undefined') {
      (global as any).ImageData = class ImageData {
        constructor() {}
      };
    }
    if (typeof (global as any).Path2D === 'undefined') {
      (global as any).Path2D = class Path2D {
        constructor() {}
        addPath() {}
      };
    }

    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(Buffer.from(buffer));
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  });

  // Kruti Dev to Excel export
  ipcMain.handle('export:krutidevToExcel', async (_event, data: any) => {
    requireAuth();
    return runHeavyTask('exportKrutidevToExcel', { data });
  });

  // Item Import from XPS handlers
  ipcMain.handle('import:extractItems', async (_event, buffer: ArrayBuffer) => {
    requireAuth();
    return itemImportService.extractItems(Buffer.from(buffer));
  });

  ipcMain.handle('import:bulkItems', async (_event, items: any[], companyId: number, categoryId: number, unitId: number) => {
    requireAuth();
    return itemImportService.importItems(items, companyId, categoryId, unitId);
  });
}
