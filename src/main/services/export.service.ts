import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class ExportService {
  static getExportDir(): string {
    const dir = path.join(app.getPath('userData'), 'InventoryData', 'exports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  static async exportToExcel(
    data: any[],
    columns: Array<{ header: string; key: string; width?: number }>,
    filename: string
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    worksheet.getRow(1).alignment = { horizontal: 'center' };
    for (const row of data) worksheet.addRow(row);
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    for (let i = 1; i <= columns.length; i++) {
      worksheet.getColumn(i).width = columns[i - 1].width || 20;
    }
    const filePath = path.join(this.getExportDir(), `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  static async exportToCSV(data: any[], columns: Array<{ header: string; key: string }>, filename: string): Promise<string> {
    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const header = columns.map(c => escapeCSV(c.header)).join(',');
    const rows = data.map(row => columns.map(c => escapeCSV(row[c.key])).join(','));
    // UTF-8 BOM for proper Excel detection of Hindi/Devanagari characters
    const BOM = '\uFEFF';
    const csv = BOM + [header, ...rows].join('\r\n');
    const filePath = path.join(this.getExportDir(), `${filename}.csv`);
    fs.writeFileSync(filePath, csv, 'utf-8');
    return filePath;
  }

  static async exportToJSON(data: any[], filename: string): Promise<string> {
    const filePath = path.join(this.getExportDir(), `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  static getExportPath(filename: string, format: string): string {
    return path.join(this.getExportDir(), `${filename}.${format}`);
  }

  static listExports(): string[] {
    const dir = this.getExportDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv') || f.endsWith('.json'));
  }

  static deleteExport(filename: string): boolean {
    const filePath = path.join(this.getExportDir(), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
