import { PrismaClient } from '@prisma/client';

export interface IntegrityCheckResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  count?: number;
}

export class DataIntegrityService {
  constructor(private prisma: PrismaClient) {}

  async runFullAudit(companyId: number): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];
    results.push(await this.checkNegativeStock(companyId));
    results.push(await this.checkOrphanTransactions(companyId));
    results.push(await this.checkOrphanAssets(companyId));
    results.push(await this.checkDuplicateVouchers(companyId));
    results.push(await this.checkStockLedgerSync(companyId));
    results.push(await this.checkOrphanLedgerEntries(companyId));
    results.push(await this.checkVoucherSequenceIntegrity(companyId));
    results.push(await this.checkFinancialYearIntegrity(companyId));
    results.push(await this.checkDuplicateSerialNumbers(companyId));
    results.push(await this.checkReferentialIntegrity(companyId));
    return results;
  }

  async checkNegativeStock(companyId: number): Promise<IntegrityCheckResult> {
    const negativeItems = await this.prisma.$queryRaw`
      SELECT itemId, storeId, CAST(SUM(quantityIn) - SUM(quantityOut) AS TEXT) as balance
      FROM LedgerEntry
      WHERE companyId = ${companyId}
      GROUP BY itemId, storeId
      HAVING balance < 0
    ` as any[];
    return {
      check: 'Negative Stock',
      status: negativeItems.length > 0 ? 'FAIL' : 'PASS',
      details: negativeItems.length > 0
        ? `${negativeItems.length} item(s) have negative stock`
        : 'No negative stock found',
      count: negativeItems.length,
    };
  }

  async checkOrphanTransactions(companyId: number): Promise<IntegrityCheckResult> {
    const orphans = await this.prisma.transactionHeader.findMany({
      where: {
        companyId,
        details: { none: {} },
      },
    });
    return {
      check: 'Orphan Transactions',
      status: orphans.length > 0 ? 'FAIL' : 'PASS',
      details: orphans.length > 0
        ? `${orphans.length} transaction(s) have no items`
        : 'All transactions have items',
      count: orphans.length,
    };
  }

  async checkOrphanAssets(companyId: number): Promise<IntegrityCheckResult> {
    const orphans = await this.prisma.$queryRaw`
      SELECT si.id FROM SerializedItem si
      JOIN Item i ON si.itemId = i.id
      JOIN ItemCategory ic ON i.categoryId = ic.id
      JOIN Store s ON ic.storeId = s.id
      WHERE s.companyId = ${companyId}
      AND si.status = 'AVAILABLE'
      AND si.serialNumber NOT IN (
        SELECT DISTINCT serialNumber FROM TransactionDetail WHERE serialNumber IS NOT NULL
      )
    ` as any[];
    return {
      check: 'Orphan Assets',
      status: orphans.length > 0 ? 'WARNING' : 'PASS',
      details: orphans.length > 0
        ? `${orphans.length} serialized item(s) not linked to any transaction`
        : 'No orphan assets found',
      count: orphans.length,
    };
  }

  async checkDuplicateVouchers(companyId: number): Promise<IntegrityCheckResult> {
    const duplicates = await this.prisma.$queryRaw`
      SELECT voucherNo, COUNT(*) as cnt
      FROM TransactionHeader
      WHERE companyId = ${companyId}
      GROUP BY voucherNo
      HAVING cnt > 1
    ` as any[];
    return {
      check: 'Duplicate Vouchers',
      status: duplicates.length > 0 ? 'FAIL' : 'PASS',
      details: duplicates.length > 0
        ? `${duplicates.length} duplicate voucher number(s) found`
        : 'No duplicate voucher numbers',
      count: duplicates.length,
    };
  }

  async checkStockLedgerSync(companyId: number): Promise<IntegrityCheckResult> {
    const mismatches = await this.prisma.$queryRaw`
      SELECT * FROM (
        SELECT th.id as txId, th.voucherNo,
          (SELECT COALESCE(CAST(SUM(td.quantity) AS TEXT), 0) FROM TransactionDetail td WHERE td.transactionId = th.id) as txQty,
          (SELECT COALESCE(CAST(SUM(le.quantityIn - le.quantityOut) AS TEXT), 0) FROM LedgerEntry le WHERE le.transactionId = th.id) as ledgerQty
        FROM TransactionHeader th
        WHERE th.companyId = ${companyId}
        AND th.approvalStatus = 'APPROVED'
      ) sub
      WHERE txQty != ledgerQty
    ` as any[];
    return {
      check: 'Stock-Ledger Sync',
      status: mismatches.length > 0 ? 'FAIL' : 'PASS',
      details: mismatches.length > 0
        ? `${mismatches.length} transaction(s) have mismatched stock/ledger`
        : 'Stock and ledger are in sync',
      count: mismatches.length,
    };
  }

  async checkOrphanLedgerEntries(companyId: number): Promise<IntegrityCheckResult> {
    const orphans = await this.prisma.$queryRaw`
      SELECT le.id FROM LedgerEntry le
      WHERE le.companyId = ${companyId}
      AND le.transactionId IS NOT NULL
      AND le.transactionId NOT IN (SELECT id FROM TransactionHeader)
    ` as any[];
    return {
      check: 'Orphan Ledger Entries',
      status: orphans.length > 0 ? 'FAIL' : 'PASS',
      details: orphans.length > 0
        ? `${orphans.length} ledger entry(ies) reference non-existent transactions`
        : 'No orphan ledger entries',
      count: orphans.length,
    };
  }

  async checkVoucherSequenceIntegrity(companyId: number): Promise<IntegrityCheckResult> {
    const sequences = await this.prisma.voucherSequence.findMany({ where: { companyId } });
    const issues: string[] = [];
    for (const seq of sequences) {
      if (seq.lastNumber < 0) issues.push(`${seq.voucherType}: invalid lastNumber ${seq.lastNumber}`);
    }
    return {
      check: 'Voucher Sequence Integrity',
      status: issues.length > 0 ? 'FAIL' : 'PASS',
      details: issues.length > 0 ? issues.join('; ') : 'All voucher sequences are valid',
      count: issues.length,
    };
  }

  async checkFinancialYearIntegrity(companyId: number): Promise<IntegrityCheckResult> {
    const fys = await this.prisma.financialYear.findMany({ where: { companyId }, orderBy: { startDate: 'asc' } });
    const issues: string[] = [];
    for (let i = 0; i < fys.length; i++) {
      if (i > 0 && fys[i].startDate <= fys[i - 1].endDate) {
        issues.push(`FY "${fys[i].label}" overlaps with "${fys[i - 1].label}"`);
      }
      if (fys[i].isClosed && !fys[i].closedAt) {
        issues.push(`FY "${fys[i].label}" is closed but missing closedAt`);
      }
    }
    return {
      check: 'Financial Year Integrity',
      status: issues.length > 0 ? 'FAIL' : 'PASS',
      details: issues.length > 0 ? issues.join('; ') : 'All financial years are valid',
      count: issues.length,
    };
  }

  async checkDuplicateSerialNumbers(companyId: number): Promise<IntegrityCheckResult> {
    const duplicates = await this.prisma.$queryRaw`
      SELECT serialNumber, COUNT(*) as cnt
      FROM SerializedItem si
      JOIN Item i ON si.itemId = i.id
      JOIN ItemCategory ic ON i.categoryId = ic.id
      JOIN Store s ON ic.storeId = s.id
      WHERE s.companyId = ${companyId} AND si.serialNumber IS NOT NULL
      GROUP BY serialNumber
      HAVING cnt > 1
    ` as any[];
    return {
      check: 'Duplicate Serial Numbers',
      status: duplicates.length > 0 ? 'FAIL' : 'PASS',
      details: duplicates.length > 0
        ? `${duplicates.length} duplicate serial number(s) found`
        : 'No duplicate serial numbers',
      count: duplicates.length,
    };
  }

  async checkReferentialIntegrity(companyId: number): Promise<IntegrityCheckResult> {
    const issues: string[] = [];
    const orphanRooms = await this.prisma.$queryRaw`
      SELECT r.id FROM Room r
      JOIN Location l ON r.locationId = l.id
      JOIN Store s ON l.storeId = s.id
      WHERE s.companyId != ${companyId}
    ` as any[];
    if (orphanRooms.length > 0) issues.push(`${orphanRooms.length} rooms with invalid location`);
    return {
      check: 'Referential Integrity',
      status: issues.length > 0 ? 'FAIL' : 'PASS',
      details: issues.length > 0 ? issues.join('; ') : 'Referential integrity is intact',
      count: issues.length,
    };
  }

  async getAuditSummary(companyId: number) {
    const checks = await this.runFullAudit(companyId);
    const passed = checks.filter((c) => c.status === 'PASS').length;
    const failed = checks.filter((c) => c.status === 'FAIL').length;
    const warnings = checks.filter((c) => c.status === 'WARNING').length;
    return { total: checks.length, passed, failed, warnings, checks };
  }
}
