import { parentPort, workerData } from 'worker_threads';
import ExcelJS from 'exceljs';

interface WorkerTask {
  id: string;
  type: string;
  data: any;
}

async function handleTask(task: WorkerTask): Promise<any> {
  switch (task.type) {
    case 'exportExcel': {
      const { data, columns } = task.data;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');

      worksheet.columns = columns;
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      worksheet.getRow(1).alignment = { horizontal: 'center' };

      for (const row of data) {
        const addRowData: any = {};
        for (const col of columns) {
          addRowData[col.key] = row[col.key] ?? '';
        }
        worksheet.addRow(addRowData);
      }

      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      });

      worksheet.columns.forEach((column) => {
        let maxLen = 10;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const len = String(cell.value || '').length;
          if (len > maxLen) maxLen = len;
        });
        column.width = Math.min(maxLen + 2, 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    case 'exportStockReport': {
      const { reportData } = task.data;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Current Stock Report');

      worksheet.columns = reportData.columns;

      const titleRow = worksheet.addRow([reportData.title]);
      worksheet.mergeCells(titleRow.number, 1, titleRow.number, reportData.columns.length);
      titleRow.getCell(1).font = { bold: true, size: 14 };
      titleRow.getCell(1).alignment = { horizontal: 'center' };
      titleRow.getCell(1).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };

      const subtitleRow = worksheet.addRow([reportData.subTitle]);
      worksheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, reportData.columns.length);
      subtitleRow.getCell(1).font = { bold: true, size: 12 };
      subtitleRow.getCell(1).alignment = { horizontal: 'center' };
      subtitleRow.getCell(1).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };

      const headerRow = worksheet.addRow(reportData.columns.map((c: any) => c.header));
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      headerRow.alignment = { horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });

      for (const row of reportData.rows) {
        const addRowData = reportData.columns.map((c: any) => row[c.key] ?? '');
        const dataRow = worksheet.addRow(addRowData);
        dataRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
          const col = reportData.columns[colNumber - 1];
          if (col && ['rate', 'stockQty', 'totalIn', 'total', 'totalQty', 'balanceQty', 'sNo'].includes(col.key)) {
            cell.alignment = { horizontal: 'right' };
          }
        });
      }

      worksheet.columns.forEach((column: any) => {
        let maxLen = 10;
        column.eachCell({ includeEmpty: false }, (cell: any) => {
          const len = String(cell.value || '').length;
          if (len > maxLen) maxLen = len;
        });
        column.width = Math.min(maxLen + 2, 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    case 'exportKrutidevToExcel': {
      const { data } = task.data;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Mahaveerji Inventory - Kruti Dev Converter';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Stock Report');

      if (data.header) {
        const headerRow = ws.addRow([data.header]);
        headerRow.getCell(1).font = { name: 'Mangal', size: 14, bold: true };
        ws.mergeCells(headerRow.number, 1, headerRow.number, data.tableHeaders?.length || 6);
      }

      if (data.subHeader) {
        const subHeaderRow = ws.addRow([data.subHeader]);
        subHeaderRow.getCell(1).font = { name: 'Mangal', size: 12, bold: false };
        ws.mergeCells(subHeaderRow.number, 1, subHeaderRow.number, data.tableHeaders?.length || 6);
      }

      ws.addRow([]);

      if (data.tableHeaders && data.tableHeaders.length > 0) {
        const tableHeaderRow = ws.addRow(data.tableHeaders);
        tableHeaderRow.eachCell((cell: any) => {
          cell.font = { name: 'Mangal', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      }

      if (data.rows) {
        data.rows.forEach((row: string[], rowIdx: number) => {
          const dataRow = ws.addRow(row);
          dataRow.eachCell((cell: any, colNumber: number) => {
            cell.font = { name: 'Mangal', size: 10 };
            cell.border = {
              top: { style: 'thin' }, bottom: { style: 'thin' },
              left: { style: 'thin' }, right: { style: 'thin' },
            };
            if (colNumber === 3 || colNumber === 4 || colNumber === 6) {
              cell.alignment = { horizontal: 'right' };
            }
          });
          if (rowIdx % 2 === 0) {
            dataRow.eachCell((cell: any) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            });
          }
        });
      }

      ws.columns.forEach((column: any) => {
        column.width = Math.max(12, column.width || 12);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    case 'parseExcel': {
      const { buffer } = task.data;
      const workbook = new ExcelJS.Workbook();

      // Try to detect CSV vs Excel
      const buf = Buffer.from(buffer);
      const isCSV = buf[0] !== 0x50; // PNG/XLSX magic number check — 'P' = 0x50

      if (isCSV) {
        // Parse CSV manually
        const content = buf.toString('utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return { headers: [], rows: [] };

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
              else if (ch === '"') inQuotes = false;
              else current += ch;
            } else {
              if (ch === '"') inQuotes = true;
              else if (ch === ',') { result.push(current); current = ''; }
              else current += ch;
            }
          }
          result.push(current);
          return result.map(s => s.trim());
        };

        const headers = parseCSVLine(lines[0]);
        const rows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.every(v => v === '')) continue;
          const rowData: any = {};
          for (let col = 0; col < headers.length; col++) {
            rowData[headers[col]] = values[col] ?? '';
          }
          rows.push(rowData);
        }
        return { headers, rows };
      }

      // Excel parsing
      await workbook.xlsx.load(buf as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount === 0) return { headers: [], rows: [] };

      // Read headers from row 1
      const headerRow = worksheet.getRow(1);
      const maxCol = headerRow.cellCount || 11;
      const headers: string[] = [];
      for (let col = 1; col <= maxCol; col++) {
        const cell = headerRow.getCell(col);
        headers[col - 1] = String(cell.value || '').trim();
      }

      // Read data rows — iterate ALL columns even if empty
      const rows: any[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData: any = {};
        for (let col = 1; col <= maxCol; col++) {
          const header = headers[col - 1];
          if (!header) continue;
          const cell = row.getCell(col);
          const val = cell.value;
          if (val && typeof val === 'object' && 'text' in val) {
            rowData[header] = val.text;
          } else {
            rowData[header] = val ?? '';
          }
        }
        rows.push(rowData);
      });

      return { headers, rows };
    }

    case 'parsePdf': {
      const { buffer } = task.data;
      const pdfParse = (await import('pdf-parse')).default;
      const buf = Buffer.from(buffer);
      const data = await pdfParse(buf);
      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info,
      };
    }

    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
}

parentPort?.on('message', async (task: WorkerTask) => {
  try {
    const result = await handleTask(task);
    parentPort?.postMessage({ id: task.id, result });
  } catch (error: any) {
    parentPort?.postMessage({ id: task.id, error: error.message });
  }
});
