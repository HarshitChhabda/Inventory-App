/**
 * Canonical Date/Time Utility — Asia/Kolkata (IST)
 *
 * All business-facing dates MUST use IST explicitly.
 * Business dates (transactionDate, receiptDate, etc.) represent calendar dates selected by the user.
 * System timestamps (createdAt, postedAt, etc.) represent exact moments.
 *
 * Timezone: Asia/Kolkata (IST, UTC+5:30)
 * Date format: DD-MM-YYYY
 * DateTime format: DD-MM-YYYY HH:mm:ss
 * Clock: 24-hour
 * Database: Prisma DateTime / SQLite epoch milliseconds
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get today's date in IST as YYYY-MM-DD.
 * This replaces the old todayISO() which used UTC and could shift dates.
 */
export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Get current date+time in IST as DD-MM-YYYY HH:mm:ss.
 */
export function getCurrentISTDateTime(): string {
  const now = new Date();
  return formatDateTimeDDMMYYYY(now);
}

/**
 * Format a Date to DD-MM-YYYY HH:mm:ss using IST.
 */
export function formatDateTimeDDMMYYYY(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = normalizeDate(date);
  if (!d) return '-';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Format a Date to DD-MM-YYYY using IST.
 */
export function formatDateDDMMYYYY(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = normalizeDate(date);
  if (!d) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')}`;
}

/**
 * Get today's date in IST as DD-MM-YYYY.
 */
export function todayDDMMYYYY(): string {
  return formatDateDDMMYYYY(new Date());
}

/**
 * Get today's date in IST as YYYY-MM-DD (for date inputs).
 * This replaces the buggy todayISO() that used UTC.
 */
export function todayISO(): string {
  return getTodayIST();
}

/**
 * Convert a Date to IST YYYY-MM-DD string.
 * Use this instead of toISOString().split('T')[0] to avoid UTC shift.
 */
export function toISODateIST(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = normalizeDate(date);
  if (!d) return '';
  return d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Normalize a date value to a Date object.
 * Handles ISO strings, DD-MM-YYYY, timestamps, and Date objects.
 * NEVER returns today's date for invalid input — returns null instead.
 */
export function normalizeDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;

  // Already ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})([T\s].*)?$/);
  if (isoMatch) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const parts = s.split(/[-/.]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts.map(Number);
    // If first part > 31, assume YYYY-MM-DD or YYYY/DD/MM
    if (p1 > 31 && p1 > 1000) {
      const d = new Date(p1, p2 - 1, p3);
      return isNaN(d.getTime()) ? null : d;
    }
    // Otherwise assume DD-MM-YYYY
    const d = new Date(p3, p2 - 1, p1);
    return isNaN(d.getTime()) ? null : d;
  }

  // Handle numeric timestamp strings (e.g., "1786961106299" from BigInt serialization)
  // 10-digit = seconds, 13-digit = milliseconds
  if (/^\d{10}$/.test(s)) {
    const d = new Date(Number(s) * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{13}$/.test(s)) {
    const d = new Date(Number(s));
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: try native Date parsing
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Date fields that represent business/system dates in Prisma models.
 */
export const DATE_FIELDS = [
  'date', 'invoiceDate', 'postedAt', 'createdAt', 'updatedAt',
  'transactionDate', 'financialYearStart', 'financialYearEnd',
  'returnDate', 'installedDate', 'uninstalledDate',
];

/**
 * Recursively convert all date fields in an object from strings/numbers to Date objects.
 * Uses normalizeDate for robust conversion.
 */
export function convertDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertDates);

  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (DATE_FIELDS.includes(k)) {
      if (v === '' || v === null || v === undefined) {
        out[k] = null;
      } else {
        const normalized = normalizeDate(v);
        if (normalized) {
          out[k] = normalized;
        } else {
          out[k] = null;
        }
      }
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = convertDates(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Convert a Date to ISO string (for serialization).
 * For business dates, prefer toISODateIST() to avoid UTC shift.
 * For system timestamps, this is correct as-is.
 */
export function toISODate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = normalizeDate(date);
  if (!d) return '';
  return d.toISOString().split('T')[0];
}
