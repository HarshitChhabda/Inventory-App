/**
 * Returns true if the unit allows only whole numbers (integer quantities).
 * Count-based units (pieces, bags, bales, etc.) should not accept decimals.
 * Measurement units (meters, liters, kg, etc.) allow decimals.
 */
export function isIntegerOnlyUnit(unitName: string | null | undefined): boolean {
  if (!unitName) return false;
  const name = unitName.trim().toLowerCase();

  // Hindi count units
  const hindiCountUnits = ['नग', 'पीस', 'बैल', 'फाइल', 'डिब्बा', 'बोतल', 'पैकेट', 'रोल', 'गत्ता', 'सेट', 'जोड़ी', 'कट्टा', 'थैला', 'प्लेट', 'गिलास', 'कप', 'पानी', 'मग'];

  // English count units
  const englishCountUnits = ['piece', 'pc', 'pcs', 'bale', 'file', 'box', 'bottle', 'packet', 'roll', 'carton', 'set', 'pair', 'bag', 'sack', 'plate', 'glass', 'cup', 'unit', 'no', 'nos'];

  // Hindi measurement units (allow decimals)
  const hindiMeasureUnits = ['मीटर', 'लीटर', 'किलो', 'ग्राम', 'टन', 'क्विंटल', 'फुट', 'इंच', 'सेंटीमीटर', 'मिलीमीटर', 'मिलीलीटर'];

  // English measurement units (allow decimals)
  const englishMeasureUnits = ['meter', 'mtr', 'litre', 'liter', 'ltr', 'kg', 'kgs', 'gm', 'gms', 'gram', 'tons', 'ton', 'quintal', 'qtl', 'foot', 'ft', 'inch', 'in', 'cm', 'mm', 'ml'];

  // Check if it's a measurement unit (allow decimals)
  if (hindiMeasureUnits.some(u => name.includes(u)) || englishMeasureUnits.some(u => name.includes(u))) {
    return false;
  }

  // Check if it's a count unit (integer only)
  if (hindiCountUnits.some(u => name.includes(u)) || englishCountUnits.some(u => name.includes(u))) {
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
