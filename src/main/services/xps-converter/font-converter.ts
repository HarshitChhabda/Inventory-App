import {
  KRUTIDEV_MAP,
  LEGACY_FONT_NAMES,
  DEVANAGARI_RANGE,
} from './font-mapping';
import { XpsTextRun, XpsDocument } from './xps-parser';

export type FontType = 'devlys' | 'krutidev' | 'preeti' | 'walkman' | 'unicode' | 'unknown';

export interface FontDetectionResult {
  fontName: string;
  detectedType: FontType;
  confidence: number;
}

export interface ConversionResult {
  originalText: string;
  convertedText: string;
  fontType: FontType;
  fontName: string;
}

/**
 * Font Conversion Service
 * Detects legacy Hindi fonts and converts them to Unicode Hindi.
 */
export class FontConversionService {
  constructor() {}

  /**
   * Detect the font type from a font name
   */
  detectFontType(fontName: string): FontDetectionResult {
    const lower = fontName.toLowerCase().trim();

    for (const [type, names] of Object.entries(LEGACY_FONT_NAMES)) {
      for (const name of names) {
        if (lower.includes(name)) {
          return {
            fontName,
            detectedType: type as FontType,
            confidence: 0.95,
          };
        }
      }
    }

    // Check for Unicode Devanagari fonts
    if (lower.includes('mangal') || lower.includes('nirmala') || lower.includes('kokila') ||
        lower.includes('aparajita') || lower.includes('utsaah') || lower.includes('droid sans devanagari')) {
      return { fontName, detectedType: 'unicode', confidence: 0.95 };
    }

    // Heuristic: if the font name contains "dev" or "hindi", it's likely a legacy font
    if (lower.includes('dev') || lower.includes('hindi') || lower.includes('kruti')) {
      return { fontName, detectedType: 'devlys', confidence: 0.6 };
    }

    return { fontName, detectedType: 'unknown', confidence: 0.1 };
  }

  /**
   * Detect if text is Kruti Dev encoded (not Unicode)
   * Uses multiple heuristics for accurate detection
   */
  isKrutiDevEncoded(text: string): boolean {
    if (!text || text.length === 0) return false;

    // If text already contains Devanagari characters, it's likely Unicode
    if (DEVANAGARI_RANGE.test(text)) {
      const devanagariChars = text.match(DEVANAGARI_RANGE) || [];
      if (devanagariChars.length > text.length * 0.3) {
        return false; // Already Unicode
      }
    }

    // Since Kruti Dev maps standard ASCII chars to Hindi, high ASCII concentration in what should be a Hindi text indicates Kruti Dev
    let asciiScore = 0;
    for (const char of text) {
      const code = char.charCodeAt(0);
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || char === '[' || char === ']' || char === '{' || char === '}' || char === '~' || char === '`') {
        asciiScore++;
      }
    }

    return asciiScore / text.length > 0.4;
  }

  /**
   * Detect font type from text content analysis
   */
  detectFromText(text: string): FontType {
    if (!text || text.length === 0) return 'unknown';

    // If already Unicode Hindi
    if (DEVANAGARI_RANGE.test(text)) {
      const devanagariChars = text.match(DEVANAGARI_RANGE) || [];
      if (devanagariChars.length > text.length * 0.3) {
        return 'unicode';
      }
    }

    // Check for Kruti Dev patterns
    if (this.isKrutiDevEncoded(text)) {
      return 'krutidev';
    }

    return 'unknown';
  }

  /**
   * Convert a single text string from Kruti Dev 010 encoding to Unicode Hindi
   *
   * Algorithm:
   * 1. Check if text is already Unicode - return as-is
   * 2. Check if text is Kruti Dev encoded
   * 3. Process character by character:
   *    a. Check for two-character matra combinations first (halant + char = matra)
   *    b. Check for single character mapping
   *    c. Keep unmapped characters as-is
   * 4. Post-process to fix matra placement and conjuncts
   */
  convertText(text: string, fontType: FontType): string {
    if (!text || text.length === 0) return text;
    if (fontType === 'unicode') return text;
    if (fontType === 'unknown') return text;

    // If text already contains Devanagari, it might be partially converted
    if (DEVANAGARI_RANGE.test(text)) {
      const devanagariChars = text.match(DEVANAGARI_RANGE) || [];
      if (devanagariChars.length > text.length * 0.5) {
        return text; // Already mostly Unicode
      }
    }

    // Convert based on font type
    switch (fontType) {
      case 'krutidev':
        return this.convertKrutiDevToUnicode(text);
      case 'devlys':
        return this.convertDevLysToUnicode(text);
      default:
        return text;
    }
  }

  /**
   * Convert Kruti Dev 010 / DevLys encoded text to Unicode Hindi
   */
  private convertKrutiDevToUnicode(text: string): string {
    let result = text;
    
    // 1. Initial array replacements
    for (const [krutiChar, unicodeChar] of KRUTIDEV_MAP) {
      result = result.split(krutiChar).join(unicodeChar);
    }
    
    // Merge split matras before shifting
    result = result.replace(/ाे/g, 'ो');
    result = result.replace(/ाै/g, 'ौ');

    // 2. Post-process Choti Ee Matra (ि)
    // In KrutiDev, the matra is placed before the consonant it applies to.
    // Unicode requires "ि" to be placed after the consonant.
    // Example: ि + क = कि
    let positionOfI = result.indexOf('ि');
    while (positionOfI !== -1) {
      let charNext = result.charAt(positionOfI + 1);
      let shiftLength = 1;

      // Handle half characters (consonant + halant)
      if (charNext && positionOfI + 2 < result.length && result.charAt(positionOfI + 2) === '्') {
        shiftLength = 3; // Shift past consonant + halant + next consonant
      }

      if (positionOfI + shiftLength < result.length) {
        const stringToMove = result.substring(positionOfI + 1, positionOfI + 1 + shiftLength);
        result = result.substring(0, positionOfI) + stringToMove + 'ि' + result.substring(positionOfI + 1 + shiftLength);
        positionOfI = result.indexOf('ि', positionOfI + shiftLength + 1);
      } else {
        break; // can't move further right
      }
    }

    return this.postProcessDevanagari(result);
  }

  /**
   * Convert DevLys 010 encoded text to Unicode Hindi
   * DevLys uses the same basic mapping as Kruti Dev
   */
  private convertDevLysToUnicode(text: string): string {
    return this.convertKrutiDevToUnicode(text);
  }

  /**
   * Post-process converted text to fix matra placement and conjuncts
   */
  private postProcessDevanagari(text: string): string {
    let result = text;

    // Remove duplicate halants
    result = result.replace(/\u094D{2,}/g, '\u094D');

    // Remove trailing halants
    result = result.replace(/\u094D$/g, '');

    return result;
  }

  /**
   * Convert an entire document's text runs
   */
  convertDocument(doc: XpsDocument): {
    convertedPages: XpsDocument;
    conversions: ConversionResult[];
    fontDetections: FontDetectionResult[];
  } {
    const fontDetections = this.detectDocumentFonts(doc);
    const conversions: ConversionResult[] = [];

    const convertedPages = {
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        textRuns: page.textRuns.map((run) => {
          const detection = this.detectFontType(run.fontName);
          if (detection.detectedType !== 'unicode' && detection.detectedType !== 'unknown') {
            const converted = this.convertText(run.text, detection.detectedType);
            conversions.push({
              originalText: run.text,
              convertedText: converted,
              fontType: detection.detectedType,
              fontName: run.fontName,
            });
            return { ...run, text: converted };
          }

          // Even if font name is unknown, check if text content is Kruti Dev
          const textType = this.detectFromText(run.text);
          if (textType === 'krutidev') {
            const converted = this.convertKrutiDevToUnicode(run.text);
            conversions.push({
              originalText: run.text,
              convertedText: converted,
              fontType: 'krutidev',
              fontName: run.fontName,
            });
            return { ...run, text: converted };
          }

          return run;
        }),
      })),
    };

    return { convertedPages, conversions, fontDetections };
  }

  /**
   * Detect font types across an entire document
   */
  detectDocumentFonts(doc: XpsDocument): FontDetectionResult[] {
    const fontMap = new Map<string, FontDetectionResult>();

    for (const page of doc.pages) {
      for (const run of page.textRuns) {
        if (!fontMap.has(run.fontName)) {
          fontMap.set(run.fontName, this.detectFontType(run.fontName));
        }
      }
    }

    return Array.from(fontMap.values());
  }

  /**
   * Get conversion statistics
   */
  getStats(conversions: ConversionResult[]): {
    total: number;
    converted: number;
    byFontType: Record<string, number>;
  } {
    const byFontType: Record<string, number> = {};
    for (const c of conversions) {
      byFontType[c.fontType] = (byFontType[c.fontType] || 0) + 1;
    }
    return {
      total: conversions.length,
      converted: conversions.filter((c) => c.convertedText !== c.originalText).length,
      byFontType,
    };
  }
}
