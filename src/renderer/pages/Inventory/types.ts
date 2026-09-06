export interface ReceiptChallanItem {
  itemId: number;
  unitId: number;
  quantity: number;
  rate: number;
  remarks: string;
  serialNumber?: string | null;
}

export interface ReceiptChallanFormData {
  date: string;
  sourceType: string;
  vendorId: number | null;
  sourceName: string;
  invoiceNumber: string;
  invoiceDate: string;
  vehicleNumber: string;
  receivedBy: string;
  storeId: number | null;
  categoryId: number | null;
  remarks: string;
  serialNumber?: string | null;
  items: ReceiptChallanItem[];
}

export interface IssueChallanItem {
  itemId: number;
  unitId: number;
  quantity: number;
  locationId: number | null;
  usedAt: string;
  purpose: string;
  remarks: string;
  serialNumber?: string | null;
  demandItemId?: number;
  demandItemName?: string;
  demandRequested?: number;
  demandIssued?: number;
  demandRemaining?: number;
}

export interface IssueChallanFormData {
  date: string;
  referenceNo: string;
  sourceStoreId: number | null;
  destinationStoreId: number | null;
  departmentId: number;
  issuedBy: string;
  approvedBy: string;
  purpose: string;
  remarks: string;
  serialNumber?: string | null;
  items: IssueChallanItem[];
}

export interface TransferChallanItem {
  itemId: number;
  quantity: number;
  rate: number;
  remarks: string;
  serialNumber?: string | null;
}

export interface TransferChallanFormData {
  date: string;
  fromStoreId: number;
  toStoreId: number;
  transferredBy: string;
  approvedBy: string;
  remarks: string;
  serialNumber?: string | null;
  items: TransferChallanItem[];
}

export interface ShiftChallanItem {
  itemId: number;
  quantity: number;
  rate: number;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  remarks: string;
  serialNumber?: string | null;
}

export type ShiftMovementType = 'ROOM_TO_ROOM' | 'STORE_TO_ROOM' | 'ROOM_TO_STORE';

export interface ShiftChallanFormData {
  date: string;
  fromStoreId: number;
  toStoreId: number;
  movementType: ShiftMovementType;
  sourceLocationId?: number | null;
  destLocationId?: number | null;
  shiftedBy: string;
  approvedBy: string;
  remarks: string;
  companyId: number;
  financialYearId: number;
  status: 'Draft' | 'Posted';
  items: ShiftChallanItem[];
}

export interface ChallanItemBase {
  itemId: number;
  quantity: number;
  remarks: string;
  serialNumber?: string | null;
}

// ── Material Issue (Unified) ──────────────────────────────

export type MaterialIssuePurpose = 'general' | 'demand' | 'consumption' | 'installation' | 'asset-installation';

export interface MaterialIssueItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  unitName: string;
  unitId: number;
  quantity: number;
  maxAvailable: number;
  locationId: number | null;
  locationName: string;
  purpose: string;
  remarks: string;
  demandItemId?: number;
  demandItemName?: string;
  demandRequested?: number;
  demandIssued?: number;
  demandRemaining?: number;
}

export interface MaterialIssueFormData {
  date: string;
  referenceNo: string;
  sourceStoreId: number | null;
  destinationStoreId: number | null;
  departmentId: number;
  issuedBy: string;
  approvedBy: string;
  remarks: string;
}

// ── Material Transfer (Simplified) ────────────────────────

export interface MaterialTransferItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  unitName: string;
  quantity: number;
  maxAvailable: number;
  remarks: string;
}

export interface MaterialTransferFormData {
  date: string;
  fromStoreId: number;
  toStoreId: number;
  transferredBy: string;
  approvedBy: string;
  remarks: string;
}

// ── Movement Hub ──────────────────────────────────────────

export interface MovementAction {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  bgColor: string;
  borderColor: string;
}
