import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { TransactionEngine } from './transactionEngine.service';

// ============================================================
// TYPES
// ============================================================

export interface BulkOperationResult {
  success: boolean;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  transactionIds: number[];
  errors: BulkError[];
  warnings: string[];
  summary: string;
}

export interface BulkError {
  index: number;
  itemId?: number;
  itemName?: string;
  error: string;
  severity: 'error' | 'warning';
}

export interface BulkTransferInput {
  companyId: number;
  financialYearId: number;
  fromStoreId: number;
  toStoreId: number;
  transactionDate: Date;
  items: Array<{
    itemId: number;
    quantity: number;
    fromLocationId?: number;
    toLocationId?: number;
    remarks?: string;
  }>;
  remarks?: string;
  createdBy: string;
}

export interface BulkIssueInput {
  companyId: number;
  financialYearId: number;
  storeId: number;
  toStoreId?: number;
  departmentId?: number;
  transactionDate: Date;
  items: Array<{
    itemId: number;
    quantity: number;
    locationId?: number;
    purpose?: string;
    remarks?: string;
  }>;
  remarks?: string;
  createdBy: string;
}

export interface BulkReturnInput {
  companyId: number;
  financialYearId: number;
  storeId: number;
  departmentId: number;
  transactionDate: Date;
  items: Array<{
    itemId: number;
    quantity: number;
    locationId?: number;
    remarks?: string;
  }>;
  remarks?: string;
  createdBy: string;
}

export interface BulkInstallInput {
  companyId: number;
  financialYearId: number;
  storeId: number;
  locationId: number;
  transactionDate: Date;
  items: Array<{
    itemId: number;
    quantity: number;
    roomId?: number;
    departmentId?: number;
    remarks?: string;
  }>;
  remarks?: string;
  createdBy: string;
}

export interface BulkUninstallInput {
  companyId: number;
  financialYearId: number;
  storeId: number;
  transactionDate: Date;
  items: Array<{
    itemId: number;
    quantity: number;
    installationId?: number;
    remarks?: string;
  }>;
  remarks?: string;
  createdBy: string;
}

export interface BulkDamageInput {
  companyId: number;
  financialYearId: number;
  storeId: number;
  transactionDate: Date;
  items: Array<{
    itemId: number;
    quantity: number;
    reason: string;
    damageType: string;
    locationId?: number;
    remarks?: string;
  }>;
  remarks?: string;
  createdBy: string;
}

export interface BulkAssetAssignmentInput {
  companyId: number;
  transactionDate: Date;
  assignments: Array<{
    assetId: number;
    storeId: number;
    locationId?: number;
    roomId?: number;
    departmentId?: number;
    assignedTo?: string;
    remarks?: string;
  }>;
  createdBy: string;
}

export interface BulkApprovalInput {
  companyId: number;
  transactionIds: number[];
  approvedBy: string;
  action: 'approve' | 'reject';
  reason?: string;
}

// ============================================================
// BULK OPERATIONS SERVICE
// ============================================================

export class BulkOperationsService {
  private engine: TransactionEngine;
  constructor(private prisma: PrismaClient) {
    this.engine = new TransactionEngine(prisma);
  }

  // ------------------------------------------------------------
  // HELPER: GENERATE VOUCHER NUMBER
  // ------------------------------------------------------------

  private async generateVoucherNo(
    companyId: number,
    financialYearId: number,
    voucherType: string
  ): Promise<string> {
    const sequence = await this.prisma.voucherSequence.findFirst({
      where: { companyId, financialYearId, voucherType },
    });

    if (sequence) {
      const nextNo = sequence.lastNumber + 1;
      await this.prisma.voucherSequence.update({
        where: { id: sequence.id },
        data: { lastNumber: nextNo },
      });
      return `${voucherType}-${String(nextNo).padStart(6, '0')}`;
    }

    // Create new sequence
    await this.prisma.voucherSequence.create({
      data: {
        companyId,
        financialYearId,
        voucherType,
        lastNumber: 1,
      },
    });
    return `${voucherType}-000001`;
  }

  // ------------------------------------------------------------
  // BULK TRANSFER (atomic batch)
  // ------------------------------------------------------------

  async bulkTransfer(input: BulkTransferInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];

    try {
      const bulkInputs = input.items.map((item) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        movementType: 'TC',
        transactionDate: input.transactionDate,
        fromStoreId: input.fromStoreId,
        toStoreId: input.toStoreId,
        fromLocationId: item.fromLocationId,
        toLocationId: item.toLocationId,
        remarks: item.remarks || input.remarks || 'Bulk Transfer',
        createdBy: input.createdBy,
        initialStatus: 'POSTED' as const,
        items: [{ itemId: item.itemId, quantity: item.quantity }],
      }));

      const batchResult = await this.engine.createBulkMovements(bulkInputs);

      if (batchResult.failedIndex >= 0) {
        // Validation failed — entire batch rolled back
        errors.push({
          index: batchResult.failedIndex,
          itemId: input.items[batchResult.failedIndex].itemId,
          error: batchResult.error,
          severity: 'error',
        });
      } else {
        // All succeeded
        for (const r of batchResult.results) {
          transactionIds.push(r.transactionId);
        }
      }
    } catch (err) {
      errors.push({
        index: 0,
        error: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });
    }

    return {
      success: errors.length === 0,
      totalItems: input.items.length,
      processedItems: transactionIds.length,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk transfer: ${transactionIds.length}/${input.items.length} items processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK ISSUE (atomic batch)
  // ------------------------------------------------------------

  async bulkIssue(input: BulkIssueInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];

    try {
      const bulkInputs = input.items.map((item) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        movementType: 'IC',
        transactionDate: input.transactionDate,
        fromStoreId: input.storeId,
        toStoreId: input.toStoreId || input.departmentId,
        fromLocationId: item.locationId,
        purpose: item.purpose,
        remarks: item.remarks || input.remarks || 'Bulk Issue',
        createdBy: input.createdBy,
        initialStatus: 'POSTED' as const,
        items: [{ itemId: item.itemId, quantity: item.quantity }],
      }));

      const batchResult = await this.engine.createBulkMovements(bulkInputs);

      if (batchResult.failedIndex >= 0) {
        errors.push({
          index: batchResult.failedIndex,
          itemId: input.items[batchResult.failedIndex].itemId,
          error: batchResult.error,
          severity: 'error',
        });
      } else {
        for (const r of batchResult.results) {
          transactionIds.push(r.transactionId);
        }
      }
    } catch (err) {
      errors.push({
        index: 0,
        error: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });
    }

    return {
      success: errors.length === 0,
      totalItems: input.items.length,
      processedItems: transactionIds.length,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk issue: ${transactionIds.length}/${input.items.length} items processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK RETURN (atomic batch)
  // ------------------------------------------------------------

  async bulkReturn(input: BulkReturnInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];

    try {
      const bulkInputs = input.items.map((item) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        movementType: 'DR',
        transactionDate: input.transactionDate,
        toStoreId: input.storeId,
        toLocationId: item.locationId,
        remarks: item.remarks || input.remarks || 'Bulk Return',
        createdBy: input.createdBy,
        initialStatus: 'POSTED' as const,
        items: [{ itemId: item.itemId, quantity: item.quantity }],
      }));

      const batchResult = await this.engine.createBulkMovements(bulkInputs);

      if (batchResult.failedIndex >= 0) {
        errors.push({
          index: batchResult.failedIndex,
          itemId: input.items[batchResult.failedIndex].itemId,
          error: batchResult.error,
          severity: 'error',
        });
      } else {
        for (const r of batchResult.results) {
          transactionIds.push(r.transactionId);
        }
      }
    } catch (err) {
      errors.push({
        index: 0,
        error: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });
    }

    return {
      success: errors.length === 0,
      totalItems: input.items.length,
      processedItems: transactionIds.length,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk return: ${transactionIds.length}/${input.items.length} items processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK INSTALL (atomic batch)
  // ------------------------------------------------------------

  async bulkInstall(input: BulkInstallInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];

    try {
      const bulkInputs = input.items.map((item) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        movementType: 'IS',
        transactionDate: input.transactionDate,
        fromStoreId: input.storeId,
        toLocationId: item.roomId || input.locationId,
        remarks: item.remarks || input.remarks || 'Bulk Install',
        createdBy: input.createdBy,
        initialStatus: 'POSTED' as const,
        items: [{ itemId: item.itemId, quantity: item.quantity }],
      }));

      const batchResult = await this.engine.createBulkMovements(bulkInputs);

      if (batchResult.failedIndex >= 0) {
        errors.push({
          index: batchResult.failedIndex,
          itemId: input.items[batchResult.failedIndex].itemId,
          error: batchResult.error,
          severity: 'error',
        });
      } else {
        for (const r of batchResult.results) {
          transactionIds.push(r.transactionId);
        }
      }
    } catch (err) {
      errors.push({
        index: 0,
        error: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });
    }

    return {
      success: errors.length === 0,
      totalItems: input.items.length,
      processedItems: transactionIds.length,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk install: ${transactionIds.length}/${input.items.length} items processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK UNINSTALL (atomic batch)
  // ------------------------------------------------------------

  async bulkUninstall(input: BulkUninstallInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];

    try {
      const bulkInputs = input.items.map((item) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        movementType: 'UN',
        transactionDate: input.transactionDate,
        fromStoreId: input.storeId,
        remarks: item.remarks || input.remarks || 'Bulk Uninstall',
        createdBy: input.createdBy,
        initialStatus: 'POSTED' as const,
        items: [{ itemId: item.itemId, quantity: item.quantity }],
      }));

      const batchResult = await this.engine.createBulkMovements(bulkInputs);

      if (batchResult.failedIndex >= 0) {
        errors.push({
          index: batchResult.failedIndex,
          itemId: input.items[batchResult.failedIndex].itemId,
          error: batchResult.error,
          severity: 'error',
        });
      } else {
        for (const r of batchResult.results) {
          transactionIds.push(r.transactionId);
        }
      }
    } catch (err) {
      errors.push({
        index: 0,
        error: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });
    }

    return {
      success: errors.length === 0,
      totalItems: input.items.length,
      processedItems: transactionIds.length,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk uninstall: ${transactionIds.length}/${input.items.length} items processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK DAMAGE (atomic batch)
  // ------------------------------------------------------------

  async bulkDamage(input: BulkDamageInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];

    try {
      const bulkInputs = input.items.map((item) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        movementType: 'DM',
        transactionDate: input.transactionDate,
        fromStoreId: input.storeId,
        fromLocationId: item.locationId,
        remarks: `${item.damageType}: ${item.reason}${item.remarks ? ' - ' + item.remarks : ''}`,
        createdBy: input.createdBy,
        initialStatus: 'POSTED' as const,
        items: [{ itemId: item.itemId, quantity: item.quantity, condition: item.damageType }],
      }));

      const batchResult = await this.engine.createBulkMovements(bulkInputs);

      if (batchResult.failedIndex >= 0) {
        errors.push({
          index: batchResult.failedIndex,
          itemId: input.items[batchResult.failedIndex].itemId,
          error: batchResult.error,
          severity: 'error',
        });
      } else {
        for (const r of batchResult.results) {
          transactionIds.push(r.transactionId);
        }
      }
    } catch (err) {
      errors.push({
        index: 0,
        error: err instanceof Error ? err.message : String(err),
        severity: 'error',
      });
    }

    return {
      success: errors.length === 0,
      totalItems: input.items.length,
      processedItems: transactionIds.length,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk damage: ${transactionIds.length}/${input.items.length} items processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK ASSET ASSIGNMENT
  // ------------------------------------------------------------

  async bulkAssetAssignment(input: BulkAssetAssignmentInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];
    let processed = 0;

    // Batch: fetch all assets in one query
    const assetIds = input.assignments.map((a) => a.assetId);
    const assets = await this.prisma.assetProfile.findMany({
      where: { id: { in: assetIds } },
    });
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    // Batch: update all assets and create timeline events
    const validAssignments: typeof input.assignments = [];
    for (let i = 0; i < input.assignments.length; i++) {
      const assignment = input.assignments[i];
      const asset = assetMap.get(assignment.assetId);
      if (!asset) {
        errors.push({
          index: i,
          itemId: assignment.assetId,
          error: `Asset not found with ID: ${assignment.assetId}`,
          severity: 'error',
        });
      } else {
        validAssignments.push(assignment);
      }
    }

    if (validAssignments.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.assetProfile.updateMany({
          where: { id: { in: validAssignments.map((a) => a.assetId) } },
          data: {}, // Will update individually below
        });
        for (const assignment of validAssignments) {
          await tx.assetProfile.update({
            where: { id: assignment.assetId },
            data: {
              currentStoreId: assignment.storeId,
              currentLocationId: assignment.locationId,
            },
          });
        }
        await tx.assetTimeline.createMany({
          data: validAssignments.map((a) => ({
            assetId: a.assetId,
            eventType: 'TRANSFER',
            eventDate: input.transactionDate,
            remarks: `Assigned to store ${a.storeId}${a.assignedTo ? ' by ' + a.assignedTo : ''}${a.remarks ? ' - ' + a.remarks : ''}`,
            performedBy: a.assignedTo || input.createdBy,
          })),
        });
      });
      processed = validAssignments.length;
    }

    return {
      success: errors.length === 0,
      totalItems: input.assignments.length,
      processedItems: processed,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk asset assignment: ${processed}/${input.assignments.length} assets assigned`,
    };
  }

  // ------------------------------------------------------------
  // BULK APPROVAL
  // ------------------------------------------------------------

  async bulkApproval(input: BulkApprovalInput): Promise<BulkOperationResult> {
    const errors: BulkError[] = [];
    const warnings: string[] = [];
    const transactionIds: number[] = [];
    let processed = 0;

    // Batch: fetch all transactions in one query
    const headers = await this.prisma.transactionHeader.findMany({
      where: { id: { in: input.transactionIds } },
    });
    const headerMap = new Map(headers.map((h) => [h.id, h]));

    const toUpdate: number[] = [];
    for (let i = 0; i < input.transactionIds.length; i++) {
      const txId = input.transactionIds[i];
      const tx = headerMap.get(txId);
      if (!tx) {
        errors.push({
          index: i,
          error: `Transaction not found with ID: ${txId}`,
          severity: 'error',
        });
      } else if (tx.approvalStatus !== 'PENDING') {
        warnings.push(`Transaction ${txId} is not in PENDING status (current: ${tx.approvalStatus})`);
      } else {
        toUpdate.push(txId);
      }
    }

    if (toUpdate.length > 0) {
      const newStatus = input.action === 'approve' ? 'APPROVED' : 'REJECTED';
      await this.prisma.transactionHeader.updateMany({
        where: { id: { in: toUpdate } },
        data: {
          approvalStatus: newStatus,
          approvedBy: input.approvedBy,
          approvedAt: new Date(),
        },
      });
      transactionIds.push(...toUpdate);
      processed = toUpdate.length;
    }

    return {
      success: errors.length === 0,
      totalItems: input.transactionIds.length,
      processedItems: processed,
      failedItems: errors.length,
      transactionIds,
      errors,
      warnings,
      summary: `Bulk ${input.action}: ${processed}/${input.transactionIds.length} transactions processed`,
    };
  }

  // ------------------------------------------------------------
  // BULK EXPORT OPERATIONS REPORT
  // ------------------------------------------------------------

  async exportBulkReport(
    result: BulkOperationResult,
    operationType: string
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mahaveerji Inventory';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Bulk Operation Report');

    // Header
    ws.addRow([`BULK ${operationType.toUpperCase()} REPORT`]);
    ws.addRow([`Date: ${new Date().toLocaleDateString()}`]);
    ws.addRow([`Summary: ${result.summary}`]);
    ws.addRow([]);

    // Summary row
    ws.addRow(['Total Items', 'Processed', 'Failed', 'Success Rate']);
    ws.addRow([
      result.totalItems,
      result.processedItems,
      result.failedItems,
      `${result.totalItems > 0 ? ((result.processedItems / result.totalItems) * 100).toFixed(1) : 0}%`,
    ]);
    ws.addRow([]);

    // Errors section
    if (result.errors.length > 0) {
      const errorRowNum = ws.lastRow ? ws.lastRow.number + 1 : 1;
      ws.addRow(['ERRORS']);
      const errorHeaderRow = ws.getRow(errorRowNum);
      errorHeaderRow.font = { bold: true, color: { argb: 'FFFF0000' } };
      ws.addRow(['Row', 'Item ID', 'Error', 'Severity']);
      for (const error of result.errors) {
        ws.addRow([error.index + 1, error.itemId || '-', error.error, error.severity]);
      }
    }

    // Style
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.getRow(5).font = { bold: true };
    ws.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    ws.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const exportDir = path.join(app.getPath('userData'), 'InventoryData', 'exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    const filePath = path.join(exportDir, `bulk-${operationType.toLowerCase()}-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }
}
