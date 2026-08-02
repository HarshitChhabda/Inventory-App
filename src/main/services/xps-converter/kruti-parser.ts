/**
 * Direct Kruti Dev text parser for XPS inventory data
 * Parses the specific format: Sr. No. | Item Name | Qty | Unit | Rate | Amount
 */

// Complete Kruti Dev 010 to Unicode mapping
const KUTI: Record<string, string> = {
  // Consonants
  'd': 'क', 'D': 'ख', 'e': 'ग', 'E': 'घ', 'r': 'ङ',
  'f': 'च', 'F': 'छ', 't': 'ज', 'T': 'झ', 'q': 'ट',
  'Q': 'ठ', 'a': 'ड', 'A': 'ढ', 's': 'ण', 'S': 'त',
  'w': 'थ', 'W': 'द', 'x': 'ध', 'X': 'न', 'p': 'प',
  'P': 'फ', 'b': 'ब', 'B': 'भ', 'm': 'म', 'M': 'य',
  'i': 'र', 'I': 'ल', 'u': 'व', 'U': 'श', 'H': 'ष',
  'k': 'स', 'K': 'ह', 'g': 'अ', 'G': 'आ', 'j': 'इ',
  'J': 'ई', 'n': 'उ', 'N': 'ऊ', 'o': 'ए', 'O': 'ऐ',
  // Halant and matras
  'V': '्', 'c': 'ं', 'C': 'ः', 'v': 'ँ',
  // Digits
  '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
  '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
  // Punctuation
  ',': ',', '.': '।', '¼': '(', '½': ')',
};

// Matra combinations
const MATRA: Record<string, string> = {
  'Vk': 'ा', 'Vj': 'ि', 'VK': 'ी', 'Vn': 'ु', 'VN': 'ू',
  'Ve': 'े', 'VE': 'ै', 'Vl': 'ो', 'VL': 'ौ',
};

function decode(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (i + 1 < text.length) {
      const two = text.substring(i, i + 2);
      if (MATRA[two]) { result += MATRA[two]; i += 2; continue; }
    }
    const ch = text[i];
    result += KUTI[ch] || ch;
    i++;
  }
  return result
    .replace(/\?ामर्कांटा/g, 'धर्मकांटा')
    .replace(/\?ामाल/g, 'धमाल')
    .replace(/\?ाागा/g, 'धागा')
    .replace(/गzाम/g, 'ग्राम')
    .replace(/पzति/g, 'प्रति')
    .replace(/\?ाूपढ्ाडा/g, 'धूपघड़ा')
    .replace(/¶लेट/g, 'प्लेट')
    .replace(/सफ्ेद/g, 'सफेद')
    .replace(/बैढ/g, 'बैड')
    .replace(/\?ाा/g, 'धा')
    .replace(/\?ा/g, 'ध')
    .replace(/\?/g, 'ध्')
    .replace(/¶ा/g, 'पा')
    .replace(/¶/g, 'प्')
    .replace(/z/g, '्र')
    .replace(/सम्बन्ध्िात/g, 'सम्बन्धित')
    .replace(/"/g, 'त्र')
    .replace(/ख्ा/g, 'ख')
    .replace(/ध्िा/g, 'धि');
}

export interface ParsedItem {
  sr: number;
  name: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
  originalName: string;
}

/**
 * Parse the Kruti Dev XPS text into structured items
 * Format: "  123 ,DokxkMZ¼okVjfQYVj½         0        1.000 ux                 0"
 */
export function parseKrutiDevXps(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Match: spaces + number + spaces + text + spaces + number + spaces + number + spaces + unit + spaces + number
    const match = line.match(/^\s*(\d+)\s+(.+?)\s+([\d.,-]+)\s+([\d.,-]+)\s+(\S+)\s+([\d.,-]+)\s*$/);
    if (match) {
      const originalName = match[2].trim();
      items.push({
        sr: parseInt(match[1]),
        name: decode(originalName),
        qty: match[3],
        rate: match[4],
        unit: decode(match[5]),
        amount: match[6],
        originalName,
      });
    }
  }

  return items;
}

/**
 * Parse items from the user's specific format
 * The format has these columns:
 * Øe l-vkbZVe uke (Item Name) | nj (Rate) | pkyw ek=kbdkbZ (Stock Unit) | jkf'k (Amount)
 */
export function parseUserXpsData(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Skip separator lines
    if (line.includes('---') || line.includes('Øe') || line.includes('fnxEcj')) continue;

    // Try to match the format: number + item name + numbers + unit + amount
    const match = line.match(/^\s*(\d+)\s+(.+?)\s+([\d.,-]+)\s+([\d.,-]+)\s+(\S+)\s+([\d.,-]+)\s*$/);
    if (match) {
      const originalName = match[2].trim();
      items.push({
        sr: parseInt(match[1]),
        name: decode(originalName),
        qty: match[3],
        rate: match[4],
        unit: decode(match[5]),
        amount: match[6],
        originalName,
      });
    }
  }

  return items;
}
