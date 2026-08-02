export function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDateTimeDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

export function parseDateDDMMYYYY(str: string): Date | null {
  if (!str) return null;
  const parts = str.split(/[-/]/);
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (isNaN(date.getTime())) return null;
  return date;
}

export function toISODate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function todayDDMMYYYY(): string {
  return formatDateDDMMYYYY(new Date());
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
