import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';

import { initializeDatabase, getPrismaClient, disconnectPrisma, runMigrations } from '../src/main/database/prisma.client';
import { seedDatabase } from '../src/main/database/seed';
import { RBACService } from '../src/main/services/rbac.service';
import { registerChallanIpc } from './ipc/challan.ipc';
import { registerImportIpc } from './ipc/import.ipc';
import { registerStockIpc } from './ipc/stock.ipc';
import { registerAuthIpc } from './ipc/auth.ipc';
import { registerMasterDataIpc } from './ipc/masterData.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerInstallationIPC } from './ipc/installation.ipc';
import { runHeavyTask } from './worker/worker-manager';
import { registerDashboardIPC } from './ipc/dashboard.ipc';
import { registerFinancialYearIPC } from './ipc/financialYear.ipc';
import { registerAuditIPC } from './ipc/audit.ipc';
import { registerRBACIPC } from './ipc/rbac.ipc';
import { registerSecurityIPC } from './ipc/security.ipc';
import { initUpdater, checkForUpdates } from './updater';
import { registerDataIntegrityIPC, startScheduledIntegrityChecks } from './ipc/dataIntegrity.ipc';
import { registerUtilsIpc } from './ipc/utils.ipc';
import { registerEnterpriseIpc } from './ipc/enterprise.ipc';
import { registerAssetIpc } from './ipc/asset.ipc';
import { registerRequisitionIpc } from './ipc/requisition.ipc';
import { registerProcurementIpc } from './ipc/procurement.ipc';
import { registerMaintenanceIPC } from './ipc/maintenance.ipc';
import { registerDemandIPC } from './ipc/demand.ipc';
import { registerConsumptionIPC } from './ipc/consumption.ipc';
import { requireAuth } from './ipc/helpers';
import { getLogger } from '../src/main/services/monitoring/logger.service';
import { getPerformanceMonitor } from '../src/main/services/monitoring/performance.service';
import { BackupService } from '../src/main/services/backup.service';

let mainWindow: BrowserWindow | null = null;
let backupService: BackupService;

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
      sandbox: true,
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

  // Content Security Policy
  const isDev = !!VITE_DEV_SERVER_URL;
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives],
      },
    });
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  const perfMon = getPerformanceMonitor();

  const stopDbInit = perfMon.startTimer('db:init');
  const [dbReady] = await Promise.all([
    initializeDatabase(),
  ]);
  stopDbInit();

  const logger = getLogger();

  logger.info('Database initialized', 'main');

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

  // Seed role permissions for all companies (ensures STORE_MANAGER gets manage_masters, etc.)
  try {
    const companies = await prisma.company.findMany({ where: { isActive: true } });
    const rbac = new RBACService(prisma);
    for (const company of companies) {
      await rbac.seedRoles(company.id);
    }
  } catch (e: any) {
    console.warn('Role permission seed warning:', e.message);
  }

  // Start scheduled integrity checks (daily at 2 AM)
  startScheduledIntegrityChecks(prisma);

  const stopIpc = perfMon.startTimer('ipc:register');
  registerIpcHandlers();
  stopIpc();

  createWindow();
  logger.info('Application ready', 'main');
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', async () => {
  await disconnectPrisma();
  if (process.platform !== 'darwin') app.quit();
});

// ─── Global Error Handlers ──────────────────────────────────────
process.on('uncaughtException', (error) => {
  getLogger().error(`[FATAL] Uncaught Exception: ${error.message}`, 'main', undefined, error.stack);
});

process.on('unhandledRejection', (reason) => {
  getLogger().error(`[FATAL] Unhandled Rejection: ${reason}`, 'main');
});

function registerIpcHandlers() {
  const prisma = getPrismaClient();
  registerChallanIpc();
  registerStockIpc();
  registerImportIpc(mainWindow);
  registerAuthIpc();
  registerMasterDataIpc();
  registerSettingsIpc();
  registerInstallationIPC();
  registerUtilsIpc(mainWindow);
  registerEnterpriseIpc(prisma);
  registerAssetIpc();
  registerRequisitionIpc();
  registerProcurementIpc();
  registerMaintenanceIPC();
  registerDemandIPC();
  registerConsumptionIPC();
  registerDashboardIPC();
  registerFinancialYearIPC(prisma);
  registerAuditIPC(prisma);
  registerRBACIPC(prisma);
  registerSecurityIPC(prisma);
  registerDataIntegrityIPC(prisma);

  ipcMain.handle('db:getPath', () => { requireAuth(); return backupService.getBaseDir(); });
  ipcMain.handle('backup:create', async () => { requireAuth(); return backupService.performBackup(); });
  ipcMain.handle('backup:list', () => { requireAuth(); return backupService.listBackups(); });
  ipcMain.handle('backup:getStorageInfo', () => { requireAuth(); return backupService.getStorageInfo(); });
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
    const session = requireAuth();
    if (session.role !== 'ADMIN') throw new Error('Permission denied: admin role required');
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

  // Sensitive fields that should never be exposed through db:query
  const SENSITIVE_FIELDS = new Set([
    'passwordHash', 'lockedUntil', 'failedLoginAttempts', 'lastPasswordChange', 'passwordExpiry',
  ]);

  // Models with sensitive fields that need field filtering
  const SENSITIVE_MODELS: Record<string, string[]> = {
    User: ['passwordHash', 'lockedUntil', 'failedLoginAttempts', 'lastPasswordChange', 'passwordExpiry'],
    Session: ['token'],
  };

  ipcMain.handle('db:query', async (_event, model: string, method: string, ...args: any[]) => {
    requireAuth();
    if (DB_WRITE_METHODS.has(method)) {
      throw new Error(
        `Write operation '${method}' on '${model}' is not allowed through db:query. ` +
        `Use the dedicated IPC handler instead.`
      );
    }

    // Model name mapping: old frontend names → actual Prisma models
    const MODEL_MAP: Record<string, string> = {
      issueChallan: 'transactionHeader', issueChallans: 'transactionHeader',
      receiptChallan: 'transactionHeader', receiptChallans: 'transactionHeader',
      transferChallan: 'transactionHeader', transferChallans: 'transactionHeader',
      vendorReturnChallan: 'returnToVendor',
      stockTransaction: 'ledgerEntry',
      issueChallanItem: 'transactionDetail', issueChallanItems: 'transactionDetail',
      receiptChallanItem: 'transactionDetail', receiptChallanItems: 'transactionDetail',
      transferChallanItem: 'transactionDetail', transferChallanItems: 'transactionDetail',
      damageEntry: 'transactionHeader',
      stockAdjustment: 'transactionHeader',
      openingStock: 'transactionHeader',
      challanSequence: 'voucherSequence',
      asset: 'assetProfile',
      aMC: 'aMCAgreement',
    };
    const resolvedModel = MODEL_MAP[model] || model;

    // Field alias mapping: frontend-friendly names → actual Prisma field names
    const FIELD_ALIASES: Record<string, Record<string, string>> = {
      ledgerEntry: { date: 'transactionDate', transactionType: 'movementType' },
      transactionHeader: { date: 'transactionDate' },
      returnToVendor: { date: 'returnDate' },
      issueChallan: { date: 'transactionDate' }, issueChallans: { date: 'transactionDate' },
      receiptChallan: { date: 'transactionDate' }, receiptChallans: { date: 'transactionDate' },
      transferChallan: { date: 'transactionDate', fromDepartmentId: 'fromStoreId', toDepartmentId: 'toStoreId' },
      transferChallans: { date: 'transactionDate', fromDepartmentId: 'fromStoreId', toDepartmentId: 'toStoreId' },
      damageEntry: { date: 'transactionDate' },
      stockAdjustment: { date: 'transactionDate' },
      vendorReturnChallan: { date: 'returnDate' },
    };
    // Include key alias mapping: frontend-friendly names → actual Prisma relation names
    const INCLUDE_ALIASES: Record<string, Record<string, string>> = {
      transactionHeader: { items: 'details', sourceStore: 'fromStore' },
      issueChallan: { items: 'details', sourceStore: 'fromStore' },
      issueChallans: { items: 'details', sourceStore: 'fromStore' },
      receiptChallan: { items: 'details' },
      receiptChallans: { items: 'details' },
      transferChallan: { items: 'details', fromDepartment: 'fromStore', toDepartment: 'toStore' },
      transferChallans: { items: 'details', fromDepartment: 'fromStore', toDepartment: 'toStore' },
      damageEntry: { items: 'details' },
      stockAdjustment: { items: 'details' },
      returnToVendor: { items: 'details' },
      vendorReturnChallan: { items: 'details' },
      transactionDetail: { issueChallan: 'transaction', transferChallan: 'transaction', receiptChallan: 'transaction' },
    };
    function applyAliases(obj: any, modelName: string): any {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map((item) => applyAliases(item, modelName));
      const fieldAliases = FIELD_ALIASES[modelName] || {};
      const includeAliases = INCLUDE_ALIASES[modelName] || {};
      const allAliases = { ...fieldAliases, ...includeAliases };
      const out: any = {};
      for (const [k, v] of Object.entries(obj)) {
        const newKey = allAliases[k] || k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          out[newKey] = applyAliases(v, modelName);
        } else {
          out[newKey] = v;
        }
      }
      return out;
    }
    const aliasArgs = args.map((a) => applyAliases(a, resolvedModel));

    const modelDelegate = (prisma as any)[resolvedModel];
    if (!modelDelegate) throw new Error(`Model ${model} (resolved: ${resolvedModel}) not found`);
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
    const convertedArgs = aliasArgs.map(convertDates);

    try {
      const result = await fn.apply(modelDelegate, convertedArgs);

      // Reverse alias: rename mapped keys back to frontend-friendly names
      const REVERSE_INCLUDE_ALIASES: Record<string, Record<string, string>> = {
        transactionHeader: { details: 'items' },
        receiptChallan: { details: 'items' }, receiptChallans: { details: 'items' },
        issueChallan: { details: 'items' }, issueChallans: { details: 'items' },
        transferChallan: { details: 'items' }, transferChallans: { details: 'items' },
        damageEntry: { details: 'items' },
        stockAdjustment: { details: 'items' },
        returnToVendor: { details: 'items' },
        vendorReturnChallan: { details: 'items' },
      };
      // Reverse field aliases: Prisma field names → frontend-friendly names
      const REVERSE_FIELD_ALIASES: Record<string, Record<string, string>> = {
        returnToVendor: { returnDate: 'date' },
        ledgerEntry: { transactionDate: 'date', movementType: 'transactionType' },
      };
      const reverseMap = REVERSE_INCLUDE_ALIASES[resolvedModel] || {};
      const reverseFieldMap = REVERSE_FIELD_ALIASES[resolvedModel] || {};
      function applyReverseAliases(data: any): any {
        if (!data || typeof data !== 'object') return data;
        if (Array.isArray(data)) return data.map(applyReverseAliases);
        // Preserve Date objects — Object.entries(date) returns [] which would destroy them
        if (data instanceof Date) return data;
        const out: any = {};
        for (const [k, v] of Object.entries(data)) {
          const newKey = reverseFieldMap[k] || reverseMap[k] || k;
          out[newKey] = (typeof v === 'object' && v !== null) ? applyReverseAliases(v) : v;
        }
        return out;
      }
      const aliasedResult = applyReverseAliases(result);

      // Serialize to plain JSON, strip sensitive fields, handle BigInt and Decimal
      // IMPORTANT: JSON.stringify calls toJSON() BEFORE the replacer, so Decimal's {s,e,d}
      // structure is never seen by the replacer. We must walk the tree manually first.
      function serializePrimitives(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return obj.toString();
        // Duck-type Date check (instanceof fails across Electron realms)
        if (typeof obj.getTime === 'function' && typeof obj.toISOString === 'function' && !isNaN(obj.getTime())) {
          try { return obj.toISOString(); } catch { return null; }
        }
        if (typeof obj === 'object') {
          // Prisma Decimal: has s (sign), e (exponent), d (digits array) internal structure
          // toJSON() returns {s,e,d} NOT a number, so detect the structure directly
          // Electron IPC may strip prototype methods, so compute from raw properties
          if (typeof obj.s === 'number' && typeof obj.e === 'number' && ('d' in obj)) {
            try {
              const num = Number(obj.toString());
              if (isFinite(num)) return num;
            } catch { /* fall through to manual compute */ }
            // Fallback: compute from s, e, d manually
            try {
              const sign = obj.s === 1 ? 1 : -1;
              const digits = Array.isArray(obj.d) ? obj.d.join('') : String(obj.d);
              return sign * parseFloat(digits + 'e' + (obj.e - (digits.length - 1)));
            } catch { return 0; }
          }
          // Also try toJSON for other custom types that return primitives
          if (typeof obj.toJSON === 'function') {
            try {
              const v = obj.toJSON();
              if (typeof v === 'number' || typeof v === 'string') return v;
            } catch { /* fall through */ }
          }
          if (Array.isArray(obj)) return obj.map(serializePrimitives);
          const out: any = {};
          for (const [k, v] of Object.entries(obj)) {
            out[k] = serializePrimitives(v);
          }
          return out;
        }
        return obj;
      }
      const serialized = serializePrimitives(aliasedResult);

      return JSON.parse(JSON.stringify(serialized), (_key, value) => {
        // Strip sensitive fields from results
        if (typeof value === 'object' && value !== null && SENSITIVE_MODELS[model]) {
          for (const field of SENSITIVE_MODELS[model]) {
            if (field in value) {
              delete value[field];
            }
          }
        }
        return value;
      });
    } catch (err: any) {
      getLogger().error(`[db:query] ERROR on ${model}.${method}: ${err.message}`, 'db:query', undefined, JSON.stringify(convertedArgs, null, 2).substring(0, 2000));
      const sanitized = err?.code?.startsWith('P') ? `Database error (${err.code}). Please try again.` : (err.message || 'An unexpected error occurred');
      throw new Error(sanitized);
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

  // XPS Converter handlers - removed (xps-converter service deleted)

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
}
