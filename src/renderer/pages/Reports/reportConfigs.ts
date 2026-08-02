export const REPORT_SECTIONS = [
  {
    title: 'Purchase Reports',
    iconKey: 'LocalShipping',
    color: '#16A34A',
    reports: [
      { key: 'receipt_register', name: 'Receipt Register', description: 'All receipt challans' },
      { key: 'vendor_purchase', name: 'Vendor Purchase', description: 'Vendor-wise purchases' },
      { key: 'vendor_returns', name: 'Vendor Returns', description: 'Return to vendor register' },
      { key: 'purchase_history', name: 'Purchase History', description: 'Item-wise receipt history with avg rate' },
    ],
  },
  {
    title: 'Issue Reports',
    iconKey: 'Business',
    color: '#D97706',
    reports: [
      { key: 'issue_register', name: 'Issue Register', description: 'All issue challans' },
      { key: 'department_wise', name: 'Department Wise', description: 'Consumption by department' },
      { key: 'transfer_register', name: 'Transfer Register', description: 'Stock transfers between locations' },
      { key: 'central_store_summary', name: 'Central Store Summary', description: 'Store stock & issue breakdown with KPIs' },
    ],
  },
  {
    title: 'Inventory Reports',
    iconKey: 'Inventory',
    color: '#2563EB',
    reports: [
      { key: 'stock_ledger', name: 'Stock Ledger', description: 'Complete stock movement ledger' },
      { key: 'stock_summary', name: 'Stock Summary', description: 'Current stock levels by item' },
      { key: 'item_history', name: 'Item History', description: 'Transaction history per item' },
      { key: 'movement_register', name: 'Movement Register', description: 'All stock movements' },
      { key: 'dharamshala_items', name: 'Dharamshala Items', description: 'Items in dharamshala rooms' },
      { key: 'department_stock_status', name: 'Department Stock Status', description: 'Current stock in department and rooms' },
      { key: 'current_stock_custom', name: 'Current Stock', description: 'Store-wise current stock with value' },
      { key: 'stock_distribution', name: 'Stock Distribution', description: 'Store/Dharamshala/Room wise stock breakdown' },
      { key: 'dharamshala_distribution', name: 'Dharamshala Distribution', description: 'Dharamshala-level stock & room allocation' },
      { key: 'room_facilities', name: 'Room Facilities Checklist', description: 'Installed assets per room' },
      { key: 'item_audit_ledger', name: 'Item Audit Ledger', description: 'Complete item movement history' },
    ],
  },
  {
    title: 'Analytics Reports',
    iconKey: 'Analytics',
    color: '#7C3AED',
    reports: [
      { key: 'low_stock', name: 'Low Stock Items', description: 'Items below minimum level' },
      { key: 'dead_stock', name: 'Dead Stock', description: 'Items with no movement' },
      { key: 'damage_report', name: 'Damage Report', description: 'Damaged items report' },
      { key: 'stock_adjustments', name: 'Stock Adjustments', description: 'All adjustments made' },
      { key: 'audit_log', name: 'Audit Log', description: 'System activity log' },
      { key: 'damage_scrap_returns', name: 'Damage/Scrap/Returns', description: 'Damage, scrap & vendor return audit' },
    ],
  },
];

export const REPORT_NAMES: Record<string, string> = {};
REPORT_SECTIONS.forEach((s) => s.reports.forEach((r) => { REPORT_NAMES[r.key] = r.name; }));

export const TX_TYPES = [
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'TRANSFER_IN', label: 'Transfer In' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out' },
  { value: 'ADJUSTMENT_IN', label: 'Adjustment In' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment Out' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'OPENING_STOCK', label: 'Opening Stock' },
  { value: 'VENDOR_RETURN', label: 'Vendor Return' },
  { value: 'RETURN_IN', label: 'Return In' },
  { value: 'RETURN_OUT', label: 'Return Out' },
  { value: 'REVERSAL', label: 'Reversal' },
];

export const ADJUSTMENT_TYPES = [
  { value: 'ADD', label: 'Addition' },
  { value: 'SUBTRACT', label: 'Subtraction' },
  { value: 'CORRECTION', label: 'Correction' },
];

export const AUDIT_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'POST', 'CANCEL', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'BACKUP', 'RESTORE',
];

export const EXCLUDE_KEYS = [
  'id', 'uuid', 'companyId', 'financialYearId', 'categoryId', 'unitId', 'vendorId',
  'departmentId', 'locationId', 'parentId', 'receiptChallanId', 'issueChallanId',
  'transferChallanId', 'vendorReturnChallanId', 'assetInstallationId', 'originalReceiptId',
  'createdAt', 'updatedAt', 'cancelledAt', 'postedAt', 'sourceStoreId',
  'isActive', 'isClosed', 'closedAt', 'minimumStockLevel', 'categoryId',
];

export const COLUMN_LABELS: Record<string, string> = {
  challanNo: 'Challan No', sourceType: 'Source', sourceName: 'Source Name',
  invoiceNumber: 'Invoice No', invoiceDate: 'Invoice Date', vehicleNumber: 'Vehicle No',
  receivedBy: 'Received By', issuedBy: 'Issued By', approvedBy: 'Approved By',
  transferredBy: 'Transferred By', returnedBy: 'Returned By', reportedBy: 'Reported By',
  adjustedBy: 'Adjusted By', createdBy: 'Created By', transactionType: 'Type',
  transactionDate: 'Date', quantityIn: 'Qty In', quantityOut: 'Qty Out',
  balanceQty: 'Balance', referenceType: 'Ref Type', referenceNo: 'Ref No',
  departmentType: 'Dept Type', departmentName: 'Department', itemName: 'Item',
  itemCode: 'Code', locationType: 'Location Type', locationName: 'Location',
  totalAmount: 'Total', purpose: 'Purpose', remarks: 'Remarks', adjustmentType: 'Type',
  reason: 'Reason', installedDate: 'Installed', installedBy: 'Installed By',
  totalQty: 'Total Received', rooms: 'Room No (Qty)',
  status: 'Status', totalReceived: 'Received', totalIssued: 'Issued',
  currentStock: 'Current Stock', lastMovement: 'Last Movement', name: 'Name',
  username: 'Username', action: 'Action', tableName: 'Table', description: 'Description',
  oldValues: 'Old Values', newValues: 'New Values',
  item: 'Item Name', department: 'Department', location: 'Location',
  source: 'Source', destination: 'Destination',
  vendor: 'Vendor', items: 'Items',
  quantity: 'Qty', amount: 'Amount', unitName: 'Unit', postedAt: 'Posted At',
  categoryName: 'Category',
};

export const REPORT_FILTER_MAP: Record<string, string[]> = {
  receipt_register: ['date', 'vendor', 'status', 'search'],
  issue_register: ['date', 'department', 'status', 'search'],
  stock_ledger: ['date', 'item', 'department', 'txType', 'search'],
  current_stock_custom: ['department', 'category', 'search'],
  stock_distribution: ['item', 'category', 'department', 'location', 'search'],
  stock_summary: ['search'],
  low_stock: ['item', 'category', 'lowStock', 'search'],
  dead_stock: ['item', 'category', 'search'],
  damage_report: ['date', 'item', 'location', 'status', 'search'],
  department_wise: ['date', 'item', 'department', 'txType', 'search'],
  department_stock_status: ['department', 'search'],
  vendor_purchase: ['date', 'vendor', 'search'],
  item_history: ['date', 'item', 'department', 'search'],
  movement_register: ['date', 'item', 'department', 'txType', 'search'],
  transfer_register: ['date', 'department', 'search'],
  vendor_returns: ['date', 'vendor', 'search'],
  purchase_history: ['date', 'item', 'category', 'search'],
  stock_adjustments: ['date', 'item', 'adjustmentType', 'search'],
  audit_log: ['date', 'auditFilters', 'search'],
  dharamshala_items: ['search'],
  central_store_summary: ['department', 'category', 'date', 'search'],
  dharamshala_distribution: ['department', 'search'],
  room_facilities: ['department', 'location', 'search'],
  item_audit_ledger: ['item', 'date', 'search'],
  damage_scrap_returns: ['date', 'category', 'search'],
};
