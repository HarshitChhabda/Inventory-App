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
