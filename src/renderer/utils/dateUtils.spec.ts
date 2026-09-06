import { describe, it, expect } from 'vitest';
import { normalizeDate, formatDateDDMMYYYY, formatDateTimeDDMMYYYY, parseDateDDMMYYYY, toISODate } from './dateUtils';

describe('normalizeDate', () => {
  it('returns null for falsy values', () => {
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(0)).toBeNull();
  });

  it('passes through valid Date objects', () => {
    const d = new Date(2026, 7, 15);
    expect(normalizeDate(d)).toBe(d);
  });

  it('returns null for invalid Date objects', () => {
    expect(normalizeDate(new Date('invalid'))).toBeNull();
  });

  it('parses ISO strings YYYY-MM-DD', () => {
    const result = normalizeDate('2026-08-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
    expect(result!.getMonth()).toBe(7);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses ISO strings with time YYYY-MM-DDTHH:mm:ss', () => {
    const result = normalizeDate('2026-08-15T14:30:00');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it('parses DD-MM-YYYY format', () => {
    const result = normalizeDate('15-08-2026');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
    expect(result!.getMonth()).toBe(7);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses DD/MM/YYYY format', () => {
    const result = normalizeDate('15/08/2026');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
    expect(result!.getMonth()).toBe(7);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses DD.MM.YYYY format', () => {
    const result = normalizeDate('15.08.2026');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
    expect(result!.getMonth()).toBe(7);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses number timestamps', () => {
    const ts = new Date(2026, 7, 15).getTime();
    const result = normalizeDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
  });

  it('parses native date strings via fallback', () => {
    const result = normalizeDate('August 15, 2026');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
  });

  it('parses numeric timestamp strings (BigInt serialization)', () => {
    const result = normalizeDate('1786961106299');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses 10-digit numeric timestamp strings (seconds)', () => {
    const result = normalizeDate('1786961106');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('returns null for invalid strings', () => {
    expect(normalizeDate('not-a-date')).toBeNull();
    expect(normalizeDate('xyz')).toBeNull();
    expect(normalizeDate('hello world')).toBeNull();
  });

  it('handles whitespace in strings', () => {
    const result = normalizeDate('  2026-08-15  ');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
  });
});

describe('formatDateDDMMYYYY', () => {
  it('formats Date object to DD-MM-YYYY', () => {
    expect(formatDateDDMMYYYY(new Date(2026, 7, 15))).toBe('15-08-2026');
  });

  it('formats ISO string to DD-MM-YYYY', () => {
    expect(formatDateDDMMYYYY('2026-08-15')).toBe('15-08-2026');
  });

  it('formats DD-MM-YYYY input back to DD-MM-YYYY', () => {
    expect(formatDateDDMMYYYY('15-08-2026')).toBe('15-08-2026');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatDateDDMMYYYY(null)).toBe('');
    expect(formatDateDDMMYYYY(undefined)).toBe('');
  });
});

describe('formatDateTimeDDMMYYYY', () => {
  it('formats Date with time to DD-MM-YYYY HH:mm:ss', () => {
    const d = new Date(2026, 7, 15, 14, 30, 45);
    expect(formatDateTimeDDMMYYYY(d)).toBe('15-08-2026 14:30:45');
  });

  it('returns dash for null/undefined', () => {
    expect(formatDateTimeDDMMYYYY(null)).toBe('-');
    expect(formatDateTimeDDMMYYYY(undefined)).toBe('-');
  });
});

describe('parseDateDDMMYYYY', () => {
  it('parses DD-MM-YYYY', () => {
    const d = parseDateDDMMYYYY('15-08-2026');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(7);
    expect(d!.getFullYear()).toBe(2026);
  });

  it('parses DD/MM/YYYY', () => {
    const d = parseDateDDMMYYYY('15/08/2026');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(15);
  });

  it('returns null for empty string', () => {
    expect(parseDateDDMMYYYY('')).toBeNull();
  });

  it('returns null for less than 3 parts', () => {
    expect(parseDateDDMMYYYY('2026-08')).toBeNull();
  });
});

describe('toISODate', () => {
  it('converts ISO string to ISO date string', () => {
    expect(toISODate('2026-08-15')).toBe('2026-08-15');
  });

  it('converts DD-MM-YYYY string to ISO date string', () => {
    const result = toISODate('15-08-2026');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns empty string for null', () => {
    expect(toISODate(null)).toBe('');
  });
});
