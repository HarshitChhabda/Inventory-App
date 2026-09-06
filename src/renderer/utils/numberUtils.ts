export function toNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  if (typeof value === 'string') { const n = Number(value); return isNaN(n) ? fallback : n; }
  if (typeof value === 'object' && value !== null && 's' in value && 'e' in value && 'd' in value) {
    const sign = value.s === -1 ? -1 : 1;
    const digits = value.d.join('');
    const exp = value.e;
    const num = parseFloat(digits) * Math.pow(10, exp - (digits.length - 1));
    const result = sign * num;
    return isNaN(result) ? fallback : result;
  }
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export function safeFixed(value: any, decimals: number = 2, fallback: number = 0): string {
  return safeNumber(value, fallback).toFixed(decimals);
}

export function safeSum(arr: any[], key: string): number {
  return arr.reduce((sum, item) => sum + safeNumber(item[key]), 0);
}
