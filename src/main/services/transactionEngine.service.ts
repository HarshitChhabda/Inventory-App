import { PrismaClient, Prisma } from '@prisma/client';
import { VoucherEngine, VoucherType } from './voucherEngine.service';
import { MovementRegistry, MovementTypeConfig, SourceType, DestinationType } from './movementRegistry.service';
import { SystemConfigurationService } from './systemConfiguration.service';
import { StockBalanceService } from './stockBalance.service';
import { StockMonthlySummaryService } from './stockMonthlySummary.service';

// ============================================================
// TYPES
// ============================================================

export type MovementType =
  | 'OPENING_BALANCE' | 'PURCHASE_RECEIPT' | 'ISSUE_OUT' | 'ISSUE_IN'
  | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'INSTALL_OUT' | 'INSTALL_IN'
  | 'SHIFT_OUT' | 'SHIFT_IN' | 'DAMAGE_OUT' | 'DAMAGE_IN'
  | 'REPAIR_OUT' | 'REPAIR_IN' | 'RETURN_OUT' | 'RETURN_IN'
  | 'REPLACEMENT_OUT' | 'REPLACEMENT_IN' | 'ADJUSTMENT_PLUS' | 'ADJUSTMENT_MINUS'
  | 'SCRAP_OUT' | 'VENDOR_RETURN' | 'REVERSAL' | 'CARRY_FORWARD';

export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'POSTED' | 'REVERSED' | 'IN_TRANSIT';

// Backward compatibility aliases
export type CreateTransactionInput = CreateMovementInput;
export type TransactionResult = MovementResult;

export interface TransactionItem {
  itemId: number;
  quantity: number;
  rate?: number;
  unitId?: number;
  serialNumber?: string;
  batchNumber?: string;
  condition?: string;
  warrantyExpiry?: Date;
  fromLocationId?: number;
  toLocationId?: number;
  remarks?: string;
}

export interface CreateMovementInput {
  companyId: number;
  financialYearId: number;
  movementType?: string;
  voucherType?: string;
  transactionDate: Date;
  invoiceDate?: Date | null;
  fromStoreId?: number;
  toStoreId?: number;
  fromLocationId?: number;
  toLocationId?: number;
  toRoomId?: number;
  vendorId?: number;
  reasonId?: number;
  departmentId?: number;
  referenceNo?: string;
  vehicleNumber?: string;
  receivedBy?: string;
  issuedBy?: string;
  purpose?: string;
  remarks?: string;
  createdBy: string;
  items: TransactionItem[];
  // Workflow
  initialStatus?: ApprovalStatus;
  // Metadata
  ipAddress?: string;
  device?: string;
}

export interface MovementResult {
  success: boolean;
  transactionId: number;
  voucherNo: string;
  voucherType: string;
  ledgerEntries: number;
  stockUpdates: number;
  serialUpdates: number;
  auditLogId: number;
  message: string;
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// UNIVERSAL INVENTORY MOVEMENT ENGINE
// ============================================================

export class TransactionEngine {
  private voucherEngine: VoucherEngine;
  private registry: MovementRegistry;
  private configService: SystemConfigurationService;
  private stockBalanceService: StockBalanceService;
  private monthlySummaryService: StockMonthlySummaryService;

  constructor(private prisma: PrismaClient) {
    this.voucherEngine = new VoucherEngine(prisma);
    this.registry = new MovementRegistry(prisma);
    this.configService = new SystemConfigurationService(prisma);
    this.stockBalanceService = new StockBalanceService(prisma);
    this.monthlySummaryService = new StockMonthlySummaryService(prisma);
  }

  // ─── BACKWARD COMPATIBILITY ────────────────────

  /**
   * Backward-compatible alias for createMovement.
   */
  async createTransaction(input: CreateMovementInput): Promise<MovementResult> {
    return this.createMovement(input);
  }

  // ─── MAIN ENTRY POINT ──────────────────────────

  /**
   * Create a movement. This is the ONLY way stock changes in the system.
   *
   * Stock boundary rule: Store is the stock boundary. LedgerEntry is the
   * source of truth. Room is physical placement metadata, not a stock boundary.
   * Same-store Room-to-room shifts do NOT create ledger entries.
   *
   * Pipeline:
   * 1. Validate input
   * 2. Permission check
   * 3. Business rule check
   * 4. Stock validation
   * 5. Generate voucher
   * 6. Create transaction header + details
   * 7. Generate ledger entries
   * 8. Update installed assets
   * 9. Update serial numbers
   * 10. Create audit log
   * 11. Generate notification
   * 12. Commit
   */
  async createMovement(input: CreateMovementInput): Promise<MovementResult> {
    const warnings: string[] = [];
    // Backward compatibility: accept voucherType as movementType
    const movementType = input.movementType || input.voucherType || '';
    if (!movementType) {
      throw new Error('movementType is required');
    }
    const normalizedInput = { ...input, movementType };
    const movementConfig = await this.registry.getByCode(movementType);
    if (!movementConfig) {
      throw new Error(`Unknown movement type: ${input.movementType}`);
    }

    // ── STEP 1: Validate Input ──
    const inputValidation = await this.validateInput(normalizedInput, movementConfig);
    if (!inputValidation.valid) {
      throw new Error(inputValidation.errors.join('; '));
    }
    warnings.push(...inputValidation.warnings);

    // ── STEP 2: Permission Check ──
    await this.checkPermissions(normalizedInput, movementConfig);

    // ── STEP 3: Business Rule Check ──
    const businessValidation = await this.validateBusinessRules(normalizedInput, movementConfig);
    if (!businessValidation.valid) {
      throw new Error(businessValidation.errors.join('; '));
    }
    warnings.push(...businessValidation.warnings);

    // ── STEP 4: Stock Validation ──
    if (movementConfig.stockEffect.source === 'DECREASE' && normalizedInput.fromStoreId) {
      if (normalizedInput.fromStoreId !== normalizedInput.toStoreId) {
        await this.validateStock(normalizedInput, movementConfig);
      }
    }

    // ── STEP 5: Generate Voucher ──
    const voucherType = movementType as VoucherType;
    const voucherNo = await this.voucherEngine.generateVoucherNo(
      normalizedInput.companyId, normalizedInput.financialYearId, voucherType,
    );

    // ── STEP 5b: Determine initial status from approval configs ──
    let initialStatus = normalizedInput.initialStatus || 'POSTED';
    if (initialStatus === 'POSTED') {
      const movementCode = movementType;
      const [requireApproval, inTransit] = await Promise.all([
        (async () => {
          if (movementCode === 'RC') return this.configService.getBool(normalizedInput.companyId, 'APPROVAL.RECEIPT_APPROVAL');
          if (movementCode === 'IS') return this.configService.getBool(normalizedInput.companyId, 'APPROVAL.ISSUE_APPROVAL');
          if (movementCode === 'TC') {
            const [transferApproval, issueApproval] = await Promise.all([
              this.configService.getBool(normalizedInput.companyId, 'APPROVAL.TRANSFER_APPROVAL'),
              this.configService.getBool(normalizedInput.companyId, 'TRANSFER.REQUIRE_APPROVAL'),
            ]);
            return transferApproval || issueApproval;
          }
          return false;
        })(),
        movementCode === 'TC' ? this.configService.getBool(normalizedInput.companyId, 'TRANSFER.IN_TRANSIT_ENABLED') : Promise.resolve(false),
      ]);

      if (requireApproval) {
        initialStatus = inTransit ? 'IN_TRANSIT' : 'PENDING';
        warnings.push(`Movement requires approval — status set to ${initialStatus}`);
      }
    }

    // ── EXECUTE IN TRANSACTION ──
    const result = await this.prisma.$transaction(async (tx) => {
      // ── STEP 6: Create Transaction Header ──
      const header = await tx.transactionHeader.create({
        data: {
          companyId: normalizedInput.companyId,
          financialYearId: normalizedInput.financialYearId,
          voucherNo,
          voucherType: movementType,
          transactionDate: normalizedInput.transactionDate,
          invoiceDate: normalizedInput.invoiceDate || null,
          fromStoreId: normalizedInput.fromStoreId || null,
          toStoreId: normalizedInput.toStoreId || null,
          fromLocationId: normalizedInput.fromLocationId || null,
          toLocationId: normalizedInput.toLocationId || null,
          vendorId: normalizedInput.vendorId || null,
          reasonId: normalizedInput.reasonId || null,
          departmentId: normalizedInput.departmentId || null,
          referenceNo: normalizedInput.referenceNo || null,
          vehicleNumber: normalizedInput.vehicleNumber || null,
          receivedBy: normalizedInput.receivedBy || null,
          issuedBy: normalizedInput.issuedBy || null,
          purpose: normalizedInput.purpose || null,
          remarks: normalizedInput.remarks || null,
          createdBy: normalizedInput.createdBy,
          approvalStatus: initialStatus,
          postedBy: initialStatus === 'POSTED' ? normalizedInput.createdBy : null,
          postedAt: initialStatus === 'POSTED' ? new Date() : null,
        },
      });

      // ── STEP 7: Create Transaction Details (batch) ──
      const defaultCondition = await this.configService.get(normalizedInput.companyId, 'STOCK.DEFAULT_CONDITION') || 'GOOD';
      await tx.transactionDetail.createMany({
        data: normalizedInput.items.map((item) => ({
          transactionId: header.id,
          itemId: item.itemId,
          unitId: item.unitId || null,
          quantity: new Prisma.Decimal(item.quantity),
          rate: new Prisma.Decimal(item.rate || 0),
          amount: new Prisma.Decimal((item.rate || 0) * item.quantity),
          serialNumber: item.serialNumber || null,
          batchNumber: item.batchNumber || null,
          condition: item.condition || defaultCondition,
          warrantyExpiry: item.warrantyExpiry || null,
          fromLocationId: item.fromLocationId || null,
          toLocationId: item.toLocationId || null,
          remarks: item.remarks || null,
        })),
      });

      // ── STEP 8: Generate Ledger Entries ──
      // Skip ledger + installation for DRAFT — these are created by postTransaction()
      // Skip ledger for same-store Room→Room shifts (Room relocation, not stock movement)
      const isSameStoreRoomToRoom = await this.isSameStoreRoomToRoom(
        header.id, normalizedInput.companyId, normalizedInput.financialYearId,
        normalizedInput.fromStoreId || null, normalizedInput.toStoreId || null,
      );

      let ledgerCount = 0;
      if (initialStatus !== 'DRAFT' && !isSameStoreRoomToRoom) {
        ledgerCount = await this.createLedgerEntries(tx, header, normalizedInput, movementConfig);

        // ── STEP 9: Update Installed Assets ──
        await this.updateInstalledAssets(tx, header, normalizedInput, movementConfig);
      }

      // ── STEP 10: Update Serial Numbers ──
      const serialUpdates = await this.updateSerialNumbers(tx, header, normalizedInput, movementConfig);

      return {
        transactionId: header.id,
        voucherNo: header.voucherNo,
        ledgerEntries: ledgerCount,
        serialUpdates,
      };
    });

    // ── STEP 11: Create Audit Log ──
    const auditLog = await this.createAuditLog(normalizedInput, result, movementConfig);

    // ── STEP 12: Generate Notification ──
    await this.generateNotification(normalizedInput, result, movementConfig);

    return {
      success: true,
      transactionId: result.transactionId,
      voucherNo: result.voucherNo,
      voucherType: movementType,
      ledgerEntries: result.ledgerEntries,
      stockUpdates: result.ledgerEntries, // Stock is derived from ledger entries, so this equals ledger count
      serialUpdates: result.serialUpdates,
      auditLogId: auditLog,
      message: `${movementConfig.name} ${result.voucherNo} created successfully`,
      warnings,
    };
  }

  // ─── VALIDATION PIPELINE ───────────────────────

  private async validateInput(input: CreateMovementInput, config: MovementTypeConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!input.items || input.items.length === 0) {
      errors.push('Movement must have at least one item');
    }

    // Positive quantities (allow zero for opening balance)
    if (input.items?.some((i) => i.quantity < 0)) {
      errors.push('All items must have non-negative quantity');
    }

    // Duplicate serial numbers
    const serials = input.items?.filter((i) => i.serialNumber).map((i) => i.serialNumber);
    if (serials && serials.length > 0) {
      const unique = new Set(serials);
      if (unique.size !== serials.length) {
        errors.push('Duplicate serial numbers in same movement');
      }
    }

    // Voucher uniqueness
    const previewVoucher = await this.voucherEngine.previewNextVoucherNo(
      input.companyId, input.financialYearId, input.movementType as VoucherType,
    );
    const isUnique = await this.voucherEngine.validateVoucherNo(
      input.companyId, input.financialYearId, previewVoucher,
    );
    if (!isUnique) {
      errors.push(`Duplicate voucher number: ${previewVoucher}`);
    }

    // Backdated check — respect both per-movement config AND global system config
    // Skip for Carry Forward (CF) — system-generated during FY close, date is always in the past
    if (input.transactionDate < new Date() && input.movementType !== 'CF') {
      const globalBackdated = await this.configService.getBool(input.companyId, 'STOCK.ALLOW_BACKDATED');
      if (!config.allowBackdated && !globalBackdated) {
        errors.push(`${config.name} does not allow backdated entries`);
      }
    }

    // Source/Destination required based on direction
    if (config.direction === 'OUTBOUND' || config.direction === 'BIDIRECTIONAL') {
      if (config.stockEffect.source === 'DECREASE' && !input.fromStoreId) {
        errors.push('Source store is required for outbound movement');
      }
    }
    if (config.direction === 'INBOUND' || config.direction === 'BIDIRECTIONAL') {
      if (config.stockEffect.destination === 'INCREASE' && !input.toStoreId) {
        errors.push('Destination store is required for inbound movement');
      }
    }

    // ROOM.LOCATION_ID_REQUIRED — require locationId on items when destination store has Room-type locations
    if (config.stockEffect.destination === 'INCREASE' && input.toStoreId) {
      const roomLocations = await this.prisma.location.findMany({
        where: { storeId: input.toStoreId, locationType: 'Room', isActive: true },
        select: { id: true },
      });
      if (roomLocations.length > 0) {
        const itemsWithoutLocation = input.items.filter((i) => !i.toLocationId);
        if (itemsWithoutLocation.length > 0) {
          errors.push(`Location (Room) is required for items being issued to a store with rooms: ${itemsWithoutLocation.map((i) => i.itemId).join(', ')}`);
        }
      }
    }

    // Partial quantity warning (batch)
    if (config.allowPartial && input.fromStoreId) {
      const partialItemIds = [...new Set(input.items.map((i) => i.itemId))];
      const partialBalances = await this.prisma.ledgerEntry.groupBy({
        by: ['itemId'],
        where: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          itemId: { in: partialItemIds },
          storeId: input.fromStoreId,
        },
        _sum: { quantityIn: true, quantityOut: true },
      });
      const partialBalanceMap = new Map(partialBalances.map((r) => [
        r.itemId,
        Number(r._sum.quantityIn || 0) - Number(r._sum.quantityOut || 0),
      ]));
      for (const item of input.items) {
        const balance = partialBalanceMap.get(item.itemId) || 0;
        if (balance > 0 && item.quantity < balance) {
          warnings.push(`Partial quantity: ${item.itemId} has ${balance}, moving ${item.quantity}`);
        }
      }
    }

    // STOCK.REQUIRE_CONDITION — require condition field on stock entries (batch)
    const requireCondition = await this.configService.getBool(input.companyId, 'STOCK.REQUIRE_CONDITION');
    const defaultCondition = await this.configService.get(input.companyId, 'STOCK.DEFAULT_CONDITION') || 'GOOD';
    if (requireCondition) {
      for (const item of input.items) {
        const effectiveCondition = item.condition?.trim() || defaultCondition;
        if (!effectiveCondition) {
          const condItem = await this.prisma.item.findUnique({ where: { id: item.itemId }, select: { itemName: true } });
          errors.push(`Condition is required for item: ${condItem?.itemName || item.itemId}`);
        }
      }
    }

    // SERIAL.REQUIRE_SERIAL_ON_RECEIPT — require serial number on receipt for serialized items
    const requireSerial = await this.configService.getBool(input.companyId, 'SERIAL.REQUIRE_SERIAL_ON_RECEIPT');
    if (requireSerial && config.stockEffect.destination === 'INCREASE') {
      const itemIds = [...new Set(input.items.map((i) => i.itemId))];
      const items = await this.prisma.item.findMany({ where: { id: { in: itemIds } } });
      const itemMap = new Map(items.map((i) => [i.id, i]));
      for (const item of input.items) {
        const itemMaster = itemMap.get(item.itemId);
        if (itemMaster?.isSerialized && !item.serialNumber) {
          errors.push(`Serial number is required for serialized item: ${itemMaster.itemName}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async checkPermissions(input: CreateMovementInput, config: MovementTypeConfig): Promise<void> {
    // Validate user exists and is active
    const user = await this.prisma.user.findFirst({ where: { username: input.createdBy } });
    if (!user) {
      // createdBy is a free-text audit field (e.g. shiftedBy, transferredBy)
      // Skip permission check if user doesn't exist in system
      return;
    }
    if (!user.isActive) {
      throw new Error(`User "${input.createdBy}" is inactive`);
    }

    // ADMIN users bypass all permission checks
    if (user.role === 'ADMIN') return;

    // Check specific permissions via role-based system
    if (config.stockEffect.source === 'DECREASE') {
      const hasPermission = user.roleId
        ? await this.prisma.rolePermission.findFirst({
            where: {
              roleId: user.roleId,
              permission: { key: { in: ['cancel_challan', 'transaction:create'] } },
            },
          })
        : null;
      if (!hasPermission) {
        throw new Error(`Permission denied: user "${input.createdBy}" lacks permission for stock-out operations`);
      }
    } else if (config.stockEffect.destination === 'INCREASE') {
      // INCREASE-only movements require transaction:create permission
      const hasPermission = user.roleId
        ? await this.prisma.rolePermission.findFirst({
            where: {
              roleId: user.roleId,
              permission: { key: 'transaction:create' },
            },
          })
        : null;
      if (!hasPermission) {
        throw new Error(`Permission denied: user "${input.createdBy}" lacks permission for stock-in operations`);
      }
    }
  }

  private async validateBusinessRules(input: CreateMovementInput, config: MovementTypeConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Financial year check
    const fy = await this.prisma.financialYear.findUnique({ where: { id: input.financialYearId } });
    if (!fy) {
      errors.push('Invalid financial year');
    } else if (fy.isClosed) {
      errors.push('Financial year is closed');
    }

    // Store type validation
    if (input.fromStoreId) {
      const store = await this.prisma.store.findUnique({ where: { id: input.fromStoreId } });
      if (!store) {
        errors.push('Invalid source store');
      } else if (!store.isActive) {
        errors.push('Source store is inactive');
      }
    }

    if (input.toStoreId) {
      const store = await this.prisma.store.findUnique({ where: { id: input.toStoreId } });
      if (!store) {
        errors.push('Invalid destination store');
      } else if (!store.isActive) {
        errors.push('Destination store is inactive');
      }
    }

    // Item validation (batch)
    const itemIds = [...new Set(input.items.map((i) => i.itemId))];
    const items = await this.prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemMap = new Map(items.map((i) => [i.id, i]));
    for (const item of input.items) {
      const itemMaster = itemMap.get(item.itemId);
      if (!itemMaster) {
        errors.push(`Invalid item ID: ${item.itemId}`);
      } else if (!itemMaster.isActive) {
        errors.push(`Item ${itemMaster.itemName} is inactive`);
      }
    }

    // Reversal specific
    if (config.code === 'RV') {
      if (!input.referenceNo) {
        errors.push('Reversal requires original voucher number');
      }
    }

    // Opening Balance duplicate prevention (batch)
    if (config.code === 'OB' && input.toStoreId) {
      const obItemIds = [...new Set(input.items.map((i) => i.itemId))];
      const existingOBs = await this.prisma.ledgerEntry.findMany({
        where: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          itemId: { in: obItemIds },
          storeId: input.toStoreId,
          movementType: 'OPENING_BALANCE',
        },
        select: { itemId: true },
      });
      const existingOBSet = new Set(existingOBs.map((e) => e.itemId));
      for (const item of input.items) {
        if (existingOBSet.has(item.itemId)) {
          errors.push(`Opening balance already exists for item ${item.itemId} at store ${input.toStoreId}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async validateStock(input: CreateMovementInput, config: MovementTypeConfig): Promise<void> {
    const allowNegative = await this.configService.getBool(input.companyId, 'STOCK.ALLOW_NEGATIVE');
    if (allowNegative) return;

    // Batch: fetch all item balances + item names in 3 queries instead of 3N
    const itemIds = [...new Set(input.items.map((i) => i.itemId))];
    const [balanceResults, items, store] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({
        by: ['itemId'],
        where: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          itemId: { in: itemIds },
          storeId: input.fromStoreId!,
        },
        _sum: { quantityIn: true, quantityOut: true },
      }),
      this.prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemName: true } }),
      this.prisma.store.findUnique({ where: { id: input.fromStoreId! }, select: { name: true } }),
    ]);

    const balanceMap = new Map(balanceResults.map((r) => [
      r.itemId,
      Number(r._sum.quantityIn || 0) - Number(r._sum.quantityOut || 0),
    ]));
    const itemMap = new Map(items.map((i) => [i.id, i.itemName]));

    for (const item of input.items) {
      const balance = balanceMap.get(item.itemId) || 0;
      if (balance < item.quantity) {
        throw new Error(
          `Insufficient stock: ${itemMap.get(item.itemId) || 'Unknown'} at ${store?.name || 'Unknown store'} ` +
          `has ${balance}, requested ${item.quantity}`
        );
      }
    }
  }

  // ─── LEDGER ENGINE ─────────────────────────────

  private async createLedgerEntries(
    tx: Prisma.TransactionClient,
    header: { id: number; voucherNo: string },
    input: CreateMovementInput,
    config: MovementTypeConfig,
  ): Promise<number> {
    const movements = this.getMovements(input.movementType || input.voucherType || '');

    const ledgerEntries: Array<Record<string, unknown>> = [];

    for (const item of input.items) {
      // Source ledger entry
      if (movements.source && input.fromStoreId) {
        ledgerEntries.push({
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          transactionId: header.id,
          itemId: item.itemId,
          storeId: input.fromStoreId,
          locationId: item.fromLocationId || input.fromLocationId || null,
          voucherNo: header.voucherNo,
          voucherType: input.movementType || input.voucherType || '',
          movementType: movements.source,
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(item.quantity),
          balanceQty: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(item.rate || 0),
          condition: item.condition || 'GOOD',
          serialNumber: item.serialNumber || null,
          batchNumber: item.batchNumber || null,
          transactionDate: input.transactionDate,
          createdBy: input.createdBy,
        });
      }

      // Destination ledger entry
      if (movements.destination && input.toStoreId) {
        ledgerEntries.push({
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          transactionId: header.id,
          itemId: item.itemId,
          storeId: input.toStoreId,
          locationId: item.toLocationId || input.toLocationId || null,
          voucherNo: header.voucherNo,
          voucherType: input.movementType || input.voucherType || '',
          movementType: movements.destination,
          quantityIn: new Prisma.Decimal(item.quantity),
          quantityOut: new Prisma.Decimal(0),
          balanceQty: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(item.rate || 0),
          condition: item.condition || 'GOOD',
          serialNumber: item.serialNumber || null,
          batchNumber: item.batchNumber || null,
          transactionDate: input.transactionDate,
          createdBy: input.createdBy,
        });
      }
    }

    if (ledgerEntries.length > 0) {
      await tx.ledgerEntry.createMany({ data: ledgerEntries });
    }

    // Update CurrentStockBalance incrementally (O(1) per entry instead of O(N) recalculation)
    for (const entry of ledgerEntries) {
      const delta = this.stockBalanceService.computeDelta(
        entry.movementType as string,
        Number(entry.quantityIn),
        Number(entry.quantityOut),
        entry.locationId as number | null,
      );
      await this.stockBalanceService.updateBalance(
        tx,
        input.companyId,
        input.financialYearId,
        entry.storeId as number,
        entry.itemId as number,
        delta,
      );
    }

    // Update StockMonthlySummary incrementally
    if (ledgerEntries.length > 0) {
      await this.monthlySummaryService.updateSummary(
        tx,
        input.companyId,
        input.financialYearId,
        ledgerEntries.map(e => ({
          quantityIn: Number(e.quantityIn),
          quantityOut: Number(e.quantityOut),
          transactionDate: e.transactionDate as Date,
        })),
      );
    }

    return ledgerEntries.length;
  }

  private getMovements(movementType: string): { source?: MovementType; destination?: MovementType } {
    const movementMap: Record<string, { source?: MovementType; destination?: MovementType }> = {
      RC: { destination: 'PURCHASE_RECEIPT' },
      OB: { destination: 'OPENING_BALANCE' },
      IC: { source: 'ISSUE_OUT', destination: 'ISSUE_IN' },
      TC: { source: 'TRANSFER_OUT', destination: 'TRANSFER_IN' },
      IS: { source: 'INSTALL_OUT', destination: 'INSTALL_IN' },
      UN: { source: 'SHIFT_OUT', destination: 'SHIFT_IN' },
      SH: { source: 'SHIFT_OUT', destination: 'SHIFT_IN' },
      DS: { source: 'SHIFT_OUT', destination: 'SHIFT_IN' },
      DP: { source: 'SHIFT_OUT', destination: 'SHIFT_IN' },
      DM: { source: 'DAMAGE_OUT', destination: 'DAMAGE_IN' },
      RO: { source: 'REPAIR_OUT' },
      RI: { destination: 'REPAIR_IN' },
      VR: { source: 'VENDOR_RETURN' },
      DR: { source: 'RETURN_OUT', destination: 'RETURN_IN' },
      RP: { source: 'REPLACEMENT_OUT', destination: 'REPLACEMENT_IN' },
      SF: { source: 'SCRAP_OUT' },
      AD: { source: 'ADJUSTMENT_MINUS', destination: 'ADJUSTMENT_PLUS' },
      CF: { destination: 'CARRY_FORWARD' },
      RV: { source: 'REVERSAL' },
    };
    return movementMap[movementType] || {};
  }

  // ─── SAME-STORE ROOM→ROOM DETECTION ────────────

  private async isSameStoreRoomToRoom(
    headerId: number,
    companyId: number,
    financialYearId: number,
    fromStoreId: number | null,
    toStoreId: number | null,
  ): Promise<boolean> {
    if (!fromStoreId || !toStoreId || fromStoreId !== toStoreId) return false;

    const details = await this.prisma.transactionDetail.findMany({
      where: { transactionId: headerId },
      select: { fromLocationId: true, toLocationId: true },
    });
    if (details.length === 0) return false;

    const locationIds = new Set<number>();
    for (const d of details) {
      if (!d.fromLocationId || !d.toLocationId) return false;
      locationIds.add(d.fromLocationId);
      locationIds.add(d.toLocationId);
    }

    const locations = await this.prisma.location.findMany({
      where: { id: { in: Array.from(locationIds) }, companyId },
      select: { id: true, locationType: true },
    });

    return locations.every((l) => l.locationType === 'Room');
  }

  // ─── DRAFT → POSTED TRANSITION ─────────────────

  async postTransaction(id: number): Promise<{ success: boolean }> {
    const header = await this.prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: { include: { item: true } } },
    });
    if (!header) throw new Error('Transaction not found');
    if (header.approvalStatus !== 'DRAFT') {
      throw new Error(`Only DRAFT transactions can be posted (current: ${header.approvalStatus})`);
    }

    const existingLedger = await this.prisma.ledgerEntry.findMany({
      where: { transactionId: id },
    });
    if (existingLedger.length > 0) {
      throw new Error('Ledger entries already exist for this transaction.');
    }

    const movementType = header.voucherType;
    const movements = this.getMovements(movementType);

    const isSameStoreRoomToRoom = await this.isSameStoreRoomToRoom(
      header.id, header.companyId, header.financialYearId,
      header.fromStoreId, header.toStoreId,
    );

    const ledgerEntries: Array<Record<string, unknown>> = [];
    if (!isSameStoreRoomToRoom) {
      for (const detail of header.details) {
        if (movements.source && header.fromStoreId) {
          ledgerEntries.push({
            companyId: header.companyId,
            financialYearId: header.financialYearId,
            transactionId: header.id,
            itemId: detail.itemId,
            storeId: header.fromStoreId,
            locationId: detail.fromLocationId || null,
            voucherNo: header.voucherNo,
            voucherType: movementType,
            movementType: movements.source,
            quantityIn: new Prisma.Decimal(0),
            quantityOut: new Prisma.Decimal(detail.quantity),
            balanceQty: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(detail.rate || 0),
            condition: 'GOOD',
            serialNumber: detail.serialNumber || null,
            batchNumber: null,
            transactionDate: header.transactionDate,
            createdBy: header.createdBy,
          });
        }
        if (movements.destination && header.toStoreId) {
          ledgerEntries.push({
            companyId: header.companyId,
            financialYearId: header.financialYearId,
            transactionId: header.id,
            itemId: detail.itemId,
            storeId: header.toStoreId,
            locationId: detail.toLocationId || null,
            voucherNo: header.voucherNo,
            voucherType: movementType,
            movementType: movements.destination,
            quantityIn: new Prisma.Decimal(detail.quantity),
            quantityOut: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(detail.rate || 0),
            condition: 'GOOD',
            serialNumber: detail.serialNumber || null,
            batchNumber: null,
            transactionDate: header.transactionDate,
            createdBy: header.createdBy,
          });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (ledgerEntries.length > 0) {
        await tx.ledgerEntry.createMany({ data: ledgerEntries });
      }

      // Update CurrentStockBalance incrementally
      for (const entry of ledgerEntries) {
        const delta = this.stockBalanceService.computeDelta(
          entry.movementType as string,
          Number(entry.quantityIn),
          Number(entry.quantityOut),
          entry.locationId as number | null,
        );
        await this.stockBalanceService.updateBalance(
          tx,
          header.companyId,
          header.financialYearId,
          entry.storeId as number,
          entry.itemId as number,
          delta,
        );
      }

      // Update StockMonthlySummary incrementally
      if (ledgerEntries.length > 0) {
        await this.monthlySummaryService.updateSummary(
          tx,
          header.companyId,
          header.financialYearId,
          ledgerEntries.map(e => ({
            quantityIn: Number(e.quantityIn),
            quantityOut: Number(e.quantityOut),
            transactionDate: e.transactionDate as Date,
          })),
        );
      }

      await tx.transactionHeader.update({
        where: { id },
        data: {
          approvalStatus: 'POSTED',
          postedAt: new Date(),
        },
      });
    });

    return { success: true };
  }

  // ─── ASSET INSTALLATION ────────────────────────

  private async updateInstalledAssets(
    tx: Prisma.TransactionClient,
    header: { id: number }, // Prisma.TransactionHeader subset
    input: CreateMovementInput,
    config: MovementTypeConfig,
  ): Promise<void> {
    // Install movement (batch create)
    if (config.code === 'IS' && input.toStoreId) {
      const roomId = input.toRoomId || input.toLocationId;
      if (roomId) {
        await tx.assetInstallation.createMany({
          data: input.items.map((item) => ({
            itemId: item.itemId,
            roomId,
            storeId: input.toStoreId!,
            quantity: item.quantity,
            installedDate: input.transactionDate,
            installedBy: input.createdBy,
            status: 'ACTIVE',
            remarks: item.remarks || input.remarks || null,
          })),
        });
      }
    }

    // Uninstall movement (batch fetch + individual update for quantity math)
    if (config.code === 'UN' && input.fromStoreId) {
      const uninstallItemIds = [...new Set(input.items.map((i) => i.itemId))];
      const installations = await tx.assetInstallation.findMany({
        where: {
          itemId: { in: uninstallItemIds },
          storeId: input.fromStoreId,
          status: 'ACTIVE',
        },
      });
      const installationMap = new Map(installations.map((inst) => [inst.itemId, inst]));

      for (const item of input.items) {
        const installation = installationMap.get(item.itemId);
        if (installation) {
          await tx.assetInstallation.update({
            where: { id: installation.id },
            data: {
              status: 'INACTIVE',
              uninstalledDate: input.transactionDate,
              uninstalledBy: input.createdBy,
              quantity: Math.max(0, Number(installation.quantity) - item.quantity),
            },
          });
        }
      }
    }
  }

  // ─── SERIAL NUMBER ENGINE ──────────────────────

  private async updateSerialNumbers(
    tx: Prisma.TransactionClient,
    header: { id: number }, // Prisma.TransactionHeader subset
    input: CreateMovementInput,
    config: MovementTypeConfig,
  ): Promise<number> {
    const trackSerials = await this.configService.getBool(input.companyId, 'SERIAL.TRACK_SERIAL_NUMBERS');
    if (!trackSerials) return 0;

    const serialItems = input.items.filter((i) => i.serialNumber);
    if (serialItems.length === 0) return 0;

    // Batch: check which items are serialized
    const serialItemIds = [...new Set(serialItems.map((i) => i.itemId))];
    const itemMasters = await tx.item.findMany({ where: { id: { in: serialItemIds } }, select: { id: true, isSerialized: true } });
    const serializedItemIds = new Set(itemMasters.filter((i) => i.isSerialized).map((i) => i.id));

    const toProcess = serialItems.filter((i) => serializedItemIds.has(i.itemId));
    if (toProcess.length === 0) return 0;

    // Batch: fetch existing serialized items
    const existingSerialized = await tx.serializedItem.findMany({
      where: {
        OR: toProcess.map((i) => ({ itemId: i.itemId, serialNumber: i.serialNumber! })),
      },
    });
    const serializedMap = new Map(existingSerialized.map((s) => [`${s.itemId}-${s.serialNumber}`, s]));

    const movementType = input.movementType || input.voucherType || '';
    const status = this.getSerializedStatus(movementType);
    let count = 0;

    for (const item of toProcess) {
      const key = `${item.itemId}-${item.serialNumber}`;
      const serialized = serializedMap.get(key);

      if (serialized) {
        await tx.serializedItem.update({
          where: { id: serialized.id },
          data: {
            currentStoreId: input.toStoreId || input.fromStoreId || undefined,
            status,
            condition: item.condition || 'GOOD',
          },
        });

        await tx.serialMovement.create({
          data: {
            serializedItemId: serialized.id,
            transactionId: header.id,
            movementType,
            fromStoreId: input.fromStoreId || null,
            toStoreId: input.toStoreId || null,
            fromLocationId: item.fromLocationId || input.fromLocationId || null,
            toLocationId: item.toLocationId || input.toLocationId || null,
            movementDate: input.transactionDate,
            createdBy: input.createdBy,
          },
        });
        count++;
      } else if (config.stockEffect.destination === 'INCREASE') {
        await tx.serializedItem.create({
          data: {
            itemId: item.itemId,
            serialNumber: item.serialNumber!,
            batchNumber: item.batchNumber || null,
            currentStoreId: input.toStoreId || input.fromStoreId || null,
            status,
            condition: item.condition || 'GOOD',
            purchaseDate: input.transactionDate,
            warrantyExpiry: item.warrantyExpiry || null,
          },
        });
        count++;
      }
    }

    return count;
  }

  private getSerializedStatus(movementType: string): string {
    const statusMap: Record<string, string> = {
      RC: 'AVAILABLE', OB: 'AVAILABLE', IC: 'AVAILABLE', TC: 'AVAILABLE',
      IS: 'INSTALLED', UN: 'AVAILABLE', SH: 'INSTALLED', DS: 'INSTALLED', DP: 'INSTALLED',
      DM: 'DAMAGED', RO: 'UNDER_REPAIR', RI: 'AVAILABLE', VR: 'AVAILABLE',
      DR: 'AVAILABLE', RP: 'AVAILABLE', SF: 'SCRAPPED', AD: 'AVAILABLE',
      CF: 'AVAILABLE', RV: 'AVAILABLE',
    };
    return statusMap[movementType] || 'AVAILABLE';
  }

  // ─── ATOMIC CANCEL WITH REVERSAL ────────────────

  /**
   * Atomically create a reversal AND mark the original as CANCELLED.
   *
   * WHY: The IPC cancel handlers previously called createMovement('RV') (which
   * commits its own $transaction) then separately updated the original header
   * status. If the status update failed, stock would be doubled — the reversal
   * ledger entries exist but the original isn't marked cancelled.
   *
   * This method wraps both operations in a single $transaction so they either
   * both succeed or both fail. This is critical for maintaining ledger
   * reconciliation — stock calculated from ledger entries must always match
   * the displayed UI stock.
   */
  async reverseAndCancel(
    input: CreateMovementInput,
    originalTransactionId: number,
    cancelReason: string,
  ): Promise<MovementResult> {
    const movementType = 'RV';
    const movementConfig = await this.registry.getByCode(movementType);
    if (!movementConfig) throw new Error('Unknown movement type: RV');

    // Validate the original transaction
    const original = await this.prisma.transactionHeader.findUnique({
      where: { id: originalTransactionId },
      include: { details: true },
    });
    if (!original) throw new Error('Original transaction not found');
    if (original.companyId !== input.companyId) throw new Error('Unauthorized');

    // ─── REVERSAL-OF-REVERSAL PREVENTION ─────────────
    if (original.voucherType === 'RV') {
      throw new Error('Cannot cancel a reversal transaction');
    }
    if (original.approvalStatus === 'CANCELLED') {
      throw new Error('Transaction is already cancelled');
    }
    if (original.approvalStatus === 'REVERSED') {
      throw new Error('Transaction is already reversed');
    }
    if (original.approvalStatus !== 'POSTED') {
      throw new Error(`Cannot cancel: original status is ${original.approvalStatus}`);
    }

    // Check if a reversal already exists for this transaction
    const existingReversal = await this.prisma.transactionHeader.findFirst({
      where: {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        voucherType: 'RV',
        referenceNo: original.voucherNo,
      },
    });
    if (existingReversal) {
      throw new Error(`Transaction already has reversal: ${existingReversal.voucherNo}`);
    }

    // Generate voucher number
    const voucherNo = await this.voucherEngine.generateVoucherNo(
      input.companyId, input.financialYearId, 'RV',
    );

    // Execute reversal + cancellation in a single atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create reversal header
      const header = await tx.transactionHeader.create({
        data: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          voucherNo,
          voucherType: 'RV',
          transactionDate: input.transactionDate,
          fromStoreId: original.toStoreId,
          toStoreId: original.fromStoreId,
          fromLocationId: original.toLocationId,
          toLocationId: original.fromLocationId,
          referenceNo: original.voucherNo,
          remarks: input.remarks || `Reversal of ${original.voucherNo}: ${cancelReason}`,
          createdBy: input.createdBy,
          approvalStatus: 'POSTED',
          postedBy: input.createdBy,
          postedAt: new Date(),
        },
      });

      // Create reversal details (inverted from original)
      await tx.transactionDetail.createMany({
        data: original.details.map((detail) => ({
          transactionId: header.id,
          itemId: detail.itemId,
          unitId: detail.unitId,
          quantity: detail.quantity,
          rate: detail.rate,
          amount: detail.amount,
          serialNumber: detail.serialNumber,
          batchNumber: detail.batchNumber,
          condition: detail.condition,
          fromLocationId: detail.toLocationId,
          toLocationId: detail.fromLocationId,
          remarks: `Reversal of ${original.voucherNo}`,
        })),
      });

      // Fetch original ledger entries for balance calculation
      const originalLedgers = await tx.ledgerEntry.findMany({
        where: { transactionId: original.id },
      });

      // Create reversal ledger entries (balance will be recalculated after)
      const reversalEntries = originalLedgers.map((ledger) => ({
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        transactionId: header.id,
        itemId: ledger.itemId,
        storeId: ledger.storeId,
        locationId: ledger.locationId,
        voucherNo,
        voucherType: 'RV',
        movementType: 'REVERSAL' as const,
        quantityIn: ledger.quantityOut,
        quantityOut: ledger.quantityIn,
        balanceQty: new Prisma.Decimal(0),
        rate: ledger.rate,
        condition: ledger.condition,
        serialNumber: ledger.serialNumber,
        batchNumber: ledger.batchNumber,
        transactionDate: input.transactionDate,
        createdBy: input.createdBy,
      }));
      await tx.ledgerEntry.createMany({ data: reversalEntries });

      // Update CurrentStockBalance incrementally for reversal
      for (const revEntry of reversalEntries) {
        const delta = this.stockBalanceService.computeDelta(
          revEntry.movementType as string,
          Number(revEntry.quantityIn),
          Number(revEntry.quantityOut),
          revEntry.locationId as number | null,
        );
        await this.stockBalanceService.updateBalance(
          tx,
          input.companyId,
          input.financialYearId,
          revEntry.storeId as number,
          revEntry.itemId as number,
          delta,
        );
      }

      // Update StockMonthlySummary incrementally for reversal
      if (reversalEntries.length > 0) {
        await this.monthlySummaryService.updateSummary(
          tx,
          input.companyId,
          input.financialYearId,
          reversalEntries.map(e => ({
            quantityIn: Number(e.quantityIn),
            quantityOut: Number(e.quantityOut),
            transactionDate: e.transactionDate as Date,
          })),
        );
      }

      // CRITICAL: Mark original as CANCELLED — in the SAME transaction as the reversal
      await tx.transactionHeader.update({
        where: { id: originalTransactionId },
        data: {
          approvalStatus: 'CANCELLED',
          cancelledBy: input.createdBy,
          cancelledAt: new Date(),
          cancelReason,
        },
      });

      // Audit log for the cancellation
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          action: 'CANCEL',
          tableName: 'TransactionHeader',
          recordId: originalTransactionId,
          recordUuid: original.voucherNo,
          description: `Transaction ${original.voucherNo} cancelled: ${cancelReason}. Reversal: ${voucherNo}`,
        },
      });

      return {
        transactionId: header.id,
        voucherNo: header.voucherNo,
        ledgerEntries: originalLedgers.length * 2, // source + dest per ledger
      };
    });

    return {
      success: true,
      transactionId: result.transactionId,
      voucherNo: result.voucherNo,
      voucherType: 'RV',
      ledgerEntries: result.ledgerEntries,
      stockUpdates: result.ledgerEntries,
      serialUpdates: 0,
      auditLogId: 0,
      message: `Reversal ${result.voucherNo} created and original cancelled`,
      warnings: [],
    };
  }

  // ─── AUDIT LOG ─────────────────────────────────

  private async createAuditLog(
    input: CreateMovementInput,
    result: { transactionId: number; voucherNo: string; ledgerEntries: number },
    config: MovementTypeConfig,
  ): Promise<number> {
    const log = await this.prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        action: 'CREATE',
        tableName: 'TransactionHeader',
        recordId: result.transactionId,
        recordUuid: result.voucherNo,
        description: `${config.name} created: ${result.voucherNo} with ${input.items.length} items, ${result.ledgerEntries} ledger entries`,
        ipAddress: input.ipAddress || null,
        newValues: JSON.stringify({
          voucherNo: result.voucherNo,
          movementType: config.code,
          items: input.items.length,
          ledgerEntries: result.ledgerEntries,
          fromStoreId: input.fromStoreId,
          toStoreId: input.toStoreId,
        }),
      },
    });
    return log.id;
  }

  // ─── NOTIFICATIONS ─────────────────────────────

  private async generateNotification(
    input: CreateMovementInput,
    result: { transactionId: number; voucherNo: string },
    config: MovementTypeConfig,
  ): Promise<void> {
    // Future: generate notifications (email, in-app, etc.)
    // For now, audit log is sufficient
  }

  // ─── WORKFLOW ──────────────────────────────────

  /**
   * Approve a pending movement.
   */
  async approveMovement(
    companyId: number, transactionId: number, approvedBy: string,
  ): Promise<void> {
    const header = await this.prisma.transactionHeader.findUnique({ where: { id: transactionId } });
    if (!header) throw new Error('Transaction not found');
    if (header.companyId !== companyId) throw new Error('Unauthorized');
    if (header.approvalStatus !== 'PENDING') {
      throw new Error(`Cannot approve: current status is ${header.approvalStatus}`);
    }

    await this.prisma.transactionHeader.update({
      where: { id: transactionId },
      data: {
        approvalStatus: 'POSTED',
        approvedBy,
        approvedAt: new Date(),
        postedBy: approvedBy,
        postedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'APPROVE',
        tableName: 'TransactionHeader',
        recordId: transactionId,
        recordUuid: header.voucherNo,
        description: `Transaction ${header.voucherNo} approved by ${approvedBy}`,
      },
    });
  }

  /**
   * Reject a pending movement.
   */
  async rejectMovement(
    companyId: number, transactionId: number, rejectedBy: string, reason: string,
  ): Promise<void> {
    const header = await this.prisma.transactionHeader.findUnique({ where: { id: transactionId } });
    if (!header) throw new Error('Transaction not found');
    if (header.companyId !== companyId) throw new Error('Unauthorized');
    if (header.approvalStatus !== 'PENDING') {
      throw new Error(`Cannot reject: current status is ${header.approvalStatus}`);
    }

    await this.prisma.transactionHeader.update({
      where: { id: transactionId },
      data: {
        approvalStatus: 'REJECTED',
        cancelReason: reason,
        cancelledBy: rejectedBy,
        cancelledAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'REJECT',
        tableName: 'TransactionHeader',
        recordId: transactionId,
        recordUuid: header.voucherNo,
        description: `Transaction ${header.voucherNo} rejected by ${rejectedBy}: ${reason}`,
      },
    });
  }

  // ─── BULK MOVEMENTS (ATOMIC BATCH) ──────────────

  /**
   * Create multiple movements atomically in a single database transaction.
   *
   * WHY: The individual createMovement() is designed for single movements.
   * Bulk operations need to process N items where either ALL succeed or ALL
   * roll back. This method validates everything upfront, then executes all
   * movements in one $transaction so partial commits cannot occur.
   *
   * Each movement gets its own voucher number, header, and ledger entries —
   * preserving the existing per-movement semantics while ensuring atomicity.
   */
  async createBulkMovements(
    inputs: CreateMovementInput[],
  ): Promise<{ results: MovementResult[]; failedIndex: number; error: string }> {
    if (inputs.length === 0) {
      throw new Error('At least one movement is required');
    }

    const firstInput = inputs[0];
    const movementType = firstInput.movementType || firstInput.voucherType || '';
    if (!movementType) {
      throw new Error('movementType is required');
    }

    const movementConfig = await this.registry.getByCode(movementType);
    if (!movementConfig) {
      throw new Error(`Unknown movement type: ${movementType}`);
    }

    // ── BATCH VALIDATION (before any writes) ──
    // Validate all inputs upfront so we can fail fast without side effects.
    for (let i = 0; i < inputs.length; i++) {
      const normalizedInput = { ...inputs[i], movementType };

      const inputValidation = await this.validateInput(normalizedInput, movementConfig);
      if (!inputValidation.valid) {
        return { results: [], failedIndex: i, error: inputValidation.errors.join('; ') };
      }

      await this.checkPermissions(normalizedInput, movementConfig);

      const businessValidation = await this.validateBusinessRules(normalizedInput, movementConfig);
      if (!businessValidation.valid) {
        return { results: [], failedIndex: i, error: businessValidation.errors.join('; ') };
      }

      if (movementConfig.stockEffect.source === 'DECREASE' && normalizedInput.fromStoreId) {
        await this.validateStock(normalizedInput, movementConfig);
      }
    }

    // ── BATCH EXECUTION (single atomic transaction) ──
    const results: MovementResult[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < inputs.length; i++) {
        const normalizedInput = { ...inputs[i], movementType };
        const warnings: string[] = [];

        // Generate voucher
        const voucherType = movementType as VoucherType;
        const voucherNo = await this.voucherEngine.generateVoucherNo(
          normalizedInput.companyId, normalizedInput.financialYearId, voucherType,
        );

        // Determine initial status
        let initialStatus = normalizedInput.initialStatus || 'POSTED';
        if (initialStatus === 'POSTED') {
          const [requireApproval, inTransit] = await Promise.all([
            (async () => {
              if (movementType === 'RC') return this.configService.getBool(normalizedInput.companyId, 'APPROVAL.RECEIPT_APPROVAL');
              if (movementType === 'IS') return this.configService.getBool(normalizedInput.companyId, 'APPROVAL.ISSUE_APPROVAL');
              if (movementType === 'TC') {
                const [transferApproval, issueApproval] = await Promise.all([
                  this.configService.getBool(normalizedInput.companyId, 'APPROVAL.TRANSFER_APPROVAL'),
                  this.configService.getBool(normalizedInput.companyId, 'TRANSFER.REQUIRE_APPROVAL'),
                ]);
                return transferApproval || issueApproval;
              }
              return false;
            })(),
            movementType === 'TC' ? this.configService.getBool(normalizedInput.companyId, 'TRANSFER.IN_TRANSIT_ENABLED') : Promise.resolve(false),
          ]);

          if (requireApproval) {
            initialStatus = inTransit ? 'IN_TRANSIT' : 'PENDING';
          }
        }

        // Create header
        const header = await tx.transactionHeader.create({
          data: {
            companyId: normalizedInput.companyId,
            financialYearId: normalizedInput.financialYearId,
            voucherNo,
            voucherType: movementType,
            transactionDate: normalizedInput.transactionDate,
            invoiceDate: normalizedInput.invoiceDate || null,
            fromStoreId: normalizedInput.fromStoreId || null,
            toStoreId: normalizedInput.toStoreId || null,
            fromLocationId: normalizedInput.fromLocationId || null,
            toLocationId: normalizedInput.toLocationId || null,
            vendorId: normalizedInput.vendorId || null,
            reasonId: normalizedInput.reasonId || null,
            departmentId: normalizedInput.departmentId || null,
            referenceNo: normalizedInput.referenceNo || null,
            vehicleNumber: normalizedInput.vehicleNumber || null,
            receivedBy: normalizedInput.receivedBy || null,
            issuedBy: normalizedInput.issuedBy || null,
            purpose: normalizedInput.purpose || null,
            remarks: normalizedInput.remarks || null,
            createdBy: normalizedInput.createdBy,
            approvalStatus: initialStatus,
            postedBy: initialStatus === 'POSTED' ? normalizedInput.createdBy : null,
            postedAt: initialStatus === 'POSTED' ? new Date() : null,
          },
        });

        // Create details
        const defaultCondition = await this.configService.get(normalizedInput.companyId, 'STOCK.DEFAULT_CONDITION') || 'GOOD';
        await tx.transactionDetail.createMany({
          data: normalizedInput.items.map((item) => ({
            transactionId: header.id,
            itemId: item.itemId,
            unitId: item.unitId || null,
            quantity: new Prisma.Decimal(item.quantity),
            rate: new Prisma.Decimal(item.rate || 0),
            amount: new Prisma.Decimal((item.rate || 0) * item.quantity),
            serialNumber: item.serialNumber || null,
            batchNumber: item.batchNumber || null,
            condition: item.condition || defaultCondition,
            warrantyExpiry: item.warrantyExpiry || null,
            fromLocationId: item.fromLocationId || null,
            toLocationId: item.toLocationId || null,
            remarks: item.remarks || null,
          })),
        });

        // Create ledger entries
        const ledgerCount = await this.createLedgerEntries(tx, header, normalizedInput, movementConfig);

        // Update installed assets
        await this.updateInstalledAssets(tx, header, normalizedInput, movementConfig);

        // Update serial numbers
        const serialUpdates = await this.updateSerialNumbers(tx, header, normalizedInput, movementConfig);

        // Audit log
        const auditLog = await tx.auditLog.create({
          data: {
            companyId: normalizedInput.companyId,
            action: 'CREATE',
            tableName: 'TransactionHeader',
            recordId: header.id,
            recordUuid: header.voucherNo,
            description: `${movementConfig.name} created: ${header.voucherNo} with ${normalizedInput.items.length} items, ${ledgerCount} ledger entries`,
            ipAddress: normalizedInput.ipAddress || null,
            newValues: JSON.stringify({
              voucherNo: header.voucherNo,
              movementType: movementConfig.code,
              items: normalizedInput.items.length,
              ledgerEntries: ledgerCount,
              fromStoreId: normalizedInput.fromStoreId,
              toStoreId: normalizedInput.toStoreId,
            }),
          },
        });

        results.push({
          success: true,
          transactionId: header.id,
          voucherNo: header.voucherNo,
          voucherType: movementType,
          ledgerEntries: ledgerCount,
          stockUpdates: ledgerCount,
          serialUpdates,
          auditLogId: auditLog.id,
          message: `${movementConfig.name} ${header.voucherNo} created successfully`,
          warnings,
        });
      }
    });

    return { results, failedIndex: -1, error: '' };
  }

  /**
   * Cancel a movement.
   */
  async cancelMovement(
    companyId: number, transactionId: number, cancelledBy: string, reason: string,
  ): Promise<void> {
    const header = await this.prisma.transactionHeader.findUnique({ where: { id: transactionId } });
    if (!header) throw new Error('Transaction not found');
    if (header.companyId !== companyId) throw new Error('Unauthorized');

    // ─── REVERSAL/CANCEL PREVENTION ──────────────────
    if (header.voucherType === 'RV') {
      throw new Error('Cannot cancel a reversal transaction');
    }
    if (header.approvalStatus === 'CANCELLED') {
      throw new Error('Transaction is already cancelled');
    }
    if (header.approvalStatus === 'REVERSED') {
      throw new Error('Transaction is already reversed');
    }
    if (header.approvalStatus === 'DRAFT' || header.approvalStatus === 'REJECTED') {
      throw new Error(`Cannot cancel: current status is ${header.approvalStatus}`);
    }

    await this.prisma.transactionHeader.update({
      where: { id: transactionId },
      data: {
        approvalStatus: 'CANCELLED',
        cancelReason: reason,
        cancelledBy,
        cancelledAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'CANCEL',
        tableName: 'TransactionHeader',
        recordId: transactionId,
        recordUuid: header.voucherNo,
        description: `Transaction ${header.voucherNo} cancelled by ${cancelledBy}: ${reason}`,
      },
    });
  }
}
