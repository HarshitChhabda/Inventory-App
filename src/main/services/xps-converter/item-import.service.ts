import { XpsParser, XpsDocument, XpsPage, XpsTextRun } from './xps-parser';
import { FontConversionService, FontType } from './font-converter';
import { translateHindiToEnglish } from './translator';

export interface ImportedItem {
  itemCode: string;
  itemName: string;
  unitName: string;
  departmentName: string;
  categoryName: string;
  minimumStockLevel: number;
  rawText: string;
  rowNumber: number;
  confidence: 'high' | 'medium' | 'low';
  selected?: boolean;
}

export interface ImportResult {
  success: boolean;
  items: ImportedItem[];
  totalRows: number;
  skippedRows: number;
  departments: string[];
  categories: string[];
  units: string[];
  errors: string[];
}

// Hindi unit names mapping
const HINDI_UNITS: Record<string, string> = {
  'पीस': 'Piece', 'नग': 'Piece', 'प्लेट': 'Piece',
  'किलो': 'Kilogram', 'कि.ग्रा.': 'Kilogram', 'केजी': 'Kilogram',
  'ग्राम': 'Gram', 'ग्रा.': 'Gram',
  'लीटर': 'Liter', 'ली.': 'Liter',
  'मीटर': 'Meter', 'मी.': 'Meter',
  'सेट': 'Set',
  'जोड़ी': 'Pair',
  'दर्जन': 'Dozen',
  'बैग': 'Bag', 'बैल': 'Bag',
  'बोरी': 'Sack',
  'डिब्बा': 'Box', 'डब्बा': 'Box',
  'कार्टन': 'Carton',
  'रोल': 'Roll',
  'बैरल': 'Barrel',
  'सिलेंडर': 'Cylinder',
  'पैकेट': 'Packet', 'पैक': 'Pack',
  'बाल्टी': 'Bucket',
  'कैन': 'Can',
  'टिन': 'Tin',
  'फिट': 'Feet', 'फीट': 'Feet',
  'इंच': 'Inch',
  'यार्ड': 'Yard',
  'लिटर': 'Liter',
  'क्विंटल': 'Quintal',
  'मन': 'Maund',
  'टन': 'Ton',
};

// Department names that might appear in the XPS
const DEPT_KEYWORDS = ['विभाग', 'शाखा', 'डिपार्टमेंट', 'store', 'department'];

/**
 * Item Import Service
 * Parses XPS files containing department-wise item lists (in Kruti Dev/DevLys 010 font)
 * and extracts structured item data for bulk import.
 */
export class ItemImportService {
  private parser: XpsParser;
  private fontConverter: FontConversionService;

  constructor() {
    this.parser = new XpsParser();
    this.fontConverter = new FontConversionService();
  }

  /**
   * Parse XPS and extract items for import
   */
  async extractItems(buffer: Buffer): Promise<ImportResult> {
    try {
      // Parse XPS
      const doc = await this.parser.parseXps(buffer);

      // Convert any legacy fonts to Unicode
      const fontDetections = this.fontConverter.detectDocumentFonts(doc);
      const hasLegacy = fontDetections.some(
        (f) => f.detectedType !== 'unicode' && f.detectedType !== 'unknown'
      );

      let workingDoc = doc;
      if (hasLegacy) {
        const converted = this.fontConverter.convertDocument(doc);
        workingDoc = converted.convertedPages;
      }

      // Extract text rows from all pages
      const allRows = this.extractRows(workingDoc);

      // Detect column structure
      const columnMap = this.detectColumns(allRows);

      // Extract items from rows
      const items: ImportedItem[] = [];
      const errors: string[] = [];
      const departments = new Set<string>();
      const categories = new Set<string>();
      const units = new Set<string>();
      let skippedRows = 0;

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const rowText = row.map((r) => r.text).join(' | ');

        // Skip header rows
        if (this.isHeaderRow(row)) {
          skippedRows++;
          continue;
        }

        // Skip empty or too-short rows
        if (row.length < 2 || rowText.trim().length < 3) {
          skippedRows++;
          continue;
        }

        try {
          const item = this.parseRowToItem(row, columnMap, i + 1);
          if (item) {
            items.push(item);
            if (item.departmentName) departments.add(item.departmentName);
            if (item.categoryName) categories.add(item.categoryName);
            if (item.unitName) units.add(item.unitName);
          } else {
            skippedRows++;
          }
        } catch (e: any) {
          errors.push(`Row ${i + 1}: ${e.message}`);
          skippedRows++;
        }
      }

      return {
        success: true,
        items,
        totalRows: allRows.length,
        skippedRows,
        departments: Array.from(departments),
        categories: Array.from(categories),
        units: Array.from(units),
        errors,
      };
    } catch (error: any) {
      return {
        success: false,
        items: [],
        totalRows: 0,
        skippedRows: 0,
        departments: [],
        categories: [],
        units: [],
        errors: [error.message || String(error)],
      };
    }
  }

  /**
   * Extract text runs into rows (grouped by Y position)
   */
  private extractRows(doc: XpsDocument): XpsTextRun[][] {
    const allRuns: XpsTextRun[] = [];
    for (const page of doc.pages) {
      allRuns.push(...page.textRuns);
    }

    // Sort by Y then X
    allRuns.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
      return a.y - b.y;
    });

    if (allRuns.length === 0) return [];

    // Group into rows
    const rows: XpsTextRun[][] = [];
    let currentRow: XpsTextRun[] = [allRuns[0]];

    for (let i = 1; i < allRuns.length; i++) {
      const run = allRuns[i];
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

  /**
   * Detect column positions from header-like rows
   */
  private detectColumns(rows: XpsTextRun[][]): Map<string, number> {
    const columnMap = new Map<string, number>();

    // Look for rows that contain known Hindi column headers
    for (const row of rows) {
      for (let col = 0; col < row.length; col++) {
        const text = row[col].text.trim();
        if (text.includes('क्रम') || text.includes('Sr') || text.includes('#')) {
          columnMap.set('srNo', col);
        } else if (text.includes('विवरण') || text.includes('नाम') || text.includes('Description') || text.includes('Item') || text.includes('आइटम')) {
          columnMap.set('itemName', col);
        } else if (text.includes('इकाई') || text.includes('Unit') || text.includes('माप') || text.includes('मात्रा')) {
          columnMap.set('unit', col);
        } else if (text.includes('मात्रा') || text.includes('Qty') || text.includes('Quantity') || text.includes('प्युअल')) {
          columnMap.set('quantity', col);
        } else if (text.includes('विभाग') || text.includes('Dept') || text.includes('Department')) {
          columnMap.set('department', col);
        } else if (text.includes('श्रेणी') || text.includes('Category') || text.includes('वर्ग')) {
          columnMap.set('category', col);
        } else if (text.includes('दर') || text.includes('Rate')) {
          columnMap.set('rate', col);
        } else if (text.includes('कोड') || text.includes('Code')) {
          columnMap.set('itemCode', col);
        } else if (text.includes('राशि') || text.includes('Amount') || text.includes('कुल')) {
          columnMap.set('amount', col);
        }
      }
      if (columnMap.size >= 2) break;
    }

    // Fallback: use positional heuristic
    if (columnMap.size < 2) {
      columnMap.set('srNo', 0);
      if (rows.length > 0 && rows[0].length >= 3) {
        columnMap.set('itemName', rows[0].length > 2 ? 2 : 1);
        columnMap.set('unit', rows[0].length > 3 ? 3 : -1);
        columnMap.set('quantity', rows[0].length > 4 ? 4 : -1);
        columnMap.set('rate', rows[0].length > 5 ? 5 : -1);
        columnMap.set('amount', rows[0].length > 6 ? 6 : -1);
      }
    }

    return columnMap;
  }

  /**
   * Check if a row is a header row
   */
  private isHeaderRow(row: XpsTextRun[]): boolean {
    const rowText = row.map((r) => r.text.trim().toLowerCase()).join(' ');
    return rowText.includes('क्रम') || rowText.includes('विवरण') ||
      rowText.includes('sr.') || rowText.includes('s.no') ||
      rowText.includes('इकाई') || rowText.includes('दर') || rowText.includes('राशि');
  }

  /**
   * Parse a single row into an ImportedItem
   */
  private parseRowToItem(row: XpsTextRun[], columnMap: Map<string, number>, rowNumber: number): ImportedItem | null {
    const getCell = (key: string): string => {
      const col = columnMap.get(key);
      if (col === undefined || col < 0 || col >= row.length) return '';
      return row[col].text.trim();
    };

    // Try to extract item name
    let itemName = getCell('itemName');
    if (!itemName) {
      // Fallback: use the longest text in the row as item name
      const longest = row.reduce((a, b) => (a.text.length > b.text.length ? a : b));
      itemName = longest.text.trim();
    }

    if (!itemName || itemName.length < 2) return null;

    // Extract item code
    let itemCode = getCell('itemCode');
    if (!itemCode) {
      for (const run of row) {
        if (/^[A-Z]{2,4}-?\d{2,}/.test(run.text) || /^\d{3,}/.test(run.text)) {
          itemCode = run.text.trim();
          break;
        }
      }
    }

    if (!itemCode) {
      itemCode = `IMP-${String(rowNumber).padStart(4, '0')}`;
    }

    // Extract unit
    let unitName = getCell('unit');
    if (!unitName) {
      for (const run of row) {
        const detected = this.detectUnit(run.text);
        if (detected) {
          unitName = detected;
          break;
        }
      }
    }
    unitName = this.normalizeUnit(unitName);

    // Extract department
    let departmentName = getCell('department');

    // Extract category
    let categoryName = getCell('category');

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (columnMap.has('itemName') && columnMap.has('unit')) {
      confidence = 'high';
    } else if (itemName.length > 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      itemCode,
      itemName,
      unitName: unitName || 'Piece',
      departmentName: departmentName || '',
      categoryName: categoryName || '',
      minimumStockLevel: 0,
      rawText: row.map((r) => r.text).join(' | '),
      rowNumber,
      confidence,
    };
  }

  /**
   * Detect unit from text
   */
  private detectUnit(text: string): string | null {
    const lower = text.toLowerCase().trim();

    // Check Hindi units first
    for (const [hindi, english] of Object.entries(HINDI_UNITS)) {
      if (lower.includes(hindi.toLowerCase())) {
        return english;
      }
    }

    // Check common abbreviations
    if (lower.includes('kg') || lower.includes('k.g')) return 'Kilogram';
    if (lower.includes('gm') || lower.includes('g.m') || lower.includes('ग्राम')) return 'Gram';
    if (lower.includes('ltr') || lower.includes('lt') || lower.includes('लीटर')) return 'Liter';
    if (lower.includes('mtr') || lower.includes('mt') || lower.includes('मीटर')) return 'Meter';
    if (lower.includes('pcs') || lower.includes('pc') || lower.includes('पीस')) return 'Piece';
    if (lower.includes('set') || lower.includes('सेट')) return 'Set';
    if (lower.includes('bag') || lower.includes('बैग') || lower.includes('बैल')) return 'Bag';
    if (lower.includes('box') || lower.includes('डिब्बा') || lower.includes('डब्बा')) return 'Box';
    if (lower.includes('pack') || lower.includes('पैक')) return 'Pack';
    if (lower.includes('roll') || lower.includes('रोल')) return 'Roll';

    return null;
  }

  /**
   * Normalize unit name to standard form
   */
  private normalizeUnit(unit: string): string {
    if (!unit) return 'Piece';
    const lower = unit.toLowerCase().trim();

    for (const [hindi, english] of Object.entries(HINDI_UNITS)) {
      if (lower.includes(hindi.toLowerCase()) || lower === english.toLowerCase()) {
        return english;
      }
    }

    return unit || 'Piece';
  }

  /**
   * Bulk import items into database
   */
  async importItems(
    items: ImportedItem[],
    companyId: number,
    defaultCategoryId: number,
    defaultUnitId: number
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        // Check if item code already exists
        const existing = await (global as any).$prisma?.item?.findUnique({
          where: { itemCode: item.itemCode },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await (global as any).$prisma?.item?.create({
          data: {
            itemCode: item.itemCode,
            itemName: item.itemName,
            categoryId: defaultCategoryId,
            unitId: defaultUnitId,
            minimumStockLevel: item.minimumStockLevel || 0,
            isActive: true,
          },
        });

        imported++;
      } catch (e: any) {
        errors.push(`Item ${item.itemCode}: ${e.message}`);
      }
    }

    return { imported, skipped, errors };
  }
}

export const itemImportService = new ItemImportService();
