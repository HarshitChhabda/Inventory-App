export type ChallanStatus = 'Draft' | 'Posted' | 'Cancelled';
export type TransactionType = 'OpeningBalance' | 'Purchase' | 'Issue' | 'Return' | 'Transfer' | 'Adjustment' | 'Damage' | 'Scrap';
export type SourceType = 'Vendor' | 'JaipurOffice' | 'OtherBranch' | 'Donation' | 'Transfer' | 'DepartmentReturn';
export type UserRole = 'Admin' | 'StoreManager' | 'Viewer';
export type AssetStatus = 'Active' | 'Damaged' | 'Scrapped' | 'Removed';
export type DamageReason = 'Damaged' | 'Lost' | 'Broken' | 'Scrap' | 'Expired';
export type LocationType = 'Room' | 'Dharamshala';
export type ChallanType = 'RC' | 'IC' | 'DC';

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
