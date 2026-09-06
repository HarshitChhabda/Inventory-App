/**
 * Returns true if the unit allows only whole numbers (integer quantities).
 * Count-based units (pieces, bags, bales, etc.) should not accept decimals.
 * Measurement units (meters, liters, kg, etc.) allow decimals.
 */
export function isIntegerOnlyUnit(unitName: string | null | undefined): boolean {
  if (!unitName) return false;
  const name = unitName.trim().toLowerCase();

  // Count units (integer only)
  const countUnits = ['piece', 'pc', 'pcs', 'bale', 'file', 'box', 'bottle', 'packet', 'roll', 'carton', 'set', 'pair', 'bag', 'sack', 'plate', 'glass', 'cup', 'unit', 'no', 'nos'];

  // Measurement units (allow decimals)
  const measureUnits = ['meter', 'mtr', 'litre', 'liter', 'ltr', 'kg', 'kgs', 'gm', 'gms', 'gram', 'tons', 'ton', 'quintal', 'qtl', 'foot', 'ft', 'inch', 'in', 'cm', 'mm', 'ml'];

  // Check if it's a measurement unit (allow decimals)
  if (measureUnits.some(u => name.includes(u))) {
    return false;
  }

  // Check if it's a count unit (integer only)
  if (countUnits.some(u => name.includes(u))) {
    return true;
  }

  // Default: allow decimals for unknown units
  return false;
}

/**
 * Validates and adjusts quantity based on unit type.
 * Returns the adjusted quantity (rounded to integer if unit is count-based).
 */
export function validateQuantity(quantity: number, unitName: string | null | undefined): number {
  if (isIntegerOnlyUnit(unitName)) {
    return Math.round(quantity);
  }
  return quantity;
}
