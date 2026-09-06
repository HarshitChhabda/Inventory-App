export type ChallanStatus = 'Draft' | 'Posted' | 'Cancelled';
export type TransactionType = 'OpeningBalance' | 'Purchase' | 'Receipt' | 'Issue' | 'Return' | 'Transfer' | 'TransferIn' | 'TransferOut' | 'Adjustment' | 'AdjustmentIn' | 'AdjustmentOut' | 'Damage' | 'DamageOut' | 'DamageTransferIn' | 'VendorReturn' | 'Install' | 'Uninstall' | 'Reversal' | 'OpeningStock' | 'Scrap';
export type SourceType = 'Vendor' | 'JaipurOffice' | 'OtherBranch' | 'Donation' | 'Transfer' | 'DepartmentReturn';
export type UserRole = 'Admin' | 'StoreManager' | 'Viewer';
export type AssetStatus = 'Active' | 'Damaged' | 'Scrapped' | 'Removed';
export type DamageReason = 'Damaged' | 'Lost' | 'Broken' | 'Scrap' | 'Expired';
export type DamageType = 'SCRAP' | 'REPAIRABLE' | 'LOST' | 'BROKEN' | 'EXPIRED';
export type LocationType = 'Room' | 'Office' | 'Hall' | 'Workshop' | 'StoreArea' | 'Dharamshala' | 'Store' | 'Department';
export type ChallanType = 'RC' | 'IC' | 'DC' | 'TC' | 'VRC';
export type DepartmentType = 'Store' | 'Dharamshala' | 'Department';
export type ConditionType = 'GOOD' | 'DAMAGED' | 'SCRAPPED';

// ============================================================
// ENTERPRISE TYPES
// ============================================================

export type StoreType = 'MAIN_STORE' | 'DEPARTMENT_STORE' | 'DHARMSHALA_STORE';
export type ItemType = 'CONSUMABLE' | 'NON_CONSUMABLE' | 'ASSET' | 'REPAIRABLE' | 'RETURNABLE';
export type SerializedStatus = 'AVAILABLE' | 'INSTALLED' | 'DAMAGED' | 'REPAIRED' | 'SCRAPPED' | 'LOST' | 'RESERVED';
export type StockCategoryType = 'AVAILABLE' | 'INSTALLED' | 'RESERVED' | 'DAMAGED' | 'REPAIR' | 'TRANSIT' | 'SCRAP' | 'BLOCKED' | 'LOST';
export type VoucherType = 'RC' | 'OB' | 'IC' | 'TC' | 'IS' | 'IN' | 'UN' | 'SH' | 'DS' | 'DP' | 'DM' | 'RO' | 'RI' | 'VR' | 'DR' | 'RP' | 'SF' | 'AD' | 'CF' | 'RV';
export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'POSTED' | 'CANCELLED' | 'REVERSED';

export type MovementType =
  | 'OPENING_BALANCE'
  | 'PURCHASE_RECEIPT'
  | 'ISSUE_OUT'
  | 'ISSUE_IN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'INSTALL_OUT'
  | 'INSTALL_IN'
  | 'SHIFT_OUT'
  | 'SHIFT_IN'
  | 'DAMAGE_OUT'
  | 'DAMAGE_IN'
  | 'REPAIR_OUT'
  | 'REPAIR_IN'
  | 'RETURN_OUT'
  | 'RETURN_IN'
  | 'REPLACEMENT_OUT'
  | 'REPLACEMENT_IN'
  | 'ADJUSTMENT_PLUS'
  | 'ADJUSTMENT_MINUS'
  | 'SCRAP_OUT'
  | 'VENDOR_RETURN'
  | 'REVERSAL'
  | 'CARRY_FORWARD';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface StockBalance {
  itemId: number;
  itemName: string;
  itemCode: string;
  balanceQty: number;
  unitName: string;
  minimumStockLevel: number;
}

export interface DashboardStats {
  totalActiveItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  todayReceipts: number;
  todayIssues: number;
  pendingDraftChallans: number;
}

export interface ItemHistoryEntry {
  type: string;
  date: Date;
  challanNo?: string;
  vendorName?: string;
  quantity: number;
  rate?: number;
  departmentName?: string;
  locationName?: string;
  purpose?: string;
  reason?: string;
  balanceQty: number;
}

// ============================================================
// ENTERPRISE INVENTORY TYPES
// ============================================================

export interface StoreBalance {
  itemId: number;
  itemName: string;
  itemCode: string;
  storeId: number;
  storeName: string;
  availableQty: number;
  installedQty: number;
  reservedQty: number;
  damagedQty: number;
  repairQty: number;
  transitQty: number;
  scrapQty: number;
  blockedQty: number;
  lostQty: number;
  totalQty: number;
  unitName: string;
  minimumStockLevel: number;
}

export interface StockBalanceBreakdown {
  available: number;
  installed: number;
  reserved: number;
  damaged: number;
  repair: number;
  transit: number;
  scrap: number;
  blocked: number;
  lost: number;
  total: number;
}

export interface ConfigEntry {
  key: string;
  value: string;
  category: string;
  description?: string;
  dataType: string;
}

export interface TransferMatrixRule {
  companyId: number;
  fromStoreType: string;
  toStoreType: string;
  isAllowed: boolean;
  requiresApproval: boolean;
}

export interface MigrationResult {
  success: boolean;
  storesCreated: number;
  locationsUpdated: number;
  itemsUpdated: number;
  stockMigrated: number;
  installationsMigrated: number;
  errors: string[];
}

export interface StockValidationResult {
  valid: boolean;
  available: number;
  requested: number;
  itemName: string;
  storeName: string;
  message?: string;
}

export interface SerializedItem {
  id: number;
  uuid: string;
  itemId: number;
  serialNumber: string;
  batchNumber?: string;
  manufactureDate?: Date;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  currentStoreId?: number;
  currentLocationId?: number;
  status: SerializedStatus;
  condition: ConditionType;
  purchasePrice?: number;
  assetTag?: string;
}

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

export interface CreateTransactionInput {
  companyId: number;
  financialYearId: number;
  voucherType: VoucherType;
  transactionDate: Date;
  fromStoreId?: number;
  toStoreId?: number;
  fromLocationId?: number;
  toLocationId?: number;
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
}

export interface TransactionResult {
  success: boolean;
  transactionId: number;
  voucherNo: string;
  ledgerEntries: number;
  message: string;
}

export interface ItemStockSummary {
  itemId: number;
  itemName: string;
  itemCode: string;
  stores: Array<{
    storeId: number;
    storeName: string;
    available: number;
    installed: number;
    total: number;
  }>;
  totalAvailable: number;
  totalInstalled: number;
  totalAcrossStores: number;
}

// ============================================================
// PHASE 11: IMPORT TYPES
// ============================================================

export interface ImportValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  preview: any[];
}

export interface ImportError {
  row: number;
  column: string;
  value: any;
  error: string;
  severity: 'error' | 'warning';
}

export interface ImportWarning {
  row: number;
  column: string;
  value: any;
  warning: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: ImportError[];
  errorExcelPath?: string;
  importHistoryId?: number;
}

export interface ImportTemplate {
  name: string;
  description: string;
  columns: ImportColumn[];
}

export interface ImportColumn {
  key: string;
  header: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  sample?: string;
  enumValues?: string[];
  reference?: {
    model: string;
    field: string;
    displayField?: string;
  };
}

export interface ImportConfig {
  model: string;
  tableName: string;
  matchField: string;
  template: ImportTemplate;
}

// ============================================================
// PHASE 11: BACKUP TYPES
// ============================================================

export interface BackupVersion {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  checksum: string;
  timestamp: Date;
  type: 'manual' | 'scheduled' | 'pre-import' | 'pre-upgrade' | 'disaster-recovery';
  label?: string;
  metadata?: Record<string, any>;
}

export interface BackupIntegrityResult {
  valid: boolean;
  checksum: string;
  expectedChecksum?: string;
  size: number;
  error?: string;
}

export interface DisasterRecoveryResult {
  success: boolean;
  backupPath: string;
  checksum: string;
  restoredAt: Date;
  message: string;
}

export interface RetentionPolicy {
  manualKeep: number;
  scheduledKeep: number;
  preImportKeep: number;
  preUpgradeKeep: number;
  disasterRecoveryKeep: number;
}

// ============================================================
// PHASE 11: BULK OPERATIONS TYPES
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
  departmentId: number;
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
