import { ipcMain, dialog, app } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { requireAuth } from './helpers';
import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { BackupService } from '../../src/main/services/backup.service';
import { BulkOperationsService } from '../../src/main/services/bulkOperations.service';

let backupService: BackupService | null = null;
let bulkOpsService: BulkOperationsService | null = null;

function getBackupService(): BackupService {
  if (!backupService) {
    backupService = new BackupService();
  }
  return backupService;
}

function getBulkOpsService(): BulkOperationsService {
  if (!bulkOpsService) {
    bulkOpsService = new BulkOperationsService(getPrismaClient());
  }
  return bulkOpsService;
}

export function registerUtilsIpc(mainWindow: Electron.BrowserWindow | null) {
  const prisma = getPrismaClient();

  // Generate PDF from HTML content
  ipcMain.handle('pdf:generate', async (_event, htmlContent: string, options?: { fileName?: string; width?: number; height?: number }) => {
    requireAuth();
    const width = options?.width || 595.28;
    const height = options?.height || 841.89;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const lines = htmlContent.split('\n');
    let y = height - 40;
    const lineHeight = 14;
    const margin = 40;
    const maxWidth = width - 2 * margin;

    for (const line of lines) {
      if (y < 40) {
        const newPage = pdfDoc.addPage([width, height]);
        y = height - 40;
      }

      const cleanLine = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const trimmed = cleanLine.trim();

      if (!trimmed) {
        y -= lineHeight / 2;
        continue;
      }

      const isBold = /<strong>|<b>/.test(line);
      const currentFont = isBold ? boldFont : font;
      const fontSize = isBold ? 11 : 10;

      try {
        page.drawText(trimmed, {
          x: margin,
          y,
          size: fontSize,
          font: currentFont,
          color: rgb(0, 0, 0),
        });
      } catch {
        page.drawText(trimmed.substring(0, 80), {
          x: margin,
          y,
          size: fontSize,
          font: currentFont,
          color: rgb(0, 0, 0),
        });
      }

      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = options?.fileName || `challan_${Date.now()}.pdf`;

    const saveResult = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: fileName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (!saveResult.canceled && saveResult.filePath) {
      fs.writeFileSync(saveResult.filePath, pdfBytes);
      return { success: true, path: saveResult.filePath };
    }
    return { success: false };
  });

  // Generate PDF from print layout (receives rendered HTML from ChallanPrintLayout)
  ipcMain.handle('pdf:generateFromPrint', async (_event, data: { type: string; challanData: any }) => {
    requireAuth();
    const { type, challanData } = data;

    const htmlContent = buildChallanHtml(type, challanData,
      data.challanData._trustName || 'Digamber Jain Atishay Kshetra',
      data.challanData._headerText || 'SHRI MAHAVEERJI'
    );

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    drawHtmlToPage(page, htmlContent, 595.28, 841.89, font, boldFont);

    const pdfBytes = await pdfDoc.save();
    const fileName = `${type}_Challan_${challanData.challanNo || Date.now()}.pdf`;

    const saveResult = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: fileName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (!saveResult.canceled && saveResult.filePath) {
      fs.writeFileSync(saveResult.filePath, pdfBytes);
      return { success: true, path: saveResult.filePath };
    }
    return { success: false };
  });

  // Generate import template for a specific table
  ipcMain.handle('import:generateTemplate', async (_event, model: string) => {
    requireAuth();
    const templates: Record<string, { name: string; columns: Array<{ header: string; key: string; sample: string; required?: boolean }>; description: string }> = {
      itemCategory: {
        name: 'Categories',
        description: 'Item categories (e.g., Furniture, Electronics, Stationery)',
        columns: [
          { header: 'name', key: 'name', sample: 'Furniture', required: true },
          { header: 'prefix', key: 'prefix', sample: 'FUR', required: true },
          { header: 'isActive', key: 'isActive', sample: 'true' },
        ],
      },
      unit: {
        name: 'Units',
        description: 'Measurement units (e.g., Pcs, Kg, Box, Ltr)',
        columns: [
          { header: 'name', key: 'name', sample: 'Pieces', required: true },
          { header: 'symbol', key: 'symbol', sample: 'Pcs' },
        ],
      },
      item: {
        name: 'Items',
        description: 'Inventory items with category and unit references',
        columns: [
          { header: 'itemCode', key: 'itemCode', sample: 'FUR-001', required: true },
          { header: 'itemName', key: 'itemName', sample: 'Wooden Chair', required: true },
          { header: 'categoryName', key: 'categoryName', sample: 'Furniture', required: true },
          { header: 'unitName', key: 'unitName', sample: 'Pieces', required: true },
          { header: 'minimumStockLevel', key: 'minimumStockLevel', sample: '10' },
          { header: 'isActive', key: 'isActive', sample: 'true' },
        ],
      },
      vendor: {
        name: 'Vendors',
        description: 'Supplier/vendor information',
        columns: [
          { header: 'name', key: 'name', sample: 'Shree Furniture Mart', required: true },
          { header: 'contactPerson', key: 'contactPerson', sample: 'Ramesh Kumar' },
          { header: 'phone', key: 'phone', sample: '9876543210' },
          { header: 'address', key: 'address', sample: 'Main Market, Mahaveerji' },
          { header: 'gstNumber', key: 'gstNumber', sample: '06XXXXX1234X1Z5' },
          { header: 'isActive', key: 'isActive', sample: 'true' },
        ],
      },
      department: {
        name: 'Departments',
        description: 'Store/department locations',
        columns: [
          { header: 'name', key: 'name', sample: 'Central Store', required: true },
          { header: 'code', key: 'code', sample: 'CS01' },
          { header: 'departmentType', key: 'departmentType', sample: 'Store' },
          { header: 'isActive', key: 'isActive', sample: 'true' },
        ],
      },
      location: {
        name: 'Locations',
        description: 'Room/area locations within departments',
        columns: [
          { header: 'locationType', key: 'locationType', sample: 'Dharamshala', required: true },
          { header: 'locationName', key: 'locationName', sample: 'Room 101', required: true },
          { header: 'category', key: 'category', sample: 'AC' },
          { header: 'floor', key: 'floor', sample: 'Ground' },
          { header: 'isActive', key: 'isActive', sample: 'true' },
        ],
      },
    };

    const template = templates[model];
    if (!template) throw new Error(`No template available for model: ${model}`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mahaveerji Inventory';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Template');
    ws.addRow(['=== MAHAVEERJI INVENTORY - IMPORT TEMPLATE ===']);
    ws.addRow([`Table: ${template.name}`]);
    ws.addRow([template.description]);
    ws.addRow([]);
    ws.addRow(['=== COLUMN INSTRUCTIONS ===']);
    ws.addRow(['Column Name', 'Required', 'Sample Value', 'Description']);
    for (const col of template.columns) {
      ws.addRow([col.key, col.required ? 'YES' : 'No', col.sample, '']);
    }
    ws.addRow([]);
    ws.addRow(['=== DATA STARTS BELOW (DO NOT MODIFY HEADER ROW) ===']);
    ws.addRow(template.columns.map(c => c.key));

    // Add sample rows
    ws.addRow(template.columns.map(c => c.sample));
    const sample2 = template.columns.map(c => {
      if (c.key === 'name' && model === 'itemCategory') return 'Electronics';
      if (c.key === 'prefix' && model === 'itemCategory') return 'ELE';
      if (c.key === 'name' && model === 'unit') return 'Kilogram';
      if (c.key === 'symbol' && model === 'unit') return 'Kg';
      if (c.key === 'itemCode' && model === 'item') return 'ELE-001';
      if (c.key === 'itemName' && model === 'item') return 'LED Bulb 9W';
      if (c.key === 'categoryName' && model === 'item') return 'Electronics';
      if (c.key === 'unitName' && model === 'item') return 'Pieces';
      if (c.key === 'name' && model === 'vendor') return 'Electro Supply Co.';
      if (c.key === 'contactPerson' && model === 'vendor') return 'Suresh Jain';
      if (c.key === 'name' && model === 'department') return 'Dharamshala Block A';
      if (c.key === 'code' && model === 'department') return 'DBA01';
      if (c.key === 'locationType' && model === 'location') return 'Room';
      if (c.key === 'locationName' && model === 'location') return 'Room 201';
      return c.sample;
    });
    ws.addRow(sample2);

    // Style the template
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.getRow(2).font = { bold: true, size: 11 };
    ws.getRow(6).font = { bold: true };
    ws.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    ws.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const headerRowNum = 12;
    ws.getRow(headerRowNum).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(headerRowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };

    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    for (const col of template.columns) {
      const colIdx = template.columns.indexOf(col) + 1;
      ws.getColumn(colIdx).width = Math.max(col.key.length, col.sample.length, 15) + 4;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  });

  // Get all tables info for backup verification
  ipcMain.handle('backup:getInfo', async () => {
    requireAuth();
    const tables = [
      { model: 'company', name: 'Companies' },
      { model: 'financialYear', name: 'Financial Years' },
      { model: 'department', name: 'Departments' },
      { model: 'itemCategory', name: 'Categories' },
      { model: 'unit', name: 'Units' },
      { model: 'item', name: 'Items' },
      { model: 'vendor', name: 'Vendors' },
      { model: 'location', name: 'Locations' },
      { model: 'receiptChallan', name: 'Receipt Challans' },
      { model: 'receiptChallanItem', name: 'Receipt Challan Items' },
      { model: 'issueChallan', name: 'Issue Challans' },
      { model: 'issueChallanItem', name: 'Issue Challan Items' },
      { model: 'transferChallan', name: 'Transfer Challans' },
      { model: 'transferChallanItem', name: 'Transfer Challan Items' },
      { model: 'ledgerEntry', name: 'Ledger Entries (Stock)' },
      { model: 'openingStock', name: 'Opening Stock' },
      { model: 'damageEntry', name: 'Damage Entries' },
      { model: 'stockAdjustment', name: 'Stock Adjustments' },
      { model: 'vendorReturnChallan', name: 'Vendor Returns' },
      { model: 'vendorReturnChallanItem', name: 'Vendor Return Items' },
      { model: 'assetInstallation', name: 'Asset Installations' },
      { model: 'user', name: 'Users' },
      { model: 'loginHistory', name: 'Login History' },
      { model: 'auditLog', name: 'Audit Logs' },
      { model: 'challanSequence', name: 'Challan Sequences' },
    ];

    const tableInfo = [];
    for (const table of tables) {
      try {
        const modelDelegate = (prisma as any)[table.model];
        if (!modelDelegate) continue;
        const count = await modelDelegate.count();
        tableInfo.push({ model: table.model, name: table.name, count });
      } catch {
        tableInfo.push({ model: table.model, name: table.name, count: 0 });
      }
    }
    return tableInfo;
  });

  // Export all tables with all columns (complete backup)
  ipcMain.handle('import:exportAllTablesComplete', async () => {
    requireAuth();
    const tables = [
      { model: 'company', name: 'Companies' },
      { model: 'financialYear', name: 'Financial Years' },
      { model: 'department', name: 'Departments' },
      { model: 'itemCategory', name: 'Categories' },
      { model: 'unit', name: 'Units' },
      { model: 'item', name: 'Items' },
      { model: 'vendor', name: 'Vendors' },
      { model: 'location', name: 'Locations' },
      { model: 'receiptChallan', name: 'Receipt Challans' },
      { model: 'receiptChallanItem', name: 'Receipt Challan Items' },
      { model: 'issueChallan', name: 'Issue Challans' },
      { model: 'issueChallanItem', name: 'Issue Challan Items' },
      { model: 'transferChallan', name: 'Transfer Challans' },
      { model: 'transferChallanItem', name: 'Transfer Challan Items' },
      { model: 'ledgerEntry', name: 'Ledger Entries (Stock)' },
      { model: 'openingStock', name: 'Opening Stock' },
      { model: 'damageEntry', name: 'Damage Entries' },
      { model: 'stockAdjustment', name: 'Stock Adjustments' },
      { model: 'vendorReturnChallan', name: 'Vendor Returns' },
      { model: 'vendorReturnChallanItem', name: 'Vendor Return Items' },
      { model: 'assetInstallation', name: 'Asset Installations' },
      { model: 'user', name: 'Users' },
      { model: 'auditLog', name: 'Audit Logs' },
      { model: 'challanSequence', name: 'Challan Sequences' },
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mahaveerji Inventory';
    workbook.created = new Date();

    for (const table of tables) {
      try {
        const modelDelegate = (prisma as any)[table.model];
        if (!modelDelegate) continue;
        const data = await modelDelegate.findMany({ orderBy: { id: 'asc' } });
        if (!data || data.length === 0) continue;

        const worksheet = workbook.addWorksheet(table.name);
        const keys = Object.keys(data[0]).filter(k => {
          const val = data[0][k];
          return typeof val !== 'object' || val === null || val instanceof Date;
        });

        worksheet.columns = keys.map(k => ({ header: k, key: k, width: Math.max(k.length + 2, 14) }));
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };

        for (const row of data) {
          const flatRow: any = {};
          for (const k of keys) {
            const val = row[k];
            if (val instanceof Date) {
              flatRow[k] = `${String(val.getDate()).padStart(2, '0')}-${String(val.getMonth() + 1).padStart(2, '0')}-${val.getFullYear()}`;
            } else if (typeof val === 'bigint') {
              flatRow[k] = val.toString();
            } else {
              flatRow[k] = val;
            }
          }
          worksheet.addRow(flatRow);
        }

        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' }, left: { style: 'thin' },
              bottom: { style: 'thin' }, right: { style: 'thin' },
            };
          });
        });
      } catch (err) {
        // Skip tables that fail
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  });
}

  // ============================================================
  // ENHANCED BACKUP HANDLERS
  // ============================================================

  // Create manual versioned backup
  ipcMain.handle('backup:createManual', async (_event, label?: string) => {
    requireAuth();
    const service = getBackupService();
    return service.createManualBackup(label);
  });

  // Create pre-import backup
  ipcMain.handle('backup:createPreImport', async (_event, importType: string, rowCount: number) => {
    requireAuth();
    const service = getBackupService();
    return service.createPreImportBackup(importType, rowCount);
  });

  // Create pre-upgrade backup
  ipcMain.handle('backup:createPreUpgrade', async (_event, version: string) => {
    requireAuth();
    const service = getBackupService();
    return service.createPreUpgradeBackup(version);
  });

  // Create disaster recovery backup
  ipcMain.handle('backup:createDisasterRecovery', async () => {
    requireAuth();
    const service = getBackupService();
    return service.createDisasterRecoveryBackup();
  });

  // List versioned backups
  ipcMain.handle('backup:listVersioned', async (_event, type?: string) => {
    requireAuth();
    const service = getBackupService();
    return service.listVersionedBackups(type as any);
  });

  // Verify backup integrity
  ipcMain.handle('backup:verifyIntegrity', async (_event, backupId: string) => {
    requireAuth();
    const service = getBackupService();
    return service.verifyBackupIntegrity(backupId);
  });

  // Verify all backups
  ipcMain.handle('backup:verifyAll', async () => {
    requireAuth();
    const service = getBackupService();
    return service.verifyAllBackups();
  });

  // Disaster recovery restore
  ipcMain.handle('backup:disasterRecoveryRestore', async (_event, backupId: string) => {
    requireAuth();
    const service = getBackupService();
    return service.disasterRecoveryRestore(backupId);
  });

  // ============================================================
  // BULK OPERATIONS HANDLERS
  // ============================================================

  // Bulk Transfer
  ipcMain.handle('bulk:transfer', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkTransfer(input);
  });

  // Bulk Issue
  ipcMain.handle('bulk:issue', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkIssue(input);
  });

  // Bulk Return
  ipcMain.handle('bulk:return', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkReturn(input);
  });

  // Bulk Install
  ipcMain.handle('bulk:install', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkInstall(input);
  });

  // Bulk Uninstall
  ipcMain.handle('bulk:uninstall', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkUninstall(input);
  });

  // Bulk Damage
  ipcMain.handle('bulk:damage', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkDamage(input);
  });

  // Bulk Asset Assignment
  ipcMain.handle('bulk:assetAssignment', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkAssetAssignment(input);
  });

  // Bulk Approval
  ipcMain.handle('bulk:approval', async (_event, input: any) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.bulkApproval(input);
  });

  // Export bulk operation report
  ipcMain.handle('bulk:exportReport', async (_event, result: any, operationType: string) => {
    requireAuth();
    const service = getBulkOpsService();
    return service.exportBulkReport(result, operationType);
  });

  // ============================================================
  // PDF EXPORT FOR REPORTS
  // ============================================================

  // Generate PDF report from data
  ipcMain.handle('report:generatePdf', async (_event, data: { title: string; columns: Array<{ header: string; key: string }>; rows: any[]; fileName?: string }) => {
    requireAuth();
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const margin = 40;
    const lineHeight = 14;

    // Title
    page.drawText(data.title, {
      x: margin,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    y -= 30;

    // Date
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 25;

    // Column headers
    const colWidth = (595.28 - 2 * margin) / data.columns.length;
    let x = margin;
    for (const col of data.columns) {
      page.drawText(col.header, {
        x,
        y,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      x += colWidth;
    }
    y -= lineHeight;

    // Separator line
    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: 595.28 - margin, y: y + 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 5;

    // Data rows
    for (const row of data.rows) {
      if (y < 40) {
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        y = 800;
      }

      x = margin;
      for (const col of data.columns) {
        const val = String(row[col.key] ?? '');
        page.drawText(val.substring(0, 40), {
          x,
          y,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        x += colWidth;
      }
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = data.fileName || `report_${Date.now()}.pdf`;

    const saveResult = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: fileName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (!saveResult.canceled && saveResult.filePath) {
      fs.writeFileSync(saveResult.filePath, pdfBytes);
      return { success: true, path: saveResult.filePath };
    }
    return { success: false };
  });

  // Print report (generate PDF and open in default viewer)
  ipcMain.handle('report:print', async (_event, data: { title: string; columns: Array<{ header: string; key: string }>; rows: any[] }) => {
    requireAuth();
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const margin = 40;
    const lineHeight = 14;

    page.drawText(data.title, {
      x: margin, y, size: 16, font: boldFont, color: rgb(0, 0, 0),
    });
    y -= 30;

    page.drawText(`Printed: ${new Date().toLocaleString()}`, {
      x: margin, y, size: 10, font, color: rgb(0.5, 0.5, 0.5),
    });
    y -= 25;

    const colWidth = (595.28 - 2 * margin) / data.columns.length;
    let x = margin;
    for (const col of data.columns) {
      page.drawText(col.header, {
        x, y, size: 10, font: boldFont, color: rgb(1, 1, 1),
      });
      x += colWidth;
    }
    y -= lineHeight;

    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: 595.28 - margin, y: y + 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 5;

    for (const row of data.rows) {
      if (y < 40) {
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        y = 800;
      }

      x = margin;
      for (const col of data.columns) {
        const val = String(row[col.key] ?? '');
        page.drawText(val.substring(0, 40), {
          x, y, size: 9, font, color: rgb(0, 0, 0),
        });
        x += colWidth;
      }
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const tempPath = path.join(app.getPath('temp'), `report_${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, pdfBytes);

    // Open in default PDF viewer
    const { shell } = require('electron');
    shell.openPath(tempPath);

    return { success: true, path: tempPath };
  });

function drawHtmlToPage(page: any, html: string, width: number, height: number, font: any, boldFont: any) {
  const lines = html.split('\n');
  let y = height - 40;
  const lineHeight = 13;
  const margin = 40;

  for (const line of lines) {
    if (y < 40) break;
    const cleanLine = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!cleanLine) { y -= lineHeight / 2; continue; }

    const isBold = /<strong>|<b>/.test(line);
    const currentFont = isBold ? boldFont : font;
    const fontSize = isBold ? 10 : 9;

    try {
      page.drawText(cleanLine.substring(0, 100), {
        x: margin, y, size: fontSize, font: currentFont,
        color: (0, 0, 0) as any,
      });
    } catch {}
    y -= lineHeight;
  }
}

function buildChallanHtml(type: string, data: any, trustName: string, headerText: string): string {
  let html = `${trustName}\n${headerText}\n\n`;

  if (type === 'Receipt') {
    html += `RECEIPT CHALLAN (AAMAD)\n`;
    html += `========================================\n`;
    html += `Challan No: ${data.challanNo || ''}\n`;
    html += `Date: ${data.date || ''}\n`;
    html += `Received From: ${data.vendor?.name || data.sourceName || ''}\n`;
    html += `Invoice No: ${data.invoiceNumber || '-'}\n`;
    html += `Vehicle No: ${data.vehicleNumber || '-'}\n`;
    html += `Received By: ${data.receivedBy || ''}\n`;
    html += `Status: ${data.status || ''}\n`;
    html += `----------------------------------------\n`;
    html += `#  | Item Name | Qty | Unit | Rate | Amount\n`;
    html += `----------------------------------------\n`;
    data.items?.forEach((item: any, idx: number) => {
      html += `${idx + 1} | ${item.item?.itemName || ''} | ${item.quantity} | ${item.unit?.name || ''} | ₹${Number(item.rate).toFixed(2)} | ₹${Number(item.amount || item.quantity * item.rate).toFixed(2)}\n`;
    });
    html += `----------------------------------------\n`;
    const total = data.items?.reduce((sum: number, i: any) => sum + Number(i.amount || i.quantity * i.rate || 0), 0) || 0;
    html += `Total: ₹${total.toFixed(2)}\n`;
  } else if (type === 'Issue') {
    html += `ISSUE CHALLAN (KHARCH)\n`;
    html += `========================================\n`;
    html += `Challan No: ${data.challanNo || ''}\n`;
    html += `Date: ${data.date || ''}\n`;
    html += `Issue To: ${data.department?.name || ''}\n`;
    html += `Approved By: ${data.approvedBy || '-'}\n`;
    html += `Issued By: ${data.issuedBy || ''}\n`;
    html += `Purpose: ${data.purpose || '-'}\n`;
    html += `Status: ${data.status || ''}\n`;
    html += `----------------------------------------\n`;
    html += `#  | Item Name | Qty | Unit | Location | Purpose\n`;
    html += `----------------------------------------\n`;
    data.items?.forEach((item: any, idx: number) => {
      const loc = item.location ? `${item.location.locationType}-${item.location.locationName}` : item.usedAt || '-';
      html += `${idx + 1} | ${item.item?.itemName || ''} | ${item.quantity} | ${item.unit?.name || ''} | ${loc} | ${item.purpose || '-'}\n`;
    });
    html += `----------------------------------------\n`;
  } else if (type === 'Transfer') {
    html += `TRANSFER CHALLAN\n`;
    html += `========================================\n`;
    html += `Challan No: ${data.challanNo || ''}\n`;
    html += `Date: ${data.date || ''}\n`;
    html += `From: ${data.fromDepartment?.name || ''}\n`;
    html += `To: ${data.toDepartment?.name || ''}\n`;
    html += `Transferred By: ${data.transferredBy || ''}\n`;
    html += `----------------------------------------\n`;
    html += `#  | Item Name | Qty | Rate | Remarks\n`;
    html += `----------------------------------------\n`;
    data.items?.forEach((item: any, idx: number) => {
      html += `${idx + 1} | ${item.item?.itemName || ''} | ${item.quantity} | ₹${Number(item.rate).toFixed(2)} | ${item.remarks || '-'}\n`;
    });
    html += `----------------------------------------\n`;
  }

  if (data.remarks) html += `Remarks: ${data.remarks}\n`;
  html += `\n\n___________________          ___________________          ___________________\n`;
  html += `  Receiver Sign                 Store Incharge Sign          Authorized Sign`;

  return html;
}
