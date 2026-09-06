import { PrismaClient } from '@prisma/client';

// ============================================================
// ALL VOUCHER TYPES
// ============================================================
// Every movement type maps to a voucher type.
// Voucher numbers are auto-generated per company, FY, and type.

export type VoucherType =
  | 'RC' | 'OB' | 'IC' | 'TC' | 'IS' | 'UN' | 'SH' | 'DS' | 'DP'
  | 'DM' | 'RO' | 'RI' | 'VR' | 'DR' | 'RP' | 'SF' | 'AD' | 'CF' | 'RV';

const VOUCHER_PREFIXES: Record<VoucherType, string> = {
  RC: 'RC',  // Purchase Receipt
  OB: 'OB',  // Opening Balance
  IC: 'IC',  // Issue to Department
  TC: 'TR',  // Store Transfer
  IS: 'IS',  // Installation
  UN: 'UN',  // Uninstallation
  SH: 'SH',  // Room Shift
  DS: 'DS',  // Dharmshala Shift
  DP: 'DP',  // Department Shift
  DM: 'DM',  // Damage
  RO: 'RO',  // Repair Out
  RI: 'RI',  // Repair In
  VR: 'VR',  // Vendor Return
  DR: 'DR',  // Department Return
  RP: 'RP',  // Replacement
  SF: 'SF',  // Scrap
  AD: 'AD',  // Stock Adjustment
  CF: 'CF',  // Carry Forward
  RV: 'RV',  // Reversal
};

/**
 * VOUCHER ENGINE
 *
 * Auto-generates unique voucher numbers per company, financial year, and type.
 * Format: PREFIX-YYYY-NNNNNN (e.g., RC-2026-000001)
 *
 * Uses atomic upsert to prevent race conditions.
 * No duplicate vouchers allowed.
 */
export class VoucherEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate next voucher number for a given type.
   * Uses atomic upsert to prevent race conditions.
   */
  async generateVoucherNo(
    companyId: number,
    financialYearId: number,
    voucherType: VoucherType,
  ): Promise<string> {
    const prefix = VOUCHER_PREFIXES[voucherType];
    if (!prefix) throw new Error(`Unknown voucher type: ${voucherType}`);

    const sequence = await this.prisma.voucherSequence.upsert({
      where: {
        companyId_financialYearId_voucherType: {
          companyId,
          financialYearId,
          voucherType,
        },
      },
      update: { lastNumber: { increment: 1 } },
      create: { companyId, financialYearId, voucherType, lastNumber: 1 },
    });

    const fy = await this.prisma.financialYear.findUnique({ where: { id: financialYearId } });
    const year = fy ? new Date(fy.startDate).getFullYear() : new Date().getFullYear();

    return `${prefix}-${year}-${String(sequence.lastNumber).padStart(6, '0')}`;
  }

  /**
   * Validate voucher number uniqueness.
   */
  async validateVoucherNo(
    companyId: number,
    financialYearId: number,
    voucherNo: string,
    excludeId?: number,
  ): Promise<boolean> {
    const where: any = { companyId, financialYearId, voucherNo };
    if (excludeId) where.id = { not: excludeId };

    const count = await this.prisma.transactionHeader.count({ where });
    return count === 0;
  }

  /**
   * Get current sequence number for a voucher type.
   */
  async getCurrentSequence(
    companyId: number,
    financialYearId: number,
    voucherType: VoucherType,
  ): Promise<number> {
    const sequence = await this.prisma.voucherSequence.findUnique({
      where: {
        companyId_financialYearId_voucherType: {
          companyId,
          financialYearId,
          voucherType,
        },
      },
    });
    return sequence?.lastNumber || 0;
  }

  /**
   * Preview next voucher number (without incrementing).
   */
  async previewNextVoucherNo(
    companyId: number,
    financialYearId: number,
    voucherType: VoucherType,
  ): Promise<string> {
    const prefix = VOUCHER_PREFIXES[voucherType];
    if (!prefix) throw new Error(`Unknown voucher type: ${voucherType}`);

    const sequence = await this.prisma.voucherSequence.findUnique({
      where: {
        companyId_financialYearId_voucherType: {
          companyId,
          financialYearId,
          voucherType,
        },
      },
    });

    const fy = await this.prisma.financialYear.findUnique({ where: { id: financialYearId } });
    const year = fy ? new Date(fy.startDate).getFullYear() : new Date().getFullYear();
    const nextNumber = (sequence?.lastNumber || 0) + 1;

    return `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Get all voucher type prefixes.
   */
  getPrefixes(): Record<VoucherType, string> {
    return { ...VOUCHER_PREFIXES };
  }

  /**
   * Check if a voucher type is valid.
   */
  isValidType(type: string): type is VoucherType {
    return type in VOUCHER_PREFIXES;
  }
}
