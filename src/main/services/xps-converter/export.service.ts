import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { XpsDocument, XpsPage, XpsTable, XpsTextRun } from './xps-parser';

export type ExportFormat = 'xlsx' | 'pdf' | 'docx';

export interface ExportOptions {
  format: ExportFormat;
  includeHindi: boolean;
  includeEnglish: boolean;
  bilingualMode: boolean;
  preserveLayout: boolean;
}

/**
 * Export Service
 * Exports converted XPS content to Excel, PDF, and DOCX formats.
 * Preserves table structure, merged cells, and document layout.
 */
export class ExportService {
  /**
   * Export document to Excel format
   */
  async exportToExcel(
    hindiDoc: XpsDocument,
    englishDoc: XpsDocument,
    options: ExportOptions,
    fileName: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mahaveerji Inventory - XPS Converter';
    workbook.created = new Date();

    if (options.bilingualMode) {
      await this.addBilingualSheet(workbook, hindiDoc, englishDoc);
    } else {
      if (options.includeHindi) {
        await this.addLanguageSheet(workbook, hindiDoc, 'Hindi (Unicode)');
      }
      if (options.includeEnglish) {
        await this.addLanguageSheet(workbook, englishDoc, 'English');
      }
    }

    // Add tables as separate sheets
    if (hindiDoc.tables.length > 0) {
      await this.addTableSheets(workbook, hindiDoc.tables, 'Hindi Tables');
    }
    if (englishDoc.tables.length > 0 && englishDoc !== hindiDoc) {
      await this.addTableSheets(workbook, englishDoc.tables, 'English Tables');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async addLanguageSheet(workbook: ExcelJS.Workbook, doc: XpsDocument, sheetName: string) {
    for (const page of doc.pages) {
      const sheet = workbook.addWorksheet(`${sheetName} - Page ${page.pageNumber}`);

      // Sort text runs by position
      const sortedRuns = [...page.textRuns].sort((a, b) => {
        if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
        return a.y - b.y;
      });

      // Detect spatial column boundaries from header text X positions
      const columnBounds = this.detectColumnsFromTextRuns(sortedRuns);

      // Group into rows
      const rows = this.groupIntoRows(sortedRuns);

      // Assign each row's runs to correct columns using spatial boundaries
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const excelRow = sheet.getRow(rowIdx + 1);

        if (columnBounds.length > 0) {
          // Use spatial column boundaries
          for (const run of row) {
            const colIdx = this.findColumnForRun(run, columnBounds);
            const cell = excelRow.getCell(colIdx + 1);
            cell.value = run.text;
            cell.font = {
              name: run.fontName,
              size: Math.min(run.fontSize, 12),
              bold: run.fontWeight === 'bold',
              italic: run.fontStyle === 'italic',
            };
          }
        } else {
          // Fallback: position-based assignment
          row.forEach((run: XpsTextRun, colIdx: number) => {
            const cell = excelRow.getCell(colIdx + 1);
            cell.value = run.text;
            cell.font = {
              name: run.fontName,
              size: Math.min(run.fontSize, 12),
              bold: run.fontWeight === 'bold',
              italic: run.fontStyle === 'italic',
            };
          });
        }
      }

      // Auto-fit columns
      sheet.columns.forEach((column) => {
        column.width = Math.max(15, (column as any).width || 15);
      });
    }
  }

  /**
   * Detect spatial column boundaries from text run X positions.
   * Uses header text X coordinates to establish column center positions and boundaries.
   */
  private detectColumnsFromTextRuns(runs: XpsTextRun[]): Array<{ center: number; leftBound: number; rightBound: number }> {
    // Find header-like runs: larger/bolder text, short, first 15% of page Y
    const maxY = runs.reduce((max, r) => Math.max(max, r.y), 0);
    const headerCandidates = runs.filter((r) => {
      const isLarge = r.fontSize > 11;
      const isBold = r.fontWeight === 'bold';
      const isTopRegion = maxY === 0 || r.y < maxY * 0.15;
      const isShort = r.text.length < 30;
      return isTopRegion && isShort && (isLarge || isBold);
    });

    if (headerCandidates.length < 2) return [];

    // Extract header X center points
    const headerCenters = headerCandidates.map((r) => ({
      center: r.x + (r.text.length * r.fontSize * 0.3),
      fontSize: r.fontSize,
    }));

    // Filter outliers (keep within median font size range)
    const fontSizes = headerCenters.map((h) => h.fontSize).sort((a, b) => a - b);
    const medianFont = fontSizes[Math.floor(fontSizes.length / 2)];
    const filteredCenters = headerCenters
      .filter((h) => Math.abs(h.fontSize - medianFont) <= 2)
      .map((h) => h.center)
      .sort((a, b) => a - b);

    if (filteredCenters.length < 2) return [];

    // Calculate boundaries between consecutive columns
    const bounds: Array<{ center: number; leftBound: number; rightBound: number }> = [];
    for (let i = 0; i < filteredCenters.length; i++) {
      const leftBound = i === 0 ? 0 : (filteredCenters[i - 1] + filteredCenters[i]) / 2;
      const rightBound = i === filteredCenters.length - 1 ? Infinity : (filteredCenters[i] + filteredCenters[i + 1]) / 2;
      bounds.push({
        center: filteredCenters[i],
        leftBound,
        rightBound,
      });
    }

    return bounds;
  }

  /**
   * Find the correct column index for a text run based on spatial column boundaries.
   */
  private findColumnForRun(run: XpsTextRun, bounds: Array<{ center: number; leftBound: number; rightBound: number }>): number {
    const centerX = run.x + (run.text.length * run.fontSize * 0.3);

    for (let i = 0; i < bounds.length; i++) {
      if (centerX >= bounds[i].leftBound && centerX < bounds[i].rightBound) {
        return i;
      }
    }

    // Fallback: find nearest column center
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < bounds.length; i++) {
      const dist = Math.abs(centerX - bounds[i].center);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  }

  private async addBilingualSheet(
    workbook: ExcelJS.Workbook,
    hindiDoc: XpsDocument,
    englishDoc: XpsDocument
  ) {
    const sheet = workbook.addWorksheet('Bilingual View');

    // Add headers
    const headerRow = sheet.getRow(1);
    headerRow.getCell(1).value = 'Hindi (Unicode)';
    headerRow.getCell(2).value = 'English Translation';
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };

    // Collect all text from both documents
    const hindiTexts = this.extractAllText(hindiDoc);
    const englishTexts = this.extractAllText(englishDoc);

    const maxRows = Math.max(hindiTexts.length, englishTexts.length);
    for (let i = 0; i < maxRows; i++) {
      const row = sheet.getRow(i + 2);
      row.getCell(1).value = hindiTexts[i] || '';
      row.getCell(2).value = englishTexts[i] || '';

      // Alternate row colors
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    }

    sheet.getColumn(1).width = 50;
    sheet.getColumn(2).width = 50;
  }

  private async addTableSheets(workbook: ExcelJS.Workbook, tables: XpsTable[], sheetName: string) {
    tables.forEach((table, idx) => {
      const sheet = workbook.addWorksheet(`${sheetName} ${idx + 1}`);

      table.rows.forEach((row, rowIdx) => {
        const excelRow = sheet.getRow(rowIdx + 1);
        row.forEach((cellValue, colIdx) => {
          excelRow.getCell(colIdx + 1).value = cellValue;
        });
      });

      // Style header row
      if (table.rows.length > 0) {
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
      }

      sheet.columns.forEach((column) => {
        column.width = Math.max(12, (column as any).width || 12);
      });
    });
  }

  /**
   * Export document to PDF format
   */
  async exportToPdf(
    hindiDoc: XpsDocument,
    englishDoc: XpsDocument,
    options: ExportOptions,
    fileName: string
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const hindiFont = await pdfDoc.embedFont(StandardFonts.Helvetica); // PDF doesn't support Devanagari natively

    const pages = options.bilingualMode
      ? this.mergePagesForBilingual(hindiDoc, englishDoc)
      : options.includeHindi ? hindiDoc.pages : englishDoc.pages;

    for (const pageData of pages) {
      const page = pdfDoc.addPage([612, 792]); // Letter size

      const sortedRuns = [...pageData.textRuns].sort((a, b) => {
        if (Math.abs(a.y - pageData.height - a.y) < 5) return a.x - b.x;
        return a.y - b.y;
      });

      // XPS uses top-left origin, PDF uses bottom-left
      for (const run of sortedRuns) {
        const pdfY = pageData.height - run.y;

        try {
          page.drawText(run.text, {
            x: run.x * 0.75,  // Scale down from XPS units (96 DPI) to PDF points (72 DPI)
            y: pdfY * 0.75,
            size: Math.min(run.fontSize, 12),
            font,
            color: this.parseColor(run.color),
          });
        } catch {
          // Skip text that can't be rendered (e.g., Hindi in standard font)
          // In production, use a Hindi-capable font like Noto Sans Devanagari
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Export document to DOCX-compatible format (using PDF as intermediate)
   * For full DOCX support, use a dedicated docx library
   */
  async exportToDocx(
    hindiDoc: XpsDocument,
    englishDoc: XpsDocument,
    options: ExportOptions,
    fileName: string
  ): Promise<Buffer> {
    // For DOCX export, we create an HTML file that can be opened in Word
    // This preserves structure better than plain text
    const html = this.generateDocxHtml(hindiDoc, englishDoc, options);
    return Buffer.from(html, 'utf-8');
  }

  private generateDocxHtml(
    hindiDoc: XpsDocument,
    englishDoc: XpsDocument,
    options: ExportOptions
  ): string {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>XPS Conversion Export</title>
  <style>
    body { font-family: 'Mangal', 'Nirmala UI', sans-serif; margin: 20px; }
    h1 { color: #1565C0; border-bottom: 2px solid #1565C0; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #E3F2FD; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .page-break { page-break-after: always; }
    .hindi-text { font-family: 'Mangal', 'Nirmala UI'; }
    .english-text { font-family: 'Calibri', 'Arial'; }
  </style>
</head>
<body>
  <h1>XPS Document Conversion</h1>
  <p>Generated on: ${new Date().toLocaleDateString('en-IN')}</p>
`;

    const docToUse = options.includeHindi ? hindiDoc : englishDoc;

    for (const page of docToUse.pages) {
      html += `<h2>Page ${page.pageNumber}</h2>\n`;

      if (options.bilingualMode) {
        html += this.generateBilingualTableHtml(page, hindiDoc, englishDoc);
      } else {
        html += this.generatePageHtml(page);
      }

      html += '<div class="page-break"></div>\n';
    }

    // Add tables
    if (hindiDoc.tables.length > 0) {
      html += '<h2>Detected Tables</h2>\n';
      for (const table of hindiDoc.tables) {
        html += this.generateTableHtml(table);
      }
    }

    html += '</body></html>';
    return html;
  }

  private generatePageHtml(page: XpsPage): string {
    const sortedRuns = [...page.textRuns].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
      return a.y - b.y;
    });

    const rows = this.groupIntoRows(sortedRuns);
    let html = '<table>\n';

    rows.forEach((row, idx) => {
      html += '<tr>';
      if (idx === 0) {
        html += '<th>Content</th>';
      }
      row.forEach((run) => {
        const className = /[\u0900-\u097F]/.test(run.text) ? 'hindi-text' : 'english-text';
        html += `<td class="${className}">${this.escapeHtml(run.text)}</td>`;
      });
      html += '</tr>\n';
    });

    html += '</table>\n';
    return html;
  }

  private generateBilingualTableHtml(
    page: XpsPage,
    hindiDoc: XpsDocument,
    englishDoc: XpsDocument
  ): string {
    const hindiPage = hindiDoc.pages.find((p) => p.pageNumber === page.pageNumber);
    const englishPage = englishDoc.pages.find((p) => p.pageNumber === page.pageNumber);

    if (!hindiPage || !englishPage) return '';

    const hindiRows = this.groupIntoRows([...hindiPage.textRuns].sort((a, b) => a.y - b.y || a.x - b.x));
    const englishRows = this.groupIntoRows([...englishPage.textRuns].sort((a, b) => a.y - b.y || a.x - b.x));

    let html = '<table>\n<tr><th>Hindi (Unicode)</th><th>English</th></tr>\n';

    const maxRows = Math.max(hindiRows.length, englishRows.length);
    for (let i = 0; i < maxRows; i++) {
      html += '<tr>';
      html += `<td class="hindi-text">${hindiRows[i]?.map((r) => this.escapeHtml(r.text)).join(' ') || ''}</td>`;
      html += `<td class="english-text">${englishRows[i]?.map((r) => this.escapeHtml(r.text)).join(' ') || ''}</td>`;
      html += '</tr>\n';
    }

    html += '</table>\n';
    return html;
  }

  private generateTableHtml(table: XpsTable): string {
    let html = '<table>\n';
    table.rows.forEach((row, idx) => {
      html += '<tr>';
      const tag = idx === 0 ? 'th' : 'td';
      row.forEach((cell) => {
        html += `<${tag}>${this.escapeHtml(cell)}</${tag}>`;
      });
      html += '</tr>\n';
    });
    html += '</table>\n';
    return html;
  }

  private extractAllText(doc: XpsDocument): string[] {
    const texts: string[] = [];
    for (const page of doc.pages) {
      const sorted = [...page.textRuns].sort((a, b) => a.y - b.y || a.x - b.x);
      const rows = this.groupIntoRows(sorted);
      for (const row of rows) {
        texts.push(row.map((r) => r.text).join(' '));
      }
    }
    return texts;
  }

  private groupIntoRows(runs: XpsTextRun[]): XpsTextRun[][] {
    if (runs.length === 0) return [];

    const rows: XpsTextRun[][] = [];
    let currentRow: XpsTextRun[] = [runs[0]];

    for (let i = 1; i < runs.length; i++) {
      const run = runs[i];
      const lastInRow = currentRow[currentRow.length - 1];

      if (Math.abs(run.y - lastInRow.y) < 5) {
        currentRow.push(run);
      } else {
        rows.push(currentRow);
        currentRow = [run];
      }
    }
    rows.push(currentRow);
    return rows;
  }

  private mergePagesForBilingual(hindiDoc: XpsDocument, englishDoc: XpsDocument): XpsPage[] {
    const maxPages = Math.max(hindiDoc.pages.length, englishDoc.pages.length);
    const merged: XpsPage[] = [];

    for (let i = 0; i < maxPages; i++) {
      const hindiPage = hindiDoc.pages[i];
      const englishPage = englishDoc.pages[i];

      merged.push({
        pageNumber: i + 1,
        width: hindiPage?.width || englishPage?.width || 612,
        height: hindiPage?.height || englishPage?.height || 792,
        textRuns: [
          ...(hindiPage?.textRuns || []),
          ...(englishPage?.textRuns || []).map((r) => ({ ...r, x: r.x + 300 })), // Offset English to right
        ],
      });
    }

    return merged;
  }

  private parseColor(color: string): ReturnType<typeof rgb> {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
