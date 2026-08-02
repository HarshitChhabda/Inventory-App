import { XpsDocument } from './xps-parser';

/**
 * Hindi → English Translation Service
 *
 * Uses a dictionary-based approach for common words and a rule-based
 * system for general translation. For production, integrate with
 * Google Translate API or similar.
 */

// Comprehensive Hindi → English dictionary for common inventory/business terms
const HINDI_ENGLISH_DICT: Record<string, string> = {
  // Common words
  'नाम': 'Name',
  'पता': 'Address',
  'शहर': 'City',
  'राज्य': 'State',
  'देश': 'Country',
  'फोन': 'Phone',
  'मोबाइल': 'Mobile',
  'ईमेल': 'Email',
  'दिनांक': 'Date',
  'तिथि': 'Date',
  'महीना': 'Month',
  'वर्ष': 'Year',
  'दिन': 'Day',
  'सप्ताह': 'Week',

  // Inventory terms
  'क्रम': 'Sr.',
  'क्रमांक': 'Sr. No.',
  'विवरण': 'Description',
  'मात्रा': 'Quantity',
  'दर': 'Rate',
  'राशि': 'Amount',
  'कुल': 'Total',
  'योग': 'Grand Total',
  'अधिक': 'Excess',
  'कम': 'Less',
  'शेष': 'Balance',
  'स्टॉक': 'Stock',
  'इन्वेंट्री': 'Inventory',
  'भंडार': 'Store',
  'गोदाम': 'Warehouse',

  // Document types
  'चालान': 'Challan',
  'बिल': 'Bill',
  'रसीद': 'Receipt',
  'Invoice': 'Invoice',
  'आदेश': 'Order',
  'प्रपत्र': 'Form',
  'प्रतिवेदन': 'Report',
  'लेखा': 'Accounts',
  'बही': 'Ledger',
  'खाता': 'Account',

  // Parties
  'विक्रेता': 'Vendor',
  'क्रेता': 'Buyer',
  'आपूर्तिकर्ता': 'Supplier',
  'ग्राहक': 'Customer',
  'विभाग': 'Department',
  'शाखा': 'Branch',
  'कार्यालय': 'Office',

  // Actions
  'प्राप्त': 'Received',
  'प्रेषित': 'Dispatched',
  'जमा': 'Deposit',
  'निकासी': 'Withdrawal',
  'स्थानांतरण': 'Transfer',
  'समायोजन': 'Adjustment',
  'वापसी': 'Return',
  'नुकसान': 'Damage',
  'स्क्रैप': 'Scrap',

  // Items
  'वस्तु': 'Item',
  'सामान': 'Goods',
  'माल': 'Material',
  'उपकरण': 'Equipment',
  'पुर्जा': 'Parts',
  'सामग्री': 'Material',
  'पैकिंग': 'Packing',
  'लेबल': 'Label',
  'बैरल': 'Barrel',
  'बोतल': 'Bottle',
  'डिब्बा': 'Box',
  'कैन': 'Can',
  'टिन': 'Tin',
  'बैग': 'Bag',
  'कट्टा': 'Bag',
  'रोल': 'Roll',
  'सिलेंडर': 'Cylinder',

  // Measurements
  'किलोग्राम': 'Kilogram',
  'ग्राम': 'Gram',
  'लीटर': 'Liter',
  'मिलीलीटर': 'Milliliter',
  'मीटर': 'Meter',
  'सेंटीमीटर': 'Centimeter',
  'पीस': 'Piece',
  'नग': 'Piece',
  'जोड़ी': 'Pair',
  'दर्जन': 'Dozen',
  'सेट': 'Set',
  'कार्टन': 'Carton',
  'पैकेट': 'Packet',
  'बोरी': 'Sack',
  'प्लेट': 'Plate',
  'बाल्टी': 'Bucket',

  // Quality/Status
  'अच्छा': 'Good',
  'खराब': 'Bad',
  'नया': 'New',
  'पुराना': 'Old',
  'उपयोग': 'Used',
  'अप्रयुक्त': 'Unused',
  'खुला': 'Open',
  'बंद': 'Closed',
  'उपलब्ध': 'Available',
  'अनुपलब्ध': 'Unavailable',

  // Time
  'आज': 'Today',
  'कल': 'Yesterday',
  'परसों': 'Day After Tomorrow',
  'सोमवार': 'Monday',
  'मंगलवार': 'Tuesday',
  'बुधवार': 'Wednesday',
  'गुरुवार': 'Thursday',
  'शुक्रवार': 'Friday',
  'शनिवार': 'Saturday',
  'रविवार': 'Sunday',

  // Hindi numerals
  'शून्य': '0',
  'एक': '1',
  'दो': '2',
  'तीन': '3',
  'चार': '4',
  'पांच': '5',
  'छह': '6',
  'सात': '7',
  'आठ': '8',
  'नौ': '9',
  'दस': '10',

  // Religious/Trust specific
  'महावीरजी': 'Mahaveerji',
  'श्री': 'Shri',
  'दिगम्बर': 'Digambar',
  'जैन': 'Jain',
  'अतिशय': 'Atishay',
  'क्षेत्र': 'Kshetra',
  'मंदिर': 'Temple',
  'ट्रस्ट': 'Trust',
  'संस्थान': 'Institution',
  'प्रबंधन': 'Management',

  // Common phrases
  'कृपया': 'Please',
  'धन्यवाद': 'Thank You',
  'स्वागत': 'Welcome',
  'शुभकामनाएं': 'Best Wishes',
  'महोदय': 'Sir',
  'महोदया': 'Madam',
  'प्रति': 'To/Per',
  'हस्ताक्षर': 'Signature',
  'मुहर': 'Seal',
  'अनुमति': 'Permission',
  'अनुमोदन': 'Approval',
  'स्वीकृत': 'Approved',
  'अस्वीकृत': 'Rejected',
  'लंबित': 'Pending',
  'पूर्ण': 'Completed',
};

// Hindi word boundaries for dictionary matching
const HINDI_CHAR_RANGE = /[\u0900-\u097F]/;

/**
 * Translate Hindi text to English
 */
export function translateHindiToEnglish(text: string): string {
  if (!text) return text;

  // Check if text contains any Devanagari characters
  if (!HINDI_CHAR_RANGE.test(text)) {
    return text; // Already English/other language
  }

  let result = text;

  // Sort dictionary entries by length (longest first) for greedy matching
  const sortedEntries = Object.entries(HINDI_ENGLISH_DICT).sort((a, b) => b[0].length - a[0].length);

  for (const [hindi, english] of sortedEntries) {
    // Case-insensitive replacement preserving word boundaries
    const regex = new RegExp(hindi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, english);
  }

  // Handle remaining Hindi text that wasn't in dictionary
  // Try word-by-word translation
  const words = result.split(/(\s+)/);
  const translatedWords = words.map((word) => {
    if (HINDI_CHAR_RANGE.test(word)) {
      // Still has Hindi - try partial dictionary lookup
      return translatePartialHindi(word, sortedEntries);
    }
    return word;
  });

  return translatedWords.join('');
}

/**
 * Try to translate partial Hindi text (word with some known parts)
 */
function translatePartialHindi(
  text: string,
  sortedEntries: [string, string][]
): string {
  // Try to find the longest matching prefix/suffix
  for (const [hindi, english] of sortedEntries) {
    if (text.includes(hindi)) {
      text = text.replace(hindi, english);
    }
  }

  // If still has Hindi characters, transliterate remaining
  if (HINDI_CHAR_RANGE.test(text)) {
    return transliterateRemaining(text);
  }

  return text;
}

/**
 * Transliterate remaining Hindi characters to Roman script
 */
function transliterateRemaining(text: string): string {
  // Basic Devanagari to Roman transliteration
  const transliterationMap: Record<string, string> = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    '्': '', 'ं': 'n', 'ः': 'h', 'ँ': 'n',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };

  let result = '';
  for (const char of text) {
    const mapped = transliterationMap[char];
    if (mapped !== undefined) {
      result += mapped;
    } else if (!HINDI_CHAR_RANGE.test(char)) {
      result += char; // Keep non-Hindi characters as-is
    }
    // Skip unmapped Hindi characters
  }

  return result;
}

/**
 * Translate a document's text from Hindi to English
 */
export function translateDocument(doc: XpsDocument): XpsDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      textRuns: page.textRuns.map((run) => ({
        ...run,
        text: translateHindiToEnglish(run.text),
      })),
    })),
  };
}

/**
 * Create a bilingual document (side-by-side Hindi + English)
 */
export function createBilingualDocument(
  hindiDoc: XpsDocument,
  englishDoc: XpsDocument
): { hindi: XpsDocument; english: XpsDocument } {
  return {
    hindi: hindiDoc,
    english: englishDoc,
  };
}

/**
 * Get translation statistics
 */
export function getTranslationStats(
  originalTexts: string[],
  translatedTexts: string[]
): { translated: number; unchanged: number; total: number } {
  let translated = 0;
  let unchanged = 0;

  for (let i = 0; i < originalTexts.length; i++) {
    if (originalTexts[i] !== translatedTexts[i]) {
      translated++;
    } else {
      unchanged++;
    }
  }

  return { translated, unchanged, total: originalTexts.length };
}
