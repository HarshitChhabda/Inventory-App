import { XpsParser, XpsDocument, XpsTextRun, ParseProgress } from './xps-parser';
import { FontConversionService, FontDetectionResult, FontType } from './font-converter';
import { translateDocument, translateHindiToEnglish } from './translator';
import { ExportService, ExportFormat, ExportOptions } from './export.service';

export interface ConversionProgress {
  stage: 'parsing' | 'detecting' | 'converting' | 'translating' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

export interface ConversionResult {
  success: boolean;
  originalDoc: XpsDocument;
  hindiDoc: XpsDocument;
  englishDoc: XpsDocument;
  fontDetections: FontDetectionResult[];
  conversionCount: number;
  translationCount: number;
  error?: string;
}

/**
 * XPS Converter Service
 * Orchestrates the full XPS → Hindi Unicode → English conversion pipeline.
 */
export class XpsConverterService {
  private parser: XpsParser;
  private fontConverter: FontConversionService;
  private exportService: ExportService;

  constructor() {
    this.parser = new XpsParser();
    this.fontConverter = new FontConversionService();
    this.exportService = new ExportService();
  }

  /**
   * Full conversion pipeline: XPS → Parse → Detect Font → Convert → Translate
   */
  async convert(
    buffer: Buffer,
    onProgress?: (p: ConversionProgress) => void
  ): Promise<ConversionResult> {
    try {
      // Step 1: Parse XPS
      onProgress?.({ stage: 'parsing', current: 0, total: 4, message: 'Parsing XPS document...' });

      const originalDoc = await this.parser.parseXps(buffer, (p: ParseProgress) => {
        const mappedStage = p.stage === 'extracting' || p.stage === 'parsing' ? 'parsing' : 'detecting';
        onProgress?.({
          stage: mappedStage,
          current: p.current,
          total: p.total,
          message: p.message,
        });
      });

      // Step 2: Detect fonts
      onProgress?.({ stage: 'detecting', current: 1, total: 4, message: 'Detecting font types...' });
      const fontDetections = this.fontConverter.detectDocumentFonts(originalDoc);
      const legacyFonts = fontDetections.filter((f) => f.detectedType !== 'unicode' && f.detectedType !== 'unknown');

      // Step 3: Convert legacy fonts to Unicode Hindi
      onProgress?.({ stage: 'converting', current: 2, total: 4, message: 'Converting to Unicode Hindi...' });

      let hindiDocRaw: XpsDocument;
      let conversionCount = 0;

      if (legacyFonts.length > 0) {
        const converted = this.fontConverter.convertDocument(originalDoc);
        hindiDocRaw = converted.convertedPages;
        conversionCount = converted.conversions.length;
      } else {
        // No legacy fonts detected, use original text
        hindiDocRaw = { ...originalDoc };
      }

      // Step 4: Group text runs into spatial rows (same as item-import improvements)
      onProgress?.({ stage: 'converting', current: 2, total: 4, message: 'Grouping text by spatial columns...' });

      const hindiDoc = this.groupTextRunsSpatially(hindiDocRaw);

      // Step 5: Translate to English
      onProgress?.({ stage: 'translating', current: 3, total: 4, message: 'Translating to English...' });

      const englishDoc = translateDocument(hindiDoc);
      const translationCount = this.countTranslations(hindiDoc, englishDoc);

      onProgress?.({ stage: 'complete', current: 4, total: 4, message: 'Conversion complete!' });

      return {
        success: true,
        originalDoc,
        hindiDoc,
        englishDoc,
        fontDetections,
        conversionCount,
        translationCount,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onProgress?.({ stage: 'error', current: 0, total: 1, message: `Error: ${msg}` });
      return {
        success: false,
        originalDoc: { pages: [], tables: [], fonts: [], pageCount: 0 },
        hindiDoc: { pages: [], tables: [], fonts: [], pageCount: 0 },
        englishDoc: { pages: [], tables: [], fonts: [], pageCount: 0 },
        fontDetections: [],
        conversionCount: 0,
        translationCount: 0,
        error: msg,
      };
    }
  }

  /**
   * Export converted documents to specified format
   */
  async export(
    result: ConversionResult,
    format: ExportFormat,
    options: ExportOptions,
    fileName: string
  ): Promise<Buffer> {
    switch (format) {
      case 'xlsx':
        return this.exportService.exportToExcel(result.hindiDoc, result.englishDoc, options, fileName);
      case 'pdf':
        return this.exportService.exportToPdf(result.hindiDoc, result.englishDoc, options, fileName);
      case 'docx':
        return this.exportService.exportToDocx(result.hindiDoc, result.englishDoc, options, fileName);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get text preview for a specific page
   */
  getPagePreview(doc: XpsDocument, pageNumber: number): { text: string; textRuns: number; hasHindi: boolean } {
    const page = doc.pages.find((p) => p.pageNumber === pageNumber);
    if (!page) return { text: '', textRuns: 0, hasHindi: false };

    const sortedRuns = [...page.textRuns].sort((a, b) => a.y - b.y || a.x - b.x);
    const text = sortedRuns.map((r) => r.text).join(' ');
    const hasHindi = /[\u0900-\u097F]/.test(text);

    return { text, textRuns: page.textRuns.length, hasHindi };
  }

  /**
   * Convert pasted text from legacy font encoding to Unicode Hindi
   * Rules:
   * 1. Detect Kruti Dev encoded text
   * 2. Convert all characters using Kruti Dev 010 mapping
   * 3. Preserve numbers, tables and formatting
   * 4. Return pure Unicode Hindi text
   * 5. Do not translate, only convert encoding
   */
  convertText(
    text: string,
    fontType: 'krutidev' | 'devlys' | 'auto' = 'auto'
  ): { hindi: string; english: string; detectedFont: string; conversionCount: number } {
    if (!text || text.length === 0) {
      return { hindi: '', english: '', detectedFont: 'none', conversionCount: 0 };
    }

    let finalFontType: FontType;
    if (fontType === 'auto') {
      finalFontType = this.fontConverter.detectFromText(text);
    } else {
      finalFontType = fontType;
    }

    if (finalFontType === 'unknown' || finalFontType === 'unicode') {
      const english = translateHindiToEnglish(text);
      return { hindi: text, english, detectedFont: 'unicode', conversionCount: 0 };
    }

    const hindi = this.fontConverter.convertText(text, finalFontType);
    const conversionCount = hindi !== text ? 1 : 0;
    const english = translateHindiToEnglish(hindi);

    return { hindi, english, detectedFont: finalFontType, conversionCount };
  }

  private countTranslations(original: XpsDocument, translated: XpsDocument): number {
    let count = 0;
    const origTexts = original.pages.flatMap((p) => p.textRuns.map((r) => r.text));
    const transTexts = translated.pages.flatMap((p) => p.textRuns.map((r) => r.text));

    for (let i = 0; i < origTexts.length; i++) {
      if (origTexts[i] !== transTexts[i]) count++;
    }
    return count;
  }

  /**
   * Group text runs spatially by detecting column boundaries from header text X positions.
   * Same logic as item-import.service.ts spatial column detection.
   */
  private groupTextRunsSpatially(doc: XpsDocument): XpsDocument {
    return {
      ...doc,
      pages: doc.pages.map((page) => {
        const sorted = [...page.textRuns].sort((a, b) => {
          if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
          return a.y - b.y;
        });

        // Detect column boundaries from header text X positions
        const columnBounds = this.detectColumnsFromRuns(sorted);
        if (columnBounds.length === 0) return { ...page, textRuns: sorted };

        // Group into rows by Y proximity
        const rows: XpsTextRun[][] = [];
        let currentRow: XpsTextRun[] = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
          const run = sorted[i];
          const lastInRow = currentRow[currentRow.length - 1];
          if (Math.abs(run.y - lastInRow.y) < 5) {
            currentRow.push(run);
          } else {
            rows.push(currentRow);
            currentRow = [run];
          }
        }
        rows.push(currentRow);

        // Rebuild text runs in column-sorted order (row by row, left-to-right within each row)
        const spatialRuns: XpsTextRun[] = [];
        for (const row of rows) {
          const sortedRow = [...row].sort((a, b) => {
            const colA = this.findColumnForRun(a, columnBounds);
            const colB = this.findColumnForRun(b, columnBounds);
            if (colA !== colB) return colA - colB;
            return a.x - b.x;
          });
          spatialRuns.push(...sortedRow);
        }

        return { ...page, textRuns: spatialRuns };
      }),
    };
  }

  /**
   * Detect spatial column boundaries from text run X positions.
   */
  private detectColumnsFromRuns(runs: XpsTextRun[]): Array<{ center: number; leftBound: number; rightBound: number }> {
    const maxY = runs.reduce((max, r) => Math.max(max, r.y), 0);
    const headerCandidates = runs.filter((r) => {
      const isLarge = r.fontSize > 11;
      const isBold = r.fontWeight === 'bold';
      const isTopRegion = maxY === 0 || r.y < maxY * 0.15;
      const isShort = r.text.length < 30;
      return isTopRegion && isShort && (isLarge || isBold);
    });

    if (headerCandidates.length < 2) return [];

    const headerCenters = headerCandidates.map((r) => ({
      center: r.x + (r.text.length * r.fontSize * 0.3),
      fontSize: r.fontSize,
    }));

    const fontSizes = headerCenters.map((h) => h.fontSize).sort((a, b) => a - b);
    const medianFont = fontSizes[Math.floor(fontSizes.length / 2)];
    const filteredCenters = headerCenters
      .filter((h) => Math.abs(h.fontSize - medianFont) <= 2)
      .map((h) => h.center)
      .sort((a, b) => a - b);

    if (filteredCenters.length < 2) return [];

    const bounds: Array<{ center: number; leftBound: number; rightBound: number }> = [];
    for (let i = 0; i < filteredCenters.length; i++) {
      const leftBound = i === 0 ? 0 : (filteredCenters[i - 1] + filteredCenters[i]) / 2;
      const rightBound = i === filteredCenters.length - 1 ? Infinity : (filteredCenters[i] + filteredCenters[i + 1]) / 2;
      bounds.push({ center: filteredCenters[i], leftBound, rightBound });
    }

    return bounds;
  }

  private findColumnForRun(run: XpsTextRun, bounds: Array<{ center: number; leftBound: number; rightBound: number }>): number {
    const centerX = run.x + (run.text.length * run.fontSize * 0.3);
    for (let i = 0; i < bounds.length; i++) {
      if (centerX >= bounds[i].leftBound && centerX < bounds[i].rightBound) return i;
    }
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < bounds.length; i++) {
      const dist = Math.abs(centerX - bounds[i].center);
      if (dist < minDist) { minDist = dist; nearestIdx = i; }
    }
    return nearestIdx;
  }
}

// Export singleton
export const xpsConverter = new XpsConverterService();
