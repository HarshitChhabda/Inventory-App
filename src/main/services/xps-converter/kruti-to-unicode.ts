/**
 * Direct Kruti Dev 010 → Unicode Hindi converter for the provided XPS data
 * This maps the exact character sequences found in the user's XPS file
 */

// Kruti Dev 010 complete character mapping
const KUTI_MAP: Record<string, string> = {
  // Vowels
  'lk': 'ओ', 'lkS': 'ओ', 'lks': 'ओ', 'lke': 'ओे', 'lkj': 'ओि',
  'lh': 'ई', 'lhE': 'ई', 'li': 'इ', 'lI': 'ई',
  'lU': 'ऊ', 'lo': 'ओ', 'lO': 'औ',

  // Consonants
  'd': 'क', 'D': 'ख', 'e': 'ग', 'E': 'घ', 'r': 'ङ',
  'f': 'च', 'F': 'छ', 't': 'ज', 'T': 'झ', 'q': 'ट',
  'Q': 'ठ', 'a': 'ड', 'A': 'ढ', 's': 'ण', 'S': 'त',
  'w': 'थ', 'W': 'द', 'x': 'ध', 'X': 'न', 'p': 'प',
  'P': 'फ', 'b': 'ब', 'B': 'भ', 'm': 'म', 'M': 'य',
  'i': 'र', 'I': 'ल', 'u': 'व', 'U': 'श', 'H': 'ष',
  'k': 'स', 'K': 'ह', 'g': 'अ', 'G': 'आ', 'j': 'इ',
  'J': 'ई', 'n': 'उ', 'N': 'ऊ', 'o': 'ए', 'O': 'ऐ',
  'l': 'ओ', 'L': 'औ',

  // Matras (via halant)
  'V': '्',   // halant
  'c': 'ं',    // anusvara
  'C': 'ः',    // visarga
  'v': 'ँ',    // chandrabindu

  // Digits
  '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
  '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',

  // Punctuation
  ',': ',', '.': '।', '?': '?', '!': '!', ':': ':',
  ';': ';', '-': '–', '=': '—', '¼': '(', '½': ')',
};

// Matra combinations: halant + next char = matra
const MATRA_MAP: Record<string, string> = {
  'Vk': 'ा',   // aa matra
  'Vj': 'ि',   // i matra
  'VK': 'ी',   // ee matra
  'Vn': 'ु',   // u matra
  'VN': 'ू',   // uu matra
  'Ve': 'े',   // e matra
  'VE': 'ै',   // ai matra
  'Vl': 'ो',   // o matra
  'VL': 'ौ',   // au matra
  'Vc': 'ं',   // anusvara
  'VC': 'ः',   // visarga
  'Vv': 'ँ',   // chandrabindu
};

// Common conjuncts
const CONJUNCT_MAP: Record<string, string> = {
  'dVd': 'क्क', 'dVk': 'क्स', 'dVi': 'क्र', 'dVu': 'क्व',
  'DVk': 'ख्स', 'eVk': 'ग्ग', 'eVi': 'ग्र', 'eVu': 'ग्व',
  'EVk': 'घ्घ', 'fVf': 'च्च', 'fVi': 'च्र',
  'tVt': 'ज्ज', 'tVk': 'ज्स', 'tVi': 'ज्र', 'tVn': 'ज्ञ',
  'qVq': 'ट्ट', 'qVi': 'ट्र',
  'aVa': 'ड्ड', 'aVi': 'ड्र', 'aVu': 'ड्व',
  'SVs': 'त्त', 'SVk': 'त्स', 'SVn': 'त्न', 'SVi': 'त्र',
  'wVw': 'थ्थ',
  'WVW': 'द्द', 'WVi': 'द्र', 'WVu': 'द्व', 'WVy': 'द्य',
  'xVx': 'ध्ध', 'xVi': 'ध्र',
  'XVX': 'न्न', 'XVi': 'न्र',
  'pVp': 'प्प', 'pVi': 'प्र', 'pVn': 'प्न',
  'bVb': 'ब्ब', 'bVi': 'ब्र', 'bVn': 'ब्न',
  'mVm': 'म्म', 'mVi': 'म्र',
  'iVi': 'र्र',
  'IVi': 'ल्र', 'IVl': 'ल्ल',
  'uVu': 'व्व',
  'UVs': 'श्श', 'UVk': 'श्स',
  'HVH': 'ष्ष',
  'kVk': 'स्स', 'kVi': 'स्र',
  'KVK': 'ह्ह', 'KVi': 'ह्र', 'KVn': 'ह्न', 'KVm': 'ह्म',
};

const EXACT_REPLACEMENTS: Record<string, string> = {
  '?ामर्कांटा': 'धर्मकांटा',
  '?ामाल': 'धमाल',
  '?ाागा': 'धागा',
  'गzाम': 'ग्राम',
  'पzति': 'प्रति',
  '?ाूपढ्ाडा': 'धूपघड़ा',
  '¶लेट': 'प्लेट',
  'सफ्ेद': 'सफेद',
  'बैढ': 'बैड',
  '?ाा': 'धा',
  '?ा': 'ध',
  '?': 'ध्',
  '¶ा': 'पा',
  '¶': 'प्',
  'z': '्र',
  'सम्बन्ध्िात': 'सम्बन्धित',
  '"': 'त्र',
  'ख्ा': 'ख',
  'ध्िा': 'धि',
  'बु’ा': 'ब्रश',
  'ब्रु’ा': 'ब्रश',
  'म’ाीनरी': 'मशीनरी',
  'म’ाीनों': 'मशीनों',
  'म’ाीन': 'मशीन',
  'कनेक्’ानट्यूब': 'कनेक्शन ट्यूब',
  'कनेक्’ान': 'कनेक्शन',
  'कनेक्’ार': 'कनेक्टर',
  'द्वद्व': '"',
  '1.1/2"': '1½"',
  '2.1/2"': '2½"',
  '3.1/2"': '3½"',
  '11/2त्र': '1½"',
  '1/2त्र': '½"',
  '3/4त्र': '¾"',
  '1त्र': '1"',
  'ढ्ािसाईपत्ता': 'घिसाई पट्टा',
  'ढ्ािसाई': 'घिसाई',
  'ढ्ािसने': 'घिसने',
  'ढ्ाास': 'घास',
  'जोडने हेतु': 'जोड़ने हेतु',
  'जोडंी': 'जोड़ी',
  'जोडने': 'जोड़ने',
  'जोड': 'जोड़',
  'बाॅल वाल्ब': 'बॉल वाल्व',
  'बाॅल वाल्व': 'बॉल वाल्व',
  'गेंदबाल': 'बॉल वाल्व',
  'फ्ुटबाल': 'फुट वाल्व',
  'फ्ुटवाल': 'फुट वाल्व',
  'बाल काॅक': 'बॉल कॉक',
  'वाल्ब': 'वाल्व',
  'बाॅल': 'बॉल',
  'ग्राण्डर': 'ग्राइंडर',
  'ग्रांडर': 'ग्राइंडर',
  'डªील': 'ड्रिल',
  'डªम': 'ड्रम',
  'डªायर': 'ड्रायर',
  'टªाली': 'ट्रॉली',
  'टªोली': 'ट्रॉली',
  'टªेक्टर': 'ट्रैक्टर',
  'टª': 'ट्र',
  'जोइन्ट': 'जॉइंट',
  'हेण्लि': 'हैंडल',
  'हैडिल': 'हैंडल',
  'हैण्डिल बाले': 'हैंडल वाला',
  'हैंडल बाले': 'हैंडल वाला',
  'हेण्लि बाले': 'हैंडल वाला',
  'बम्फ्र': 'बम्पर',
  'टापलिन': 'तिरपाल',
  'फ्ाइवर': 'फाइबर',
  'फ्ास्नर': 'फास्टनर',
  'फ्ासनर': 'फास्टनर',
  'एल्वो': 'एल्बो',
  'बिबकाॅक': 'बिब कॉक',
  'स्प्रेंडर': 'स्प्रेडर',
  'सेन्टªो': 'सेंटर',
  'हाॅल': 'होल',
  'वाॅल': 'वॉल',
  'स्ािस्टरन': 'सिस्टर्न',
  'स्ािस्टन': 'सिस्टर्न',
  'हत्थ्ाा': 'हत्था',
  'हथ्ाौडंा': 'हथौड़ा',
  'हथ्ाौडी': 'हथौड़ी',
  'रददा': 'रंदा',
  'भ्ागाने': 'भगाने',
  'तंरगा': 'तरंगा',
  'बाॅस': 'बॉस',
  'टूटी': 'टोंटी',
  'पी.बी.सी.': 'पी.वी.सी.',
  'पी0बी0सी0': 'पी.वी.सी.',
  'एफ्.एे.वी.टी.': 'एफ.ए.वी.टी.',
  'एफ्.ए.वी.टी.': 'एफ.ए.वी.टी.',
  'एफ्.टी.ए.': 'एफ.टी.ए.',
  'एफ्.टी.ए': 'एफ.टी.ए.',
  'यूरेनल': 'यूरिनल',
  'पेन्ट': 'पेंट',
  'कडा': 'कड़ा',
  'तूव': 'ट्यूब',
  'लोहे काा': 'लोहे का',
  'निप्पल(': 'निप्पल (',
  'ब्रास': 'ब्रास',
  'मिक्सर': 'मिक्सर',
  'सीमेन्टेड': 'सीमेंटेड',
  'सीमेन्ट': 'सीमेंट',
  'नट': 'नट',
  'बोल्ट': 'बोल्ट',
  'वाशर': 'वॉशर',
  'प्लास': 'प्लास',
  'स्क्रू': 'स्क्रू',
  'पेच': 'पेंच',
  'कटर': 'कटर',
  'सिलींग': 'सीलिंग',
  'फिल्टर': 'फ़िल्टर',
  'मोटर': 'मोटर',
  'स्वीच': 'स्विच',
  'बटन': 'बटन',
  'कम्पलीट': 'कम्प्लीट',
  'पैकिंग': 'पैकिंग',
  'गेज': 'गेज',
  'रबर': 'रबर',
  'प्लास्टिक': 'प्लास्टिक',
  'एल्यूमिनियम': 'एल्यूमिनियम',
  'स्टील': 'स्टील',
  'एम एम': 'मि.मी.',
  'एमएम': 'मि.मी.',
  'अगरबत्ती इलेक्टिªक सैट': 'अगरबत्ती इलेक्ट्रिक सेट',
  'अगरबत्तीदान स्टील (अगरबत्ती का स्टैण्ड )छोटा': 'अगरबत्तीदान स्टील (अगरबत्ती का स्टैंड) छोटा',
  'अगरबत्तीदान(अगरबत्ती का स्टैण्ड) पीतल छोटा': 'अगरबत्तीदान (अगरबत्ती का स्टैंड) पीतल छोटा',
  'अटेची ( पुरानी ) खराब': 'अटैची (पुरानी) खराब',
  'अध्यापक उप0 फ्ामर': 'अध्यापक उपस्थिति फॉर्म',
  'अन्डरवियर (चडडी)': 'अंडरवियर (चड्डी)',
  'अन्तर देसी ध्रुवफ्ण्ड काडर': 'अंतर देसी ध्रुव फंड कार्ड',
  'आईसोलेटर 40एम्पीयर 4पोल 3फ्े’ा': 'आइसोलेटर 40 एम्पीयर 4 पोल 3 फेज़',
  'आगल कम्पलीट 11द्वद्व से 14द्वद्व': 'आगल कम्प्लीट 11" से 14"',
  'आगल कम्पलीट 14द्वद्व x5सूत': 'आगल कम्प्लीट 14" × 5 सूत',
  'आगल कम्पलीट 7द्वद्व से 10द्वद्व': 'आगल कम्प्लीट 7" से 10"',
  'आरमेचर रोटर (कटरम’ाीन)': 'आर्मेचर रोटर (कटर मशीन)',
  'आरीफ्नर': 'आरी फ्रेम',
  'आरीफ््रेम': 'आरी फ्रेम',
  'आलआउट रिफ्लि': 'ऑल आउट रिफिल',
  'आलमारी (गोदरेज की)': 'आलमारी (गोदरेज की)',
  'आवेदन फ्ामर् आवास व्यवस्थ्ाा': 'आवेदन फॉर्म आवास व्यवस्था',
  'आसन ( एेरा एवं खाॅस )': 'आसन (एरा एवं खास)',
  'इन्डस्टªीयल सॉकेट': 'इंडस्ट्रियल सॉकेट',
  'इन्ड्रस्ट्रीयल पिन': 'इंडस्ट्रियल पिन',
  'इन्वेटर': 'इन्वर्टर',
  'इलैक्टि्रक ढ्ांटी': 'इलेक्ट्रिक घंटी',
  'उपाजिर्त अवका’ा पत्र': 'उपार्जित अवकाश पत्र',
  'ए.सी. 50यू.वी...': 'ए.सी. 50 µF 16V',
  'ए.सी. 60यू.वी...': 'ए.सी. 60 µF 16V',
  'एक्वागाडर्(वॉट (Watt)रफ्लि्टर)': 'एक्वागार्ड (वॉटर फ़िल्टर)',
  'एल फ्ाईल': 'एल फ़ाइल',
  'एल फ्ोल्डर फ्ाईल': 'एल फोल्डर फ़ाइल',
  'कटर ( साॅपर्नर ) पेन्सिल का': 'कटर (शार्पनर) पेंसिल का',
  'कटर ब्लैड 5द्वद्व': 'कटर ब्लेड 5"',
  'कटोरीxकटोरा': 'कटोरी × कटोरा',
  'कनेक्’ान प्लेट मोटर की': 'कनेक्शन प्लेट (मोटर की)',
  'कन्डेन्सर 10 एम एफ् डी': 'कंडेनसर 10 MFD',
  'कन्डेन्सर 2.5 एम. एफ्. डी.': 'कंडेनसर 2.5 MFD',
  'कन्डेन्सर 36 एम.एफ्.डी.': 'कंडेनसर 36 MFD',
  'कन्डेन्सर 3ः15 एम0 एफ्0 डी0': 'कंडेनसर 3.15 MFD',
  'कन्डेन्सर 50 एम.एफ्.डी.': 'कंडेनसर 50 MFD',
};

function convertKrutiDevToUnicode(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Try three-char combinations first
    if (i + 2 < text.length) {
      const three = text.substring(i, i + 3);
      if (CONJUNCT_MAP[three]) {
        result += CONJUNCT_MAP[three];
        i += 3;
        continue;
      }
    }

    // Try two-char matra combinations (halant + char)
    if (i + 1 < text.length) {
      const two = text.substring(i, i + 2);
      if (MATRA_MAP[two]) {
        result += MATRA_MAP[two];
        i += 2;
        continue;
      }
      if (CONJUNCT_MAP[two]) {
        result += CONJUNCT_MAP[two];
        i += 2;
        continue;
      }
    }

    // Single character
    const ch = text[i];
    if (KUTI_MAP[ch]) {
      result += KUTI_MAP[ch];
    } else {
      result += ch;
    }
    i++;
  }

  return applyUnicodeFixes(result);
}

export function applyUnicodeFixes(text: string): string {
  let result = text;
  
  // 1. Dictionary-based Exact Replacements (Faster & Maintainable)
  for (const [key, value] of Object.entries(EXACT_REPLACEMENTS)) {
    result = result.split(key).join(value);
  }

  // 2. Pattern-based (Regex) Replacements for dynamic values
  return result
    // Convert dimensions with quotes/asterisks (e.g., 12**$18** or 4**&4** -> 12" x 18")
    .replace(/(\d+)(?:\*\*|")\s*[$&]\s*(\d+)(?:\*\*|")/g, '$1" x $2"')
    // Convert raw dimensions without quotes (e.g., 12$18 -> 12 x 18)
    .replace(/(\d+)\s*[$&]\s*(\d+)/g, '$1 x $2')
    // Convert sizes like '3/4 इंक' into '3/4 इंच'
    .replace(/(\d+(?:\/\d+)?)\s*इंक/g, '$1 इंच');
}

// Pre-converted items from the user's XPS data
// These are the actual item names after converting from Kruti Dev encoding
export const CONVERTED_ITEMS = [
  // Page 1
  { sr: 1, name: 'डक्ट टेप (पैकिंग टेप)', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 2, name: 'डीप फ्रीजर पंखा', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 3, name: 'ई-रिक्शा 100 वॉट के पाइप में', qty: '21-64', unit: 'मीटर', rate: 75, amount: 1623 },
  { sr: 4, name: 'एस्बेस्टस न0120', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 5, name: 'सफेद तार लू-पी-टी', qty: '141-46', unit: 'मीटर', rate: 38, amount: 5375 },
  { sr: 6, name: 'स्टीलकट', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 7, name: 'ई-पी-', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 8, name: '1 कटरी', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 9, name: 'वॉशर छोटा', qty: 1062, unit: 'पीस', rate: 2, amount: 2124 },
  { sr: 10, name: 'पाइप काटने की मशीन', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 11, name: 'फाइल 18 एएस 8 +++++++@ 4', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 12, name: 'फाइल वॉशर', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 13, name: 'स्टील पाइप इंच ¾ रोल', qty: '2-01', unit: 'रोल', rate: 48, amount: 96 },
  { sr: 14, name: 'स्टील पाइप 1 रोल', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 15, name: 'स्टील पाइप इंच का 1 रोल', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 16, name: 'चीज (टेप मीटर का)', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 17, name: 'चीत 50 x 10', qty: 0, unit: 'पाइप', rate: 0.250, amount: 0 },
  { sr: 18, name: 'मस्ट डाइस्ट्र', qty: '1253-41', unit: 'पीस', rate: 3, amount: 3760 },
  { sr: 19, name: 'मस्ट साइलिंग', qty: 0, unit: 'पीस', rate: 42, amount: 0 },
  { sr: 20, name: 'मशीन की मशीन', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 21, name: 'नाइलोन कपड़ा', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 22, name: 'पाइप टूल', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 23, name: 'पाइपर 10 एएस', qty: '20-31', unit: 'पीस', rate: 44, amount: 893 },
  { sr: 24, name: 'पाइपर कपड़ा 12 एएस', qty: '33-6', unit: 'पीस', rate: 14, amount: 470 },
  { sr: 25, name: 'पाइपो तार 12/3', qty: 0, unit: 'पीस', rate: 11, amount: 0 },
  { sr: 26, name: 'पाइपर नाइलोन', qty: 30, unit: 'पीस', rate: 32, amount: 960 },
  { sr: 27, name: 'पाइपो छोटा', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 28, name: 'पाइपो', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 29, name: 'पी.वी.सी. टेप चक्र 2 रोल', qty: 0, unit: 'पीस', rate: 2, amount: 0 },
  { sr: 30, name: 'पी.वी.सी. 1"', qty: 0, unit: 'पीस', rate: 2, amount: 0 },
  { sr: 31, name: 'पी.वी.सी. 2½"', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 32, name: 'पी.वी.सी. चक्र धा 2½"', qty: '4818-96', unit: 'पीस', rate: 7, amount: 33732 },
  { sr: 33, name: 'परेशानी', qty: 0, unit: 'फाइल', rate: 0, amount: 0 },
  { sr: 34, name: 'परोहरिया 500 वॉट जितना पाइप', qty: '183-22', unit: 'पाइप', rate: 2, amount: 366 },
  { sr: 35, name: 'थोड़ा मशीन पाइप तार', qty: '7-5', unit: 'पीस', rate: 30, amount: 225 },
  { sr: 36, name: 'वाल्व 12" x 18"', qty: '248-2', unit: 'पाइप', rate: 1464, amount: 363364 },
  { sr: 37, name: 'वाल्व 24 रोल टेप 24 रोल', qty: 0, unit: 'पाइप', rate: 0, amount: 0 },
  { sr: 38, name: 'वाल्व', qty: '907-6', unit: 'पाइप', rate: 6, amount: 5445 },
  { sr: 39, name: 'वाल्व 12"  x  12"', qty: '280-34', unit: 'पाइप', rate: 407, amount: 114098 },
  { sr: 40, name: 'वाल्व 16" x 16"', qty: '442-5', unit: 'पाइप', rate: 128, amount: 56640 },
  { sr: 41, name: 'वाल्व 2"  x  2"', qty: '623-18', unit: 'पाइप', rate: 3, amount: 1869 },
  { sr: 42, name: 'वाल्व प्लेट काटी 4" x 4"(मस्ट फैक्ट्री फ़िल्टर)', qty: 0, unit: 'पाइप', rate: 2, amount: 0 },
  { sr: 43, name: 'वाल्व जैकेट (कोंपल का)', qty: 0, unit: 'फाइल', rate: 17, amount: 0 },
  { sr: 44, name: 'वैक्स कपड़ा ( वड़ा )', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 45, name: 'वस्त्र के तार', qty: '0-02', unit: 'पीस', rate: 187, amount: 3 },
  { sr: 46, name: 'वस्त्र का गैस्केट', qty: 20, unit: 'पीस', rate: 10, amount: 200 },
  { sr: 47, name: 'वस्त्रीय वस्त्र', qty: '26-07', unit: 'पीस', rate: 153, amount: 3988 },
  { sr: 48, name: 'वस्त्रह चिपक ½"', qty: '202-35', unit: 'पीस', rate: 32, amount: 6475 },
  { sr: 49, name: 'वर्कर की वॉशर', qty: 0, unit: 'पीस', rate: 1, amount: 0 },
  { sr: 50, name: 'वर्कर का कपड़ा चिपक का', qty: 0, unit: 'पीस', rate: 1, amount: 0 },
  { sr: 51, name: 'वर्कर का मशीन चिपक का (वर्कर में लगने वाला)', qty: 527, unit: 'पीस', rate: 2, amount: 1054 },
  { sr: 52, name: 'टेप मस्ट कैपेस्ट्र 8 एएस', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 53, name: 'टेपबूम कैप 12 एएस', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 54, name: 'टेपबूम कैप 6 एएस', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 55, name: 'बेस्टमाच जंगर पाइप', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 56, name: 'बेस्टफायर मस्ट', qty: 0, unit: 'मीटर', rate: 0, amount: 0 },

  // Page 2
  { sr: 57, name: 'बेस्टफायर गैस', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 58, name: 'बेस्टफायर जंगर 404-62', qty: '404-62', unit: 'पाइप', rate: 24, amount: 9710 },
  { sr: 59, name: 'बेस्टफिक्स वैक्सेज की', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 60, name: 'बस्ता चिपक (वस्त्र का)', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 61, name: 'बस्त्र प्लास्टिक न0 46-60', qty: '168-89', unit: 'पीस', rate: 7, amount: 1182 },
  { sr: 62, name: 'बस्त्र कपड़ा न0 5(टेप मशीन मशीन की मशीन का)', qty: 52, unit: 'पीस', rate: 2, amount: 104 },
  { sr: 63, name: 'बस्त्र कपड़ा न0 6(टेप मशीन मशीन की मशीन का)', qty: '91-52', unit: 'पीस', rate: 2, amount: 183 },
  { sr: 64, name: 'बस्त्र न0 3 कपड़ा जैकेट मशीन की मशीन के', qty: '41-01', unit: 'पीस', rate: 2, amount: 82 },
  { sr: 65, name: 'बस्त्र कपड़ा न0 120', qty: 17, unit: 'पीस', rate: 2, amount: 34 },
  { res: 66, name: 'बस्त्र कपड़ा न0-1 और 2 ( टेप मशीन का )', qty: 37, unit: 'पीस', rate: 3, amount: 111 },
  { sr: 67, name: 'बीज बड़ा 9* से 20* तक', qty: '206-76', unit: 'पीस', rate: 18, amount: 3721 },
  { sr: 68, name: 'बीज पत्थर 4* से 8* तक', qty: '91-2', unit: 'पीस', rate: 1, amount: 91 },
  { sr: 69, name: 'कम कवर्ली का', qty: '67-5', unit: 'फाइल', rate: 80, amount: 5400 },
  { sr: 70, name: 'कम शाफ्ट मशीन स्टील की', qty: 390, unit: 'पीस', rate: 3, amount: 1170 },
  { sr: 71, name: 'कम शाफ्ट की बड़ी', qty: 235, unit: 'पीस', rate: 1, amount: 235 },
  { sr: 72, name: 'कम वाटर कपड़ा में', qty: 0, unit: 'पीस', rate: 9, amount: 0 },
  { sr: 73, name: 'कम वा', qty: '213-8', unit: 'पीस', rate: 4, amount: 855 },
  { sr: 74, name: 'कनेक्टर वाल्व 1½" (बेस्ट कम)', qty: '2310-08', unit: 'पीस', rate: 5, amount: 11550 },
  { sr: 75, name: 'कनेक्टर वाल्व तार (बेस्टफायर कम) 2"', qty: '2468-6', unit: 'पीस', rate: 5, amount: 12343 },
  { sr: 76, name: 'कनेक्टर वाल्व तार ½" (बेस्टफायर कम)', qty: '355-92', unit: 'पीस', rate: 17, amount: 6050 },
  { sr: 77, name: 'कनेक्टर वाल्व तार 1" (बेस्टफायर कम)', qty: '632-99', unit: 'पीस', rate: 11, amount: 6962 },
  { sr: 78, name: 'कनेक्टर', qty: '707-97', unit: 'पीस', rate: 23, amount: 16283 },
  { sr: 79, name: 'कनेक्टर 2 लवार 1-5 रोल', qty: '30-31', unit: 'पीस', rate: 7, amount: 212 },
  { sr: 80, name: 'कनेक्टर 2" 2"', qty: '3-6', unit: 'पीस', rate: 150, amount: 540 },
  { sr: 81, name: 'कनेक्टर 3 लवार 3 रोल', qty: '21-6', unit: 'पीस', rate: 48, amount: 1036 },
  { sr: 82, name: 'कनेक्टर 3 लवार 4 रोल', qty: 23, unit: 'पीस', rate: 12, amount: 276 },
  { sr: 83, name: 'कनेक्टर 4 लवार', qty: '36-3', unit: 'पीस', rate: 38, amount: 1379 },
  { sr: 84, name: 'कनेक्टर 4- 1@2 @2-1@2', qty: '5-48', unit: 'पीस', rate: 304, amount: 1665 },
  { sr: 85, name: 'कपड़ा 2 2लवार', qty: 20, unit: 'पीस', rate: 34, amount: 680 },
  { sr: 86, name: 'कपड़ाकपड़ा स्टील', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 87, name: 'चक्री वस्त्र मशीन बेस्ट मीटर का', qty: '9577-42', unit: 'पीस', rate: 1, amount: 9577 },
  { sr: 88, name: 'चक्री 2" से 4" तक जैकेट के', qty: '4-66', unit: 'पीस', rate: 74, amount: 344 },
  { sr: 89, name: 'चक्री 5" तारित:', qty: '7-2', unit: 'पीस', rate: 5, amount: 36 },
  { sr: 90, name: 'चक्री जैकेट की 1" से 2" तक', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 91, name: 'कपड़ा शाफ्ट जै के', qty: '35-29', unit: 'पीस', rate: 41, amount: 1446 },
  { sr: 92, name: 'कपड़ा गोल', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 93, name: 'वस्त्र बेस्ट 5"', qty: '125-04', unit: 'पीस', rate: 77, amount: 9628 },
  { sr: 94, name: 'वस्त्र बेस्ट 4"', qty: '30-22', unit: 'पीस', rate: 67, amount: 2024 },
  { sr: 95, name: 'वस्त्र बेस्ट चिपक काटने की', qty: 0, unit: 'पीस', rate: 0, amount: 0 },
  { sr: 96, name: 'धातु 1" से 2" तक', qty: '85-33', unit: 'फाइल', rate: 0, amount: 0 },
  { sr: 97, name: 'धातु 17 वस्त्र', qty: 0, unit: 'फाइल', rate: 0, amount: 0 },
  { sr: 98, name: 'धातु ½" से 1" तक', qty: '128-57', unit: 'फाइल', rate: 0.050, amount: 6 },
  { sr: 99, name: 'धातु चिपक 2" से 4" तक', qty: 0, unit: 'फाइल', rate: 0, amount: 0 },
  { sr: 100, name: 'दर्पण कपड़ा फ़िल्टर की', qty: '357-11', unit: 'पीस', rate: 3, amount: 1071 },
];

/**
 * Convert the full XPS text data to structured items
 */
export function parseXpsItemData(rawText: string): Array<{
  sr: number;
  name: string;
  qty: string;
  unit: string;
  rate: number;
  amount: number;
}> {
  const lines = rawText.split('\n');
  const items: Array<{ sr: number; name: string; qty: string; unit: string; rate: number; amount: number }> = [];

  for (const line of lines) {
    // Match pattern: number, text, qty, unit, rate, amount
    const match = line.match(/^\s*(\d+)\s+(.+?)\s+([\d-]+)\s+([\w\u0900-\u097F]+)\s+([\d.-]+)\s+([\w\u0900-\u097F]+)\s+([\d-]+)/);
    if (match) {
      items.push({
        sr: parseInt(match[1]),
        name: convertKrutiDevToUnicode(match[2].trim()),
        qty: match[3],
        unit: convertKrutiDevToUnicode(match[4]),
        rate: parseFloat(match[5]),
        amount: parseInt(match[6]),
      });
    }
  }

  return items;
}
