/**
 * Renderer Date Utilities
 * Delegates to the canonical shared dateUtils for IST-correct formatting.
 * This file exists for backward compatibility with existing renderer imports.
 */
export {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  normalizeDate,
  toISODate,
  toISODateIST,
  todayDDMMYYYY,
  todayISO,
  getTodayIST,
  getCurrentISTDateTime,
  convertDates,
  DATE_FIELDS,
} from '../../shared/dateUtils';

/**
 * Parse a DD-MM-YYYY string to a Date object.
 */
export function parseDateDDMMYYYY(str: string): Date | null {
  if (!str) return null;
  const parts = str.split(/[-/]/);
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (isNaN(date.getTime())) return null;
  return date;
}
