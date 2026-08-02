import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

export interface XpsTextRun {
  text: string;
  fontName: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontWeight: string;
  fontStyle: string;
}

export interface XpsPage {
  pageNumber: number;
  width: number;
  height: number;
  textRuns: XpsTextRun[];
}

export interface XpsTable {
  rows: string[][];
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface XpsDocument {
  pages: XpsPage[];
  tables: XpsTable[];
  fonts: string[];
  pageCount: number;
}

export interface ParseProgress {
  stage: 'extracting' | 'parsing' | 'analyzing' | 'complete';
  current: number;
  total: number;
  message: string;
}

/**
 * XPS Document Parser
 * Extracts text, tables, and structure from XPS files.
 * XPS = ZIP archive containing Fixed-Format XML pages.
 */
export class XpsParser {
  private zip: JSZip | null = null;

  async parseXps(buffer: Buffer, onProgress?: (p: ParseProgress) => void): Promise<XpsDocument> {
    onProgress?.({ stage: 'extracting', current: 0, total: 1, message: 'Opening XPS file...' });

    this.zip = await JSZip.loadAsync(buffer);

    onProgress?.({ stage: 'extracting', current: 1, total: 1, message: 'XPS archive extracted' });

    const pageFiles = this.findPageFiles();
    onProgress?.({ stage: 'parsing', current: 0, total: pageFiles.length, message: `Found ${pageFiles.length} pages` });

    const pages: XpsPage[] = [];
    const allFonts = new Set<string>();

    for (let i = 0; i < pageFiles.length; i++) {
      onProgress?.({ stage: 'parsing', current: i + 1, total: pageFiles.length, message: `Parsing page ${i + 1}/${pageFiles.length}` });

      const page = await this.parsePage(pageFiles[i], i + 1);
      if (page) {
        pages.push(page);
        page.textRuns.forEach((run) => allFonts.add(run.fontName));
      }
    }

    onProgress?.({ stage: 'analyzing', current: 0, total: 1, message: 'Analyzing tables and structure...' });

    const tables = this.detectTables(pages);

    onProgress?.({ stage: 'complete', current: 1, total: 1, message: 'Parse complete' });

    return {
      pages,
      tables,
      fonts: Array.from(allFonts),
      pageCount: pages.length,
    };
  }

  private findPageFiles(): string[] {
    if (!this.zip) return [];

    const pageFiles: string[] = [];
    this.zip.forEach((relativePath) => {
      // XPS pages are typically at: 1/Pages/1.fpage or similar
      if (relativePath.endsWith('.fpage') || relativePath.endsWith('.page')) {
        pageFiles.push(relativePath);
      }
    });

    // Sort by natural order
    pageFiles.sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/(\d+)/)?.[1] || '0');
      return numA - numB;
    });

    // If no .fpage found, try looking for XML files in Pages directories
    if (pageFiles.length === 0) {
      this.zip.forEach((relativePath) => {
        if (relativePath.includes('/Pages/') && relativePath.endsWith('.xml')) {
          pageFiles.push(relativePath);
        }
      });
    }

    return pageFiles;
  }

  private async parsePage(filePath: string, pageNumber: number): Promise<XpsPage | null> {
    if (!this.zip) return null;

    const file = this.zip.file(filePath);
    if (!file) return null;

    try {
      const xmlContent = await file.async('string');
      const result = await parseStringPromise(xmlContent, {
        explicitArray: false,
        mergeAttrs: true,
      });

      const page = result.FixedPage || result.Page || result.page;
      if (!page) return null;

      const pageWidth = parseFloat(page.Width) || 96 * 8.5;  // Default to letter size
      const pageHeight = parseFloat(page.Height) || 96 * 11;

      const textRuns: XpsTextRun[] = [];

      // Parse Glyphs elements (XPS text is stored as Glyphs, not raw text)
      const glyphs = this.extractGlyphs(page);
      for (const glyph of glyphs) {
        textRuns.push(glyph);
      }

      // Also parse any PathGeometry-based text (less common but exists)
      const pathTexts = this.extractPathTexts(page);
      textRuns.push(...pathTexts);

      return {
        pageNumber,
        width: pageWidth,
        height: pageHeight,
        textRuns,
      };
    } catch (error) {
      console.error(`Failed to parse page ${filePath}:`, error);
      return null;
    }
  }

  private extractGlyphs(node: any): XpsTextRun[] {
    const runs: XpsTextRun[] = [];

    if (node.Glyphs) {
      const glyphs = Array.isArray(node.Glyphs) ? node.Glyphs : [node.Glyphs];
      for (const glyph of glyphs) {
        const run = this.parseGlyph(glyph);
        if (run) runs.push(run);
      }
    }

    // Recurse into nested elements (Canvas, etc.)
    if (node.Canvas) {
      const canvases = Array.isArray(node.Canvas) ? node.Canvas : [node.Canvas];
      for (const canvas of canvases) {
        runs.push(...this.extractGlyphs(canvas));
      }
    }

    if (node.Path) {
      const paths = Array.isArray(node.Path) ? node.Path : [node.Path];
      for (const path of paths) {
        if (path.Glyphs) {
          runs.push(...this.extractGlyphs(path));
        }
      }
    }

    return runs;
  }

  private parseGlyph(glyph: any): XpsTextRun | null {
    const originX = parseFloat(glyph.OriginX) || 0;
    const originY = parseFloat(glyph.OriginY) || 0;
    const fontRenderingEmSize = parseFloat(glyph.FontRenderingEmSize) || 12;

    // Extract Unicode string from Indices attribute
    // XPS stores text as character indices mapped to glyph indices
    const indices = glyph.Indices || '';
    const unicodeString = glyph.UnicodeString || glyph.String || '';

    // If we have UnicodeString, use it directly
    let text = unicodeString;

    // If Indices contain character mappings, we need to decode
    if (indices && !text) {
      text = this.decodeIndices(indices);
    }

    if (!text) return null;

    // Parse style attributes
    const style = glyph.StyleSimulations || '';
    const fontWeight = style.includes('BoldSimulation') ? 'bold' : 'normal';
    const fontStyle = style.includes('ItalicSimulation') ? 'italic' : 'normal';

    // Extract font name from FontUri or FontFamily
    let fontName = glyph.FontUri || glyph.FontFamily || 'Unknown';
    // Clean up font name (remove URL prefix if present)
    fontName = fontName.replace(/^.*[\\/]/, '').replace(/\.ttf$/i, '').replace(/\.otf$/i, '');

    // Parse color from FillBrush
    let color = '#000000';
    if (glyph.FillBrush) {
      const brush = glyph.FillBrush;
      if (brush.SolidColorBrush) {
        color = brush.SolidColorBrush.Color || '#000000';
      } else if (typeof brush === 'string') {
        color = brush;
      }
    }

    return {
      text,
      fontName,
      fontSize: fontRenderingEmSize,
      x: originX,
      y: originY,
      width: text.length * fontRenderingEmSize * 0.6, // Approximate
      height: fontRenderingEmSize,
      color,
      fontWeight,
      fontStyle,
    };
  }

  private decodeIndices(indices: string): string {
    // XPS Indices format: "charCount,glyphIndex;charCount,glyphIndex;..."
    // This maps Unicode characters to glyph IDs in the font
    // For legacy fonts, this mapping is font-specific
    const parts = indices.split(';');
    let result = '';

    for (const part of parts) {
      const [charCount] = part.split(',');
      // We use UnicodeString if available, so this is a fallback
      const count = parseInt(charCount) || 1;
      result += '?'.repeat(count); // Placeholder
    }

    return result;
  }

  private extractPathTexts(node: any): XpsTextRun[] {
    // Some XPS files store text as Path elements with Geometries
    // This is less common but exists in some XPS generators
    const runs: XpsTextRun[] = [];

    // This is a simplified extraction - real implementation would need
    // to parse PathGeometry data which is complex
    if (node.Path) {
      const paths = Array.isArray(node.Path) ? node.Path : [node.Path];
      for (const path of paths) {
        if (path._ && typeof path._ === 'string') {
          // Some XPS parsers put text content directly
          runs.push({
            text: path._,
            fontName: 'Unknown',
            fontSize: 12,
            x: 0, y: 0, width: 0, height: 12,
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal',
          });
        }
      }
    }

    return runs;
  }

  private detectTables(pages: XpsPage[]): XpsTable[] {
    const tables: XpsTable[] = [];

    for (const page of pages) {
      // Detect table structure by grouping text runs into rows
      // Tables in XPS are typically aligned in grid patterns
      const sortedRuns = [...page.textRuns].sort((a, b) => {
        if (Math.abs(a.y - b.y) < 5) return a.x - b.x;  // Same row
        return a.y - b.y;  // Different rows
      });

      if (sortedRuns.length < 2) continue;

      // Group by Y coordinate (same row)
      const rows: XpsTextRun[][] = [];
      let currentRow: XpsTextRun[] = [sortedRuns[0]];

      for (let i = 1; i < sortedRuns.length; i++) {
        const run = sortedRuns[i];
        const lastInRow = currentRow[currentRow.length - 1];

        if (Math.abs(run.y - lastInRow.y) < 5) {
          currentRow.push(run);
        } else {
          if (currentRow.length >= 2) {
            rows.push([...currentRow]);  // At least 2 columns = potential table row
          }
          currentRow = [run];
        }
      }
      if (currentRow.length >= 2) {
        rows.push(currentRow);
      }

      // If we have 2+ rows with 2+ columns each, treat as table
      if (rows.length >= 2 && rows[0].length >= 2) {
        // Find the row with the most distinct horizontal segments (up to top 5 rows) 
        // to act as a template for column boundaries
        let templateRow = rows[0];
        for (let i = 1; i < Math.min(rows.length, 5); i++) {
          if (rows[i].length > templateRow.length) {
            templateRow = rows[i];
          }
        }

        const sortedTemplate = [...templateRow].sort((a, b) => a.x - b.x);
        
        // Compute column boundaries based on the template row
        const columnBounds = sortedTemplate.map((run, i) => {
           const startX = run.x - 20; // 20px left margin allowance
           const endX = i < sortedTemplate.length - 1 ? sortedTemplate[i+1].x - 10 : 9999;
           return { startX, endX };
        });

        // Map every row into the detected columns
        const tableRows = rows.map((row) => {
           const sortedRow = [...row].sort((a, b) => a.x - b.x);
           return columnBounds.map(bound => {
              const matchingRuns = sortedRow.filter(r => {
                 const centerX = r.x + (r.width / 2);
                 return centerX >= bound.startX && centerX < bound.endX;
              });
              return matchingRuns.map(r => r.text.trim()).join(' ').trim();
           });
        });

        const yValues = rows.map((r) => r[0].y);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);

        tables.push({
          rows: tableRows,
          boundingBox: {
            x: Math.min(...rows.flat().map((r) => r.x)),
            y: minY,
            width: Math.max(...rows.flat().map((r) => r.x + r.width)) - Math.min(...rows.flat().map((r) => r.x)),
            height: maxY - minY,
          },
        });
      }
    }

    return tables;
  }
}
