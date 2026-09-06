import { describe, it, expect } from 'vitest';
import { normalizeDate, convertDates, DATE_FIELDS } from '../../shared/dateUtils';

describe('Date Lifecycle - Shared dateUtils', () => {
  describe('normalizeDate', () => {
    it('never returns today for invalid input', () => {
      const today = new Date();
      const result = normalizeDate('invalid-date-string');
      expect(result).toBeNull();
      expect(result?.getTime()).not.toBe(today.getTime());
    });

    it('never returns today for empty input', () => {
      expect(normalizeDate('')).toBeNull();
      expect(normalizeDate(null)).toBeNull();
      expect(normalizeDate(undefined)).toBeNull();
    });

    it('handles ISO date strings (YYYY-MM-DD)', () => {
      const result = normalizeDate('2026-08-18');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(7);
      expect(result!.getDate()).toBe(18);
    });

    it('handles ISO datetime strings', () => {
      const result = normalizeDate('2026-08-18T14:30:00');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getHours()).toBe(14);
    });

    it('handles DD-MM-YYYY format', () => {
      const result = normalizeDate('18-08-2026');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(7);
      expect(result!.getDate()).toBe(18);
    });

    it('handles DD/MM/YYYY format', () => {
      const result = normalizeDate('18/08/2026');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(18);
    });

    it('handles Unix millisecond timestamps as numbers', () => {
      const ts = new Date(2026, 7, 18).getTime();
      const result = normalizeDate(ts);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(18);
    });

    it('handles 13-digit numeric strings (BigInt serialization)', () => {
      const result = normalizeDate('1787049600000');
      expect(result).toBeInstanceOf(Date);
    });

    it('handles 10-digit numeric strings (seconds)', () => {
      const result = normalizeDate('1787049600');
      expect(result).toBeInstanceOf(Date);
    });

    it('passes through valid Date objects', () => {
      const d = new Date(2026, 7, 18);
      expect(normalizeDate(d)).toBe(d);
    });

    it('returns null for invalid Date objects', () => {
      expect(normalizeDate(new Date('invalid'))).toBeNull();
    });
  });

  describe('convertDates', () => {
    it('converts date string fields to Date objects', () => {
      const input = {
        date: '2026-08-18',
        invoiceDate: '2026-08-15',
        name: 'test',
      };
      const result = convertDates(input);
      expect(result.date).toBeInstanceOf(Date);
      expect(result.invoiceDate).toBeInstanceOf(Date);
      expect(result.name).toBe('test');
    });

    it('converts null/empty date fields to null', () => {
      const input = { date: '', invoiceDate: null, other: 'value' };
      const result = convertDates(input);
      expect(result.date).toBeNull();
      expect(result.invoiceDate).toBeNull();
    });

    it('converts undefined date fields to null', () => {
      const input = { date: undefined };
      const result = convertDates(input);
      expect(result.date).toBeNull();
    });

    it('handles nested objects with date fields', () => {
      const input = {
        nested: {
          date: '2026-08-18',
          value: 'test',
        },
      };
      const result = convertDates(input);
      expect(result.nested.date).toBeInstanceOf(Date);
    });

    it('handles arrays of objects with date fields', () => {
      const input = [
        { date: '2026-08-18' },
        { date: '2026-08-19' },
      ];
      const result = convertDates(input);
      expect(result[0].date).toBeInstanceOf(Date);
      expect(result[1].date).toBeInstanceOf(Date);
    });

    it('leaves non-date fields unchanged', () => {
      const input = {
        date: '2026-08-18',
        quantity: 10,
        name: 'Item',
        nested: { value: true },
      };
      const result = convertDates(input);
      expect(result.quantity).toBe(10);
      expect(result.name).toBe('Item');
      expect(result.nested.value).toBe(true);
    });

    it('converts all DATE_FIELDS correctly', () => {
      const input: Record<string, any> = {};
      for (const field of DATE_FIELDS) {
        input[field] = '2026-08-18';
      }
      const result = convertDates(input);
      for (const field of DATE_FIELDS) {
        expect(result[field]).toBeInstanceOf(Date);
      }
    });

    it('returns non-object input unchanged', () => {
      expect(convertDates(null)).toBeNull();
      expect(convertDates(undefined)).toBeUndefined();
      expect(convertDates('string')).toBe('string');
      expect(convertDates(123)).toBe(123);
    });

    it('passes through Date objects already in the input', () => {
      const d = new Date(2026, 7, 18);
      const input = { date: d };
      const result = convertDates(input);
      expect(result.date).toBe(d);
    });
  });
});

describe('Date Lifecycle - Frontend dateUtils', () => {
  // These tests verify the renderer-side dateUtils functions
  // They import from the renderer copy of dateUtils

  it('formatDateDDMMYYYY handles ISO string input', async () => {
    const { formatDateDDMMYYYY } = await import('../../renderer/utils/dateUtils');
    expect(formatDateDDMMYYYY('2026-08-18')).toBe('18-08-2026');
  });

  it('formatDateDDMMYYYY handles Date object input', async () => {
    const { formatDateDDMMYYYY } = await import('../../renderer/utils/dateUtils');
    expect(formatDateDDMMYYYY(new Date(2026, 7, 18))).toBe('18-08-2026');
  });

  it('formatDateDDMMYYYY returns empty for null', async () => {
    const { formatDateDDMMYYYY } = await import('../../renderer/utils/dateUtils');
    expect(formatDateDDMMYYYY(null)).toBe('');
  });

  it('formatDateTimeDDMMYYYY handles ISO datetime string', async () => {
    const { formatDateTimeDDMMYYYY } = await import('../../renderer/utils/dateUtils');
    const result = formatDateTimeDDMMYYYY('2026-08-18T14:30:00');
    expect(result).toBe('18-08-2026 14:30:00');
  });

  it('formatDateTimeDDMMYYYY returns dash for null', async () => {
    const { formatDateTimeDDMMYYYY } = await import('../../renderer/utils/dateUtils');
    expect(formatDateTimeDDMMYYYY(null)).toBe('-');
  });

  it('todayISO returns YYYY-MM-DD format', async () => {
    const { todayISO } = await import('../../renderer/utils/dateUtils');
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Date Lifecycle - IPC serialization format', () => {
  it('Dates should serialize to ISO strings (not raw timestamps)', () => {
    // Simulate what the IPC serializer does
    const date = new Date(2026, 7, 18, 14, 30);
    const serialized = date.toISOString();
    expect(serialized).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('BigInt should serialize to string (not raw number)', () => {
    const bigintValue = BigInt(123456789);
    const serialized = bigintValue.toString();
    expect(typeof serialized).toBe('string');
    expect(serialized).toBe('123456789');
  });
});

describe('Date Lifecycle - Roundtrip integrity', () => {
  it('ISO string -> normalizeDate -> ISO string roundtrip preserves date', () => {
    const original = '2026-08-18';
    const date = normalizeDate(original);
    expect(date).toBeInstanceOf(Date);
    const iso = date!.toISOString().split('T')[0];
    expect(iso).toBe(original);
  });

  it('DD-MM-YYYY -> normalizeDate -> formatDateDDMMYYYY roundtrip', async () => {
    const { formatDateDDMMYYYY } = await import('../../renderer/utils/dateUtils');
    const original = '18-08-2026';
    const date = normalizeDate(original);
    expect(date).toBeInstanceOf(Date);
    const formatted = formatDateDDMMYYYY(date!);
    expect(formatted).toBe(original);
  });

  it('Date object -> convertDates -> ISO string roundtrip', () => {
    const input = { date: '2026-08-18' };
    const converted = convertDates(input);
    expect(converted.date).toBeInstanceOf(Date);
    const iso = (converted.date as Date).toISOString().split('T')[0];
    expect(iso).toBe('2026-08-18');
  });
});

describe('Date Lifecycle - Schema field coverage', () => {
  it('DATE_FIELDS includes all business date fields', () => {
    const expectedFields = [
      'date', 'invoiceDate', 'postedAt', 'createdAt', 'updatedAt',
      'transactionDate', 'financialYearStart', 'financialYearEnd',
      'returnDate', 'installedDate', 'uninstalledDate',
    ];
    for (const field of expectedFields) {
      expect(DATE_FIELDS).toContain(field);
    }
  });
});

describe('Date Lifecycle - Service validation (reject-if-missing)', () => {
  it('DamageService: recoverFromDamage throws if no transactionDate', async () => {
    const { DamageService } = await import('./damage.service');
    const mockPrisma = {
      item: { findUnique: vi.fn().mockResolvedValue({ id: 1, itemName: 'Test' }) },
      store: { findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'Test Store' }) },
    };
    const svc = new DamageService(mockPrisma as any);
    (svc as any).stockEngine = { getStockBreakdown: vi.fn().mockResolvedValue({ damaged: 10 }) };
    await expect(svc.recoverFromDamage({
      companyId: 1, financialYearId: 1, itemId: 1, storeId: 1,
      quantity: 1, recoveredBy: 'test', remarks: '', transactionDate: undefined,
    })).rejects.toThrow('Transaction Date is required');
  });

  it('InstallationService: install throws if no transactionDate', async () => {
    const { InstallationService } = await import('./installation.service');
    const svc = new InstallationService(null as any);
    await expect(svc.install({
      companyId: 1, financialYearId: 1, itemId: 1, storeId: 1,
      targetLocationId: 1, quantity: 1, installedBy: 'test', transactionDate: undefined,
    })).rejects.toThrow('Transaction Date is required');
  });

  it('ReplacementService: replaceItem throws if no transactionDate', async () => {
    const { ReplacementService } = await import('./replacement.service');
    const svc = new ReplacementService(null as any, null as any);
    await expect(svc.replaceItem({
      companyId: 1, financialYearId: 1, oldItemId: 1, newItemId: 2,
      storeId: 1, roomId: 1, quantity: 1, replacedBy: 'test', transactionDate: undefined,
    })).rejects.toThrow('Transaction Date is required');
  });
});
