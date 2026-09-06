import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Database
  getDbPath: () => ipcRenderer.invoke('db:getPath'),
  dbQuery: (model: string, method: string, ...args: any[]) =>
    ipcRenderer.invoke('db:query', model, method, ...args),

  // Challan Post/Cancel (proper stock transaction handlers)
  saveReceiptChallan: (payload: any, items: any[], isEdit: boolean, id?: number) =>
    ipcRenderer.invoke('challan:receipt:save', payload, items, isEdit, id),
  saveIssueChallan: (payload: any, items: any[], isEdit: boolean, id?: number) =>
    ipcRenderer.invoke('challan:issue:save', payload, items, isEdit, id),
  saveTransferChallan: (payload: any, items: any[], isEdit: boolean, id?: number) =>
    ipcRenderer.invoke('challan:transfer:save', payload, items, isEdit, id),
  createReceiptChallanImport: (data: any) => ipcRenderer.invoke('challan:receipt:createImport', data),
  createIssueChallanImport: (data: any) => ipcRenderer.invoke('challan:issue:createImport', data),
  createTransferChallanImport: (data: any) => ipcRenderer.invoke('challan:transfer:createImport', data),
  postReceiptChallan: (id: number) => ipcRenderer.invoke('challan:receipt:post', id),
  cancelReceiptChallan: (id: number, reason: string) => ipcRenderer.invoke('challan:receipt:cancel', id, reason),
  deleteReceiptChallan: (id: number) => ipcRenderer.invoke('challan:receipt:delete', id),
  postIssueChallan: (id: number) => ipcRenderer.invoke('challan:issue:post', id),
  cancelIssueChallan: (id: number, reason: string) => ipcRenderer.invoke('challan:issue:cancel', id, reason),
  deleteIssueChallan: (id: number) => ipcRenderer.invoke('challan:issue:delete', id),
  postTransferChallan: (id: number) => ipcRenderer.invoke('challan:transfer:post', id),
  cancelTransferChallan: (id: number, reason: string) => ipcRenderer.invoke('challan:transfer:cancel', id, reason),
  deleteTransferChallan: (id: number) => ipcRenderer.invoke('challan:transfer:delete', id),
  saveShiftChallan: (payload: any, items: any[], shiftType: string, isEdit: boolean, id?: number) =>
    ipcRenderer.invoke('challan:shift:save', payload, items, shiftType, isEdit, id),
  listShiftChallans: (shiftType: string) => ipcRenderer.invoke('challan:shift:list', shiftType),
  postShiftChallan: (id: number) => ipcRenderer.invoke('challan:shift:post', id),
  cancelShiftChallan: (id: number, reason: string) => ipcRenderer.invoke('challan:shift:cancel', id, reason),
  deleteShiftChallan: (id: number) => ipcRenderer.invoke('challan:shift:delete', id),
  createDamageEntry: (data: any) => ipcRenderer.invoke('challan:damage:create', data),
  sendToRepair: (data: any) => ipcRenderer.invoke('challan:repair:send', data),
  receiveFromRepair: (data: any) => ipcRenderer.invoke('challan:repair:receive', data),
  createScrapEntry: (data: any) => ipcRenderer.invoke('challan:scrap:create', data),
  createStockAdjustment: (data: any) => ipcRenderer.invoke('challan:adjustment:create', data),
  createVendorReturn: (data: any) => ipcRenderer.invoke('challan:vendorReturn:create', data),
  postVendorReturn: (id: number, departmentId?: number | null) => ipcRenderer.invoke('challan:vendorReturn:post', id, departmentId),
  loadDemoData: () => ipcRenderer.invoke('demo:load'),
  clearDemoData: () => ipcRenderer.invoke('demo:clear'),

  // Backup
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  getStorageInfo: () => ipcRenderer.invoke('backup:getStorageInfo'),
  restoreBackup: (path: string) => ipcRenderer.invoke('backup:restore', path),
  getExportsDir: () => ipcRenderer.invoke('backup:getExportsDir'),
  changeBackupLocation: (dir: string) => ipcRenderer.invoke('backup:changeLocation', dir),
  getBackupLocation: () => ipcRenderer.invoke('backup:getLocation'),

  // Shell
  openFolder: (path: string) => ipcRenderer.invoke('shell:openFolder', path),

  // Dialog
  saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
  showMessage: (options: any) => ipcRenderer.invoke('dialog:showMessage', options),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  getUpdateInfo: () => ipcRenderer.invoke('app:getUpdateInfo'),

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // Historical room-level opening stock
  createRoomLevelOpeningStock: (data: any) => ipcRenderer.invoke('stock:opening-stock:create-room-level', data),
  bulkImportOpeningStock: (data: any) => ipcRenderer.invoke('stock:opening-stock:bulk-import', data),
  undoOpeningStockImport: (data: any) => ipcRenderer.invoke('stock:opening-stock:undoImport', data),
  generateOpeningStockTemplate: (type?: string) => ipcRenderer.invoke('stock:opening-stock:generateTemplate', type),

  // Import History
  listImportHistory: (companyId: number) => ipcRenderer.invoke('import-history:list', companyId),
  createImportHistory: (data: any) => ipcRenderer.invoke('import-history:create', data),
  deleteImportHistory: (data: any) => ipcRenderer.invoke('import-history:delete', data),

  // Room-to-room shift
  shiftRoomStock: (data: any) => ipcRenderer.invoke('stock:room-shift', data),

  // Return stock to store
  returnToStore: (data: any) => ipcRenderer.invoke('stock:return-to-store', data),

  // Stock breakdown for drill-down
  getIssueBreakdown: (companyId: number, financialYearId: number, itemId: number) =>
    ipcRenderer.invoke('stock:getIssueBreakdown', companyId, financialYearId, itemId),

  // Item History Paginated
  getItemHistoryPaginated: (params: {
    companyId: number; financialYearId: number; itemId: number;
    storeId?: number; locationId?: number; departmentId?: number;
    startDate?: string; endDate?: string; voucherType?: string;
    movementType?: string; page?: number; pageSize?: number;
  }) => ipcRenderer.invoke('stock:getItemHistoryPaginated', params),

  // Stock formula validation
  validateItemStock: (companyId: number, financialYearId: number, itemId: number, departmentId?: number | null, locationId?: number | null) =>
    ipcRenderer.invoke('stock:validateFormula', companyId, financialYearId, itemId, departmentId, locationId),
  validateAllStock: (companyId: number, financialYearId: number) =>
    ipcRenderer.invoke('stock:validateAll', companyId, financialYearId),
  getItemStockSummary: (companyId: number, financialYearId: number, itemId: number) =>
    ipcRenderer.invoke('stock:getItemSummary', companyId, financialYearId, itemId),

  // Dashboard aggregated data
  getDashboardData: (companyId: number, financialYearId: number) =>
    ipcRenderer.invoke('dashboard:getData', companyId, financialYearId),

  // PDF text extraction
  extractTextFromPdf: (buffer: ArrayBuffer) => ipcRenderer.invoke('pdf:extractText', buffer),

  // PDF generation
  generatePdf: (htmlContent: string, options?: { fileName?: string; width?: number; height?: number }) =>
    ipcRenderer.invoke('pdf:generate', htmlContent, options),
  generatePdfFromPrint: (data: { type: string; challanData: any }) =>
    ipcRenderer.invoke('pdf:generateFromPrint', data),

  // Import/Export
  readFileBuffer: (filePath: string) => ipcRenderer.invoke('import:readFile', filePath),
  parseImportFile: (buffer: ArrayBuffer, fileName: string) => ipcRenderer.invoke('import:parseFile', buffer, fileName),
  exportExcel: (data: any[], columns: any[], fileName: string) => ipcRenderer.invoke('import:exportExcel', data, columns, fileName),
  exportCSV: (data: any[], columns: any[]) => ipcRenderer.invoke('import:exportCSV', data, columns),
  exportStockReport: (reportData: any) => ipcRenderer.invoke('export:stockReport', reportData),
  bulkUpsert: (model: string, data: any[], matchField: string, companyId?: number) => ipcRenderer.invoke('import:bulkUpsert', model, data, matchField, companyId),
  validateImportRows: (model: string, data: any[], matchField: string, companyId?: number) => ipcRenderer.invoke('import:validateRows', model, data, matchField, companyId),
  bulkUpsertWithValidation: (model: string, data: any[], matchField: string, companyId?: number, dryRun?: boolean) => ipcRenderer.invoke('import:bulkUpsertWithValidation', model, data, matchField, companyId, dryRun),
  exportAllTables: () => ipcRenderer.invoke('import:exportAllTables'),
  exportAllTablesComplete: () => ipcRenderer.invoke('import:exportAllTablesComplete'),
  getImportTables: () => ipcRenderer.invoke('import:getTables'),
  generateImportTemplate: (model: string) => ipcRenderer.invoke('import:generateTemplate', model),
  getBackupInfo: () => ipcRenderer.invoke('backup:getInfo'),

  // Auth
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  changePassword: (currentPassword: string, newPassword: string) => ipcRenderer.invoke('auth:changePassword', currentPassword, newPassword),
  hasPermission: (permissionKey: string) => ipcRenderer.invoke('auth:hasPermission', permissionKey),
  getPermissionKeys: () => ipcRenderer.invoke('auth:getPermissionKeys'),
  listUsers: () => ipcRenderer.invoke('auth:listUsers'),
  createUser: (data: any) => ipcRenderer.invoke('auth:createUser', data),
  updateUser: (userId: number, data: any) => ipcRenderer.invoke('auth:updateUser', userId, data),
  adminResetPassword: (userId: number, newPassword: string) => ipcRenderer.invoke('auth:adminResetPassword', userId, newPassword),
  deleteUser: (userId: number) => ipcRenderer.invoke('auth:deleteUser', userId),

  // Master Data (create/update/delete goes through dedicated handlers)
  createCategory: (data: any) => ipcRenderer.invoke('masterData:createCategory', data),
  updateCategory: (id: number, data: any) => ipcRenderer.invoke('masterData:updateCategory', id, data),
  deleteCategory: (id: number) => ipcRenderer.invoke('masterData:deleteCategory', id),
  createUnit: (data: any) => ipcRenderer.invoke('masterData:createUnit', data),
  updateUnit: (id: number, data: any) => ipcRenderer.invoke('masterData:updateUnit', id, data),
  deleteUnit: (id: number) => ipcRenderer.invoke('masterData:deleteUnit', id),
  createItem: (data: any) => ipcRenderer.invoke('masterData:createItem', data),
  updateItem: (id: number, data: any) => ipcRenderer.invoke('masterData:updateItem', id, data),
  deleteItem: (id: number) => ipcRenderer.invoke('masterData:deleteItem', id),
  createVendor: (data: any) => ipcRenderer.invoke('masterData:createVendor', data),
  updateVendor: (id: number, data: any) => ipcRenderer.invoke('masterData:updateVendor', id, data),
  deleteVendor: (id: number) => ipcRenderer.invoke('masterData:deleteVendor', id),
  createDepartment: (data: any) => ipcRenderer.invoke('masterData:createDepartment', data),
  updateDepartment: (id: number, data: any) => ipcRenderer.invoke('masterData:updateDepartment', id, data),
  deleteDepartment: (id: number) => ipcRenderer.invoke('masterData:deleteDepartment', id),
  toggleDepartment: (id: number) => ipcRenderer.invoke('masterData:toggleDepartment', id),
  createLocation: (data: any) => ipcRenderer.invoke('masterData:createLocation', data),
  updateLocation: (id: number, data: any) => ipcRenderer.invoke('masterData:updateLocation', id, data),
  deleteLocation: (id: number) => ipcRenderer.invoke('masterData:deleteLocation', id),
  createDharmshala: (data: any) => ipcRenderer.invoke('masterData:createDharmshala', data),
  listDharmshalas: (companyId: number) => ipcRenderer.invoke('masterData:listDharmshalas', companyId),
  bulkCreate: (model: string, rows: any[]) => ipcRenderer.invoke('masterData:bulkCreate', model, rows),
  bulkUpdate: (model: string, idField: string, rows: any[]) => ipcRenderer.invoke('masterData:bulkUpdate', model, idField, rows),
  bulkUpsertMaster: (model: string, idField: string, rows: any[]) => ipcRenderer.invoke('masterData:bulkUpsert', model, idField, rows),

  // Settings
  createCompany: (data: any) => ipcRenderer.invoke('settings:createCompany', data),
  updateCompany: (id: number, data: any) => ipcRenderer.invoke('settings:updateCompany', id, data),
  deleteCompany: (id: number) => ipcRenderer.invoke('settings:deleteCompany', id),
  toggleCompany: (id: number) => ipcRenderer.invoke('settings:toggleCompany', id),
  getCompanyDeletionDependencyInfo: (id: number) => ipcRenderer.invoke('settings:getCompanyDeletionDependencyInfo', id),
  permanentDeleteCompany: (id: number, confirmName: string) => ipcRenderer.invoke('settings:permanentDeleteCompany', id, confirmName),
  createFinancialYear: (data: any) => ipcRenderer.invoke('settings:createFinancialYear', data),
  updateFinancialYear: (id: number, data: any) => ipcRenderer.invoke('settings:updateFinancialYear', id, data),
  closeFinancialYear: (fyId: number) => ipcRenderer.invoke('settings:closeFinancialYear', fyId),
  getCurrentFinancialYear: (companyId: number) => ipcRenderer.invoke('fy:current', companyId),
  getFYCompanyInfo: (fyLabel: string) => ipcRenderer.invoke('settings:getFYCompanyInfo', fyLabel),
  deleteFYFromCompanies: (fyLabel: string, companyIds: number[]) => ipcRenderer.invoke('settings:deleteFYFromCompanies', fyLabel, companyIds),

  // Installation
  installItems: (data: any) => ipcRenderer.invoke('installation:install', data),
  uninstallItems: (data: any) => ipcRenderer.invoke('installation:uninstall', data),
  getActiveInstallations: (companyId: number, itemId?: number) => ipcRenderer.invoke('installation:getActive', companyId, itemId),
  getInstallationsByLocation: (locationId: number) => ipcRenderer.invoke('installation:getByLocation', locationId),

  // ============================================================
  // ENTERPRISE INVENTORY ENGINE
  // ============================================================

  // System Configuration
  getConfig: (companyId: number, key: string) => ipcRenderer.invoke('config:get', companyId, key),
  getConfigBool: (companyId: number, key: string) => ipcRenderer.invoke('config:getBool', companyId, key),
  getConfigNumber: (companyId: number, key: string) => ipcRenderer.invoke('config:getNumber', companyId, key),
  setConfig: (companyId: number, key: string, value: string, category?: string, description?: string) => ipcRenderer.invoke('config:set', companyId, key, value, category, description),
  getAllConfigs: (companyId: number, category?: string) => ipcRenderer.invoke('config:getAll', companyId, category),
  deleteConfig: (companyId: number, key: string) => ipcRenderer.invoke('config:delete', companyId, key),
  initializeDefaultConfigs: (companyId: number) => ipcRenderer.invoke('config:initializeDefaults', companyId),

  // Store Master
  createStore: (data: any) => ipcRenderer.invoke('store:create', data),
  updateStore: (id: number, data: any) => ipcRenderer.invoke('store:update', id, data),
  getStoreById: (id: number) => ipcRenderer.invoke('store:getById', id),
  listStores: (companyId: number, storeType?: string) => ipcRenderer.invoke('store:list', companyId, storeType),
  deleteStore: (id: number) => ipcRenderer.invoke('store:delete', id),
  toggleStore: (id: number) => ipcRenderer.invoke('store:toggle', id),
  bulkCreateStores: (stores: any[]) => ipcRenderer.invoke('store:bulkCreate', stores),
  getMainStores: (companyId: number) => ipcRenderer.invoke('store:getMainStores', companyId),
  getStoresByType: (companyId: number, storeType: string) => ipcRenderer.invoke('store:getByType', companyId, storeType),
  getStoreHierarchy: (companyId: number) => ipcRenderer.invoke('store:getHierarchy', companyId),

  // Location Master (enhanced)
  createLocationEnterprise: (data: any) => ipcRenderer.invoke('location:create', data),
  updateLocationEnterprise: (id: number, data: any) => ipcRenderer.invoke('location:update', id, data),
  getLocationById: (id: number) => ipcRenderer.invoke('location:getById', id),
  listLocations: (companyId: number, locationType?: string, storeId?: number) => ipcRenderer.invoke('location:list', companyId, locationType, storeId),
  deleteLocationEnterprise: (id: number) => ipcRenderer.invoke('location:delete', id),
  getLocationHierarchy: (companyId: number) => ipcRenderer.invoke('location:getHierarchy', companyId),

  // Item Master (enhanced)
  createItemEnterprise: (data: any) => ipcRenderer.invoke('item:create', data),
  updateItemEnterprise: (id: number, data: any) => ipcRenderer.invoke('item:update', id, data),
  getItemById: (id: number) => ipcRenderer.invoke('item:getById', id),
  listItemsEnterprise: (companyId: number, categoryId?: number, itemType?: string, isSerialized?: boolean) => ipcRenderer.invoke('item:list', companyId, categoryId, itemType, isSerialized),
  deleteItemEnterprise: (id: number) => ipcRenderer.invoke('item:delete', id),
  createSerializedItem: (data: any) => ipcRenderer.invoke('item:createSerialized', data),
  getSerializedItems: (itemId: number, storeId?: number) => ipcRenderer.invoke('item:getSerialized', itemId, storeId),
  updateSerializedItemStatus: (id: number, status: string, locationId?: number) => ipcRenderer.invoke('item:updateSerializedStatus', id, status, locationId),

  // Transfer Matrix
  initializeTransferMatrix: (companyId: number) => ipcRenderer.invoke('transferMatrix:initializeDefaults', companyId),
  isTransferAllowed: (companyId: number, fromStoreType: string, toStoreType: string) => ipcRenderer.invoke('transferMatrix:isAllowed', companyId, fromStoreType, toStoreType),
  updateTransferRule: (companyId: number, fromStoreType: string, toStoreType: string, isAllowed: boolean, requiresApproval: boolean) => ipcRenderer.invoke('transferMatrix:updateRule', companyId, fromStoreType, toStoreType, isAllowed, requiresApproval),
  getTransferRules: (companyId: number) => ipcRenderer.invoke('transferMatrix:getRules', companyId),
  validateTransfer: (companyId: number, fromStoreId: number, toStoreId: number) => ipcRenderer.invoke('transferMatrix:validate', companyId, fromStoreId, toStoreId),

  // Installation Engine (new)
  installItemsEnterprise: (data: any) => ipcRenderer.invoke('installation:install', data),
  uninstallItemsEnterprise: (data: any) => ipcRenderer.invoke('installation:uninstall', data),
  shiftInstallation: (data: any) => ipcRenderer.invoke('installation:shift', data),
  getInstallationsByStore: (storeId: number) => ipcRenderer.invoke('installation:getByStore', storeId),
  getInstallationSummary: (companyId: number) => ipcRenderer.invoke('installation:getSummary', companyId),

  // ============================================================
  // UNIVERSAL MOVEMENT ENGINE
  // ============================================================

  // Create movement (universal entry point — replaces all challan-specific methods)
  createMovement: (data: any) => ipcRenderer.invoke('tx:create', data),

  // Workflow
  approveMovement: (companyId: number, transactionId: number, approvedBy: string) => ipcRenderer.invoke('tx:approve', companyId, transactionId, approvedBy),
  rejectMovement: (companyId: number, transactionId: number, rejectedBy: string, reason: string) => ipcRenderer.invoke('tx:reject', companyId, transactionId, rejectedBy, reason),
  cancelMovement: (companyId: number, transactionId: number, cancelledBy: string, reason: string) => ipcRenderer.invoke('tx:cancel', companyId, transactionId, cancelledBy, reason),

  // Movement Registry
  getMovementTypes: () => ipcRenderer.invoke('movement:getAll'),
  getMovementType: (code: string) => ipcRenderer.invoke('movement:getByCode', code),
  getMovementTypesByCategory: (category: string) => ipcRenderer.invoke('movement:getByCategory', category),
  getMovementCategories: () => ipcRenderer.invoke('movement:getCategories'),

  // Stock Engine
  getStockBalance: (companyId: number, financialYearId: number, itemId: number, storeId: number) => ipcRenderer.invoke('stock:getBalance', companyId, financialYearId, itemId, storeId),
  getStockBreakdown: (companyId: number, financialYearId: number, itemId: number, storeId: number) => ipcRenderer.invoke('stock:getBreakdown', companyId, financialYearId, itemId, storeId),
  getStoreStock: (companyId: number, financialYearId: number, storeId: number) => ipcRenderer.invoke('stock:getStoreStock', companyId, financialYearId, storeId),
  getItemStockAcrossStores: (companyId: number, financialYearId: number, itemId: number) => ipcRenderer.invoke('stock:getItemAcrossStores', companyId, financialYearId, itemId),
  getLocationItems: (companyId: number, financialYearId: number, roomId: number) => ipcRenderer.invoke('stock:getLocationItems', companyId, financialYearId, roomId),
  getAllLocationItems: (companyId: number, financialYearId: number) => ipcRenderer.invoke('stock:getAllLocationItems', companyId, financialYearId),
  getLowStockAlerts: (companyId: number, financialYearId: number) => ipcRenderer.invoke('stock:getLowStockAlerts', companyId, financialYearId),
  validateStock: (companyId: number, financialYearId: number, itemId: number, storeId: number, quantity: number) => ipcRenderer.invoke('stock:validate', companyId, financialYearId, itemId, storeId, quantity),

  // Voucher Engine
  previewVoucherNo: (companyId: number, financialYearId: number, voucherType: string) => ipcRenderer.invoke('voucher:preview', companyId, financialYearId, voucherType),
  getCurrentSequence: (companyId: number, financialYearId: number, voucherType: string) => ipcRenderer.invoke('voucher:currentSequence', companyId, financialYearId, voucherType),
  isValidVoucherType: (type: string) => ipcRenderer.invoke('voucher:isValidType', type),
  getVoucherPrefixes: () => ipcRenderer.invoke('voucher:getPrefixes'),

  // Data Migration
  migrateData: (companyId: number) => ipcRenderer.invoke('migration:migrate', companyId),
  isMigrationNeeded: (companyId: number) => ipcRenderer.invoke('migration:isNeeded', companyId),

  // ─── Digital Asset Registry ──────────────────────
  // Asset CRUD
  createAsset: (data: any) => ipcRenderer.invoke('asset:create', data),
  getAsset: (id: number) => ipcRenderer.invoke('asset:get', id),
  getAssetByCode: (assetCode: string) => ipcRenderer.invoke('asset:getByCode', assetCode),
  updateAsset: (id: number, data: any) => ipcRenderer.invoke('asset:update', id, data),
  deleteAsset: (id: number) => ipcRenderer.invoke('asset:delete', id),

  // Asset Search
  searchAssets: (filters: any) => ipcRenderer.invoke('asset:search', filters),

  // Asset Lifecycle
  installAsset: (assetId: number, storeId: number, locationId?: number, roomId?: number, departmentId?: number, installedBy?: string, remarks?: string) =>
    ipcRenderer.invoke('asset:install', assetId, storeId, locationId, roomId, departmentId, installedBy, remarks),
  uninstallAsset: (assetId: number, uninstalledBy?: string, remarks?: string) =>
    ipcRenderer.invoke('asset:uninstall', assetId, uninstalledBy, remarks),
  transferAsset: (assetId: number, toStoreId: number, toLocationId?: number, toRoomId?: number, toDepartmentId?: number, transactionId?: number, voucherNo?: string, performedBy?: string, reason?: string, remarks?: string) =>
    ipcRenderer.invoke('asset:transfer', assetId, toStoreId, toLocationId, toRoomId, toDepartmentId, transactionId, voucherNo, performedBy, reason, remarks),
  repairAsset: (assetId: number, data: any) => ipcRenderer.invoke('asset:repair', assetId, data),
  damageAsset: (assetId: number, condition: string, reportedBy?: string, remarks?: string) =>
    ipcRenderer.invoke('asset:damage', assetId, condition, reportedBy, remarks),
  scrapAsset: (assetId: number, performedBy?: string, remarks?: string) =>
    ipcRenderer.invoke('asset:scrap', assetId, performedBy, remarks),
  disposeAsset: (assetId: number, reason: string, performedBy?: string) =>
    ipcRenderer.invoke('asset:dispose', assetId, reason, performedBy),

  // Asset Timeline
  getAssetTimeline: (assetId: number) => ipcRenderer.invoke('asset:timeline', assetId),
  addAssetTimelineEvent: (assetId: number, eventType: string, data: any) =>
    ipcRenderer.invoke('asset:addTimelineEvent', assetId, eventType, data),

  // Asset Photos & Documents
  addAssetPhoto: (assetId: number, photoType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, caption?: string, takenBy?: string) =>
    ipcRenderer.invoke('asset:addPhoto', assetId, photoType, fileName, filePath, fileSize, mimeType, caption, takenBy),
  getAssetPhotos: (assetId: number, photoType?: string) => ipcRenderer.invoke('asset:getPhotos', assetId, photoType),
  deleteAssetPhoto: (photoId: number) => ipcRenderer.invoke('asset:deletePhoto', photoId),
  addAssetDocument: (assetId: number, documentType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, description?: string, uploadedBy?: string) =>
    ipcRenderer.invoke('asset:addDocument', assetId, documentType, fileName, filePath, fileSize, mimeType, description, uploadedBy),
  getAssetDocuments: (assetId: number, documentType?: string) => ipcRenderer.invoke('asset:getDocuments', assetId, documentType),
  deleteAssetDocument: (docId: number) => ipcRenderer.invoke('asset:deleteDocument', docId),

  // Asset Reports
  getInstalledAssetsReport: (companyId: number) => ipcRenderer.invoke('asset:report:installed', companyId),
  getWarrantyExpiringReport: (companyId: number, days?: number) => ipcRenderer.invoke('asset:report:warrantyExpiring', companyId, days),
  getAmcExpiringReport: (companyId: number, days?: number) => ipcRenderer.invoke('asset:report:amcExpiring', companyId, days),
  getRepairHistoryReport: (companyId: number) => ipcRenderer.invoke('asset:report:repairHistory', companyId),
  getAssetHealthReport: (companyId: number) => ipcRenderer.invoke('asset:report:health', companyId),
  getAssetAgeReport: (companyId: number) => ipcRenderer.invoke('asset:report:age', companyId),
  getScrappedAssetsReport: (companyId: number) => ipcRenderer.invoke('asset:report:scrapped', companyId),
  getDisposedAssetsReport: (companyId: number) => ipcRenderer.invoke('asset:report:disposed', companyId),
  getLostAssetsReport: (companyId: number) => ipcRenderer.invoke('asset:report:lost', companyId),
  getReplacementSuggestions: (companyId: number, costThreshold?: number, repairThreshold?: number) =>
    ipcRenderer.invoke('asset:report:replacementSuggestions', companyId, costThreshold, repairThreshold),

  // Asset Dashboard
  getAssetDashboard: (companyId: number) => ipcRenderer.invoke('asset:dashboard', companyId),

  // Asset Import
  importAssets: (companyId: number, assets: any[]) => ipcRenderer.invoke('asset:import', companyId, assets),
  bulkUpdateAssetCondition: (assetIds: number[], condition: string, updatedBy?: string) =>
    ipcRenderer.invoke('asset:bulkUpdateCondition', assetIds, condition, updatedBy),

  // Asset Expiry Reminders
  getExpiringWarranties: (companyId: number, days?: number) => ipcRenderer.invoke('asset:expiringWarranties', companyId, days),
  getExpiringAMCs: (companyId: number, days?: number) => ipcRenderer.invoke('asset:expiringAMCs', companyId, days),
  getEndOfLifeAssets: (companyId: number) => ipcRenderer.invoke('asset:endOfLife', companyId),

  // Asset QR Code
  generateAssetQR: (assetId: number) => ipcRenderer.invoke('asset:qr:generate', assetId),
  printAssetQR: (assetId: number) => ipcRenderer.invoke('asset:qr:print', assetId),

  // Asset File Upload
  selectAssetFile: (options?: { type?: 'photo' | 'document' }) => ipcRenderer.invoke('asset:file:select', options),
  copyAssetFileToStorage: (sourcePath: string, assetCode: string, subfolder: string) => ipcRenderer.invoke('asset:file:copyToAssets', sourcePath, assetCode, subfolder),

  // ─── REQUISITION & APPROVAL WORKFLOW ────────────

  // Requisition CRUD
  createRequisition: (data: any) => ipcRenderer.invoke('req:create', data),
  getRequisition: (id: number) => ipcRenderer.invoke('req:get', id),
  getRequisitionByNumber: (number: string) => ipcRenderer.invoke('req:getByNumber', number),
  searchRequisitions: (filters: any) => ipcRenderer.invoke('req:search', filters),
  updateRequisition: (id: number, data: any) => ipcRenderer.invoke('req:update', id, data),
  submitRequisition: (id: number) => ipcRenderer.invoke('req:submit', id),
  cancelRequisition: (id: number, reason?: string) => ipcRenderer.invoke('req:cancel', id, reason),
  closeRequisition: (id: number) => ipcRenderer.invoke('req:close', id),
  reopenRequisition: (id: number) => ipcRenderer.invoke('req:reopen', id),

  // Approval Actions
  approveRequest: (data: any) => ipcRenderer.invoke('req:approve', data),
  rejectRequest: (data: any) => ipcRenderer.invoke('req:reject', data),
  returnRequest: (data: any) => ipcRenderer.invoke('req:return', data),
  holdRequest: (data: any) => ipcRenderer.invoke('req:hold', data),
  partialApproveRequest: (data: any) => ipcRenderer.invoke('req:partialApprove', data),
  forwardRequest: (data: any) => ipcRenderer.invoke('req:forward', data),
  escalateRequest: (data: any) => ipcRenderer.invoke('req:escalate', data),

  // Pending Approvals
  getPendingApprovals: (userId: number, companyId: number) => ipcRenderer.invoke('req:pendingApprovals', userId, companyId),

  // Conversion
  convertRequisition: (data: any) => ipcRenderer.invoke('req:convert', data),
  bulkConvertRequisitions: (ids: number[], companyId: number, fyId: number, userId: number, userName: string, postedBy: string) =>
    ipcRenderer.invoke('req:bulkConvert', ids, companyId, fyId, userId, userName, postedBy),
  checkRequisitionStock: (reqId: number) => ipcRenderer.invoke('req:checkStock', reqId),

  // Workflow Config
  createWorkflow: (data: any) => ipcRenderer.invoke('req:createWorkflow', data),
  getWorkflow: (id: number) => ipcRenderer.invoke('req:getWorkflow', id),
  getWorkflows: (companyId: number, type?: string) => ipcRenderer.invoke('req:getWorkflows', companyId, type),
  getActiveWorkflow: (companyId: number, type: string) => ipcRenderer.invoke('req:getActiveWorkflow', companyId, type),
  updateWorkflow: (id: number, data: any) => ipcRenderer.invoke('req:updateWorkflow', id, data),
  deleteWorkflow: (id: number) => ipcRenderer.invoke('req:deleteWorkflow', id),
  toggleWorkflow: (id: number, enabled: boolean) => ipcRenderer.invoke('req:toggleWorkflow', id, enabled),
  seedWorkflows: (companyId: number) => ipcRenderer.invoke('req:seedWorkflows', companyId),
  isWorkflowEnabled: (companyId: number, type: string) => ipcRenderer.invoke('req:isWorkflowEnabled', companyId, type),
  getWorkflowTypes: () => ipcRenderer.invoke('req:getWorkflowTypes'),

  // Approval Levels
  addApprovalLevel: (data: any) => ipcRenderer.invoke('req:addApprovalLevel', data),
  updateApprovalLevel: (id: number, data: any) => ipcRenderer.invoke('req:updateApprovalLevel', id, data),
  deleteApprovalLevel: (id: number) => ipcRenderer.invoke('req:deleteApprovalLevel', id),
  getApprovalLevels: (workflowId: number) => ipcRenderer.invoke('req:getApprovalLevels', workflowId),

  // Dashboard & Reports
  getRequisitionDashboard: (companyId: number) => ipcRenderer.invoke('req:dashboard', companyId),
  getRequisitionRegister: (companyId: number, dateFrom?: Date, dateTo?: Date) => ipcRenderer.invoke('req:report:register', companyId, dateFrom, dateTo),
  getApprovalRegister: (companyId: number) => ipcRenderer.invoke('req:report:approvalRegister', companyId),
  getPendingRequestReport: (companyId: number) => ipcRenderer.invoke('req:report:pending', companyId),
  getRejectedRequestReport: (companyId: number) => ipcRenderer.invoke('req:report:rejected', companyId),
  getUserWiseRequests: (companyId: number, userId: number) => ipcRenderer.invoke('req:report:userWise', companyId, userId),
  getDepartmentWiseRequests: (companyId: number) => ipcRenderer.invoke('req:report:departmentWise', companyId),
  getIssuedAgainstRequest: (companyId: number) => ipcRenderer.invoke('req:report:issuedAgainst', companyId),

  // Notifications
  getRequisitionNotifications: (userId: number, options?: any) => ipcRenderer.invoke('req:notifications', userId, options),
  markNotificationRead: (id: number) => ipcRenderer.invoke('req:markRead', id),
  markAllNotificationsRead: (userId: number) => ipcRenderer.invoke('req:markAllRead', userId),
  getUnreadNotificationCount: (userId: number) => ipcRenderer.invoke('req:unreadCount', userId),
  getNotificationStats: (companyId: number) => ipcRenderer.invoke('req:notificationStats', companyId),

  // ─── PROCUREMENT & PURCHASE ────────────────────

  // Vendor CRUD (Procurement)
  createVendorP: (data: any) => ipcRenderer.invoke('vendor:create', data),
  getVendorP: (id: number) => ipcRenderer.invoke('vendor:get', id),
  getVendorPByCode: (code: string) => ipcRenderer.invoke('vendor:getByCode', code),
  updateVendorP: (id: number, data: any) => ipcRenderer.invoke('vendor:update', id, data),
  deleteVendorP: (id: number) => ipcRenderer.invoke('vendor:delete', id),
  searchVendorsP: (filters: any) => ipcRenderer.invoke('vendor:search', filters),
  toggleVendorP: (id: number, isActive: boolean) => ipcRenderer.invoke('vendor:toggle', id, isActive),
  updateVendorPRating: (id: number, rating: number) => ipcRenderer.invoke('vendor:updateRating', id, rating),
  getVendorPPerformance: (vendorId: number) => ipcRenderer.invoke('vendor:performance', vendorId),
  getVendorPDashboard: (companyId: number) => ipcRenderer.invoke('vendor:dashboard', companyId),

  // Vendor Documents
  addVendorDocument: (vendorId: number, docType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, desc?: string, uploadedBy?: string) =>
    ipcRenderer.invoke('vendor:addDocument', vendorId, docType, fileName, filePath, fileSize, mimeType, desc, uploadedBy),
  getVendorDocuments: (vendorId: number) => ipcRenderer.invoke('vendor:getDocuments', vendorId),
  deleteVendorDocument: (docId: number) => ipcRenderer.invoke('vendor:deleteDocument', docId),

  // Item-Vendor Mapping
  addItemVendorMapping: (data: any) => ipcRenderer.invoke('vendor:addItemMapping', data),
  getItemVendorMappings: (itemId: number) => ipcRenderer.invoke('vendor:getItemMappings', itemId),
  deleteItemVendorMapping: (id: number) => ipcRenderer.invoke('vendor:deleteItemMapping', id),

  // Purchase Order
  createPO: (data: any) => ipcRenderer.invoke('po:create', data),
  getPO: (id: number) => ipcRenderer.invoke('po:get', id),
  searchPOs: (filters: any) => ipcRenderer.invoke('po:search', filters),
  updatePO: (id: number, data: any) => ipcRenderer.invoke('po:update', id, data),
  approvePO: (id: number, approvedBy: string) => ipcRenderer.invoke('po:approve', id, approvedBy),
  orderPO: (id: number, orderedBy: string) => ipcRenderer.invoke('po:order', id, orderedBy),
  cancelPO: (id: number) => ipcRenderer.invoke('po:cancel', id),
  closePO: (id: number) => ipcRenderer.invoke('po:close', id),
  getPODashboard: (companyId: number) => ipcRenderer.invoke('po:dashboard', companyId),

  // Goods Receipt
  createGRN: (data: any) => ipcRenderer.invoke('grn:create', data),
  getGRN: (id: number) => ipcRenderer.invoke('grn:get', id),
  searchGRNs: (filters: any) => ipcRenderer.invoke('grn:search', filters),
  recordQC: (data: any) => ipcRenderer.invoke('grn:recordQC', data),
  postGRNToInventory: (grnId: number, postedById: string) => ipcRenderer.invoke('grn:postToInventory', grnId, postedById),
  getGRNDashboard: (companyId: number) => ipcRenderer.invoke('grn:dashboard', companyId),

  // Purchase & Price History
  getPurchaseHistory: (companyId: number, itemId?: number, vendorId?: number) => ipcRenderer.invoke('procurement:purchaseHistory', companyId, itemId, vendorId),
  getPriceHistory: (companyId: number, itemId?: number) => ipcRenderer.invoke('procurement:priceHistory', companyId, itemId),

  // ===== MAINTENANCE =====
  // Service Requests
  createServiceRequest: (data: any) => ipcRenderer.invoke('maintenance:createServiceRequest', data),
  updateServiceRequest: (id: number, data: any) => ipcRenderer.invoke('maintenance:updateServiceRequest', id, data),
  submitServiceRequest: (id: number) => ipcRenderer.invoke('maintenance:submitServiceRequest', id),
  assignServiceRequest: (id: number, assignedToId: number, assignedToName: string) => ipcRenderer.invoke('maintenance:assignServiceRequest', id, assignedToId, assignedToName),
  getServiceRequest: (id: number) => ipcRenderer.invoke('maintenance:getServiceRequest', id),
  listServiceRequests: (filter: any) => ipcRenderer.invoke('maintenance:listServiceRequests', filter),
  serviceRequestDashboard: (companyId: number) => ipcRenderer.invoke('maintenance:serviceRequestDashboard', companyId),
  addChecklist: (serviceRequestId: number, items: string[]) => ipcRenderer.invoke('maintenance:addChecklist', serviceRequestId, items),
  toggleChecklistItem: (id: number, isChecked: boolean, remarks?: string) => ipcRenderer.invoke('maintenance:toggleChecklistItem', id, isChecked, remarks),
  getChecklists: (serviceRequestId: number) => ipcRenderer.invoke('maintenance:getChecklists', serviceRequestId),

  // Work Orders
  createWorkOrder: (data: any) => ipcRenderer.invoke('maintenance:createWorkOrder', data),
  updateWorkOrderStatus: (id: number, status: string) => ipcRenderer.invoke('maintenance:updateWorkOrderStatus', id, status),
  getWorkOrder: (id: number) => ipcRenderer.invoke('maintenance:getWorkOrder', id),
  listWorkOrders: (filter: any) => ipcRenderer.invoke('maintenance:listWorkOrders', filter),
  workOrderDashboard: (companyId: number) => ipcRenderer.invoke('maintenance:workOrderDashboard', companyId),
  addSparePartToWO: (workOrderId: number, data: any) => ipcRenderer.invoke('maintenance:addSparePart', workOrderId, data),
  removeSparePartFromWO: (id: number) => ipcRenderer.invoke('maintenance:removeSparePart', id),
  getWOSpareParts: (workOrderId: number) => ipcRenderer.invoke('maintenance:getSpareParts', workOrderId),
  addWOCost: (workOrderId: number, data: any) => ipcRenderer.invoke('maintenance:addCost', workOrderId, data),
  getWOCosts: (workOrderId: number) => ipcRenderer.invoke('maintenance:getCosts', workOrderId),
  addWOPhoto: (workOrderId: number, data: any) => ipcRenderer.invoke('maintenance:addPhoto', workOrderId, data),
  getWOPhotos: (workOrderId: number) => ipcRenderer.invoke('maintenance:getPhotos', workOrderId),
  addWODocument: (workOrderId: number, data: any) => ipcRenderer.invoke('maintenance:addDocument', workOrderId, data),
  getWODocuments: (workOrderId: number) => ipcRenderer.invoke('maintenance:getDocuments', workOrderId),
  recordMaintenanceHistory: (data: any) => ipcRenderer.invoke('maintenance:recordMaintenanceHistory', data),
  getMaintenanceHistory: (companyId: number, assetId?: number) => ipcRenderer.invoke('maintenance:getMaintenanceHistory', companyId, assetId),
  recordBreakdown: (data: any) => ipcRenderer.invoke('maintenance:recordBreakdown', data),
  getBreakdownHistory: (companyId: number, assetId?: number) => ipcRenderer.invoke('maintenance:getBreakdownHistory', companyId, assetId),
  updateAssetHealth: (assetId: number) => ipcRenderer.invoke('maintenance:updateAssetHealth', assetId),

  // AMC
  createAMC: (data: any) => ipcRenderer.invoke('maintenance:createAMC', data),
  updateAMC: (id: number, data: any) => ipcRenderer.invoke('maintenance:updateAMC', id, data),
  getAMC: (id: number) => ipcRenderer.invoke('maintenance:getAMC', id),
  listAMCs: (filter: any) => ipcRenderer.invoke('maintenance:listAMCs', filter),
  addAMCDocument: (amcId: number, data: any) => ipcRenderer.invoke('maintenance:addAMCDocument', amcId, data),
  getAMCDocuments: (amcId: number) => ipcRenderer.invoke('maintenance:getAMCDocuments', amcId),
  cancelAMC: (id: number) => ipcRenderer.invoke('maintenance:cancelAMC', id),

  // Warranty
  createWarrantyClaim: (data: any) => ipcRenderer.invoke('maintenance:createWarrantyClaim', data),
  updateWarrantyClaimStatus: (id: number, status: string, resolution?: string) => ipcRenderer.invoke('maintenance:updateWarrantyClaimStatus', id, status, resolution),
  getWarrantyClaims: (companyId: number, assetId?: number) => ipcRenderer.invoke('maintenance:getWarrantyClaims', companyId, assetId),

  // Service Schedules
  createServiceSchedule: (data: any) => ipcRenderer.invoke('maintenance:createServiceSchedule', data),
  updateServiceSchedule: (id: number, data: any) => ipcRenderer.invoke('maintenance:updateServiceSchedule', id, data),
  listServiceSchedules: (companyId: number, assetId?: number) => ipcRenderer.invoke('maintenance:listServiceSchedules', companyId, assetId),
  getUpcomingReminders: (companyId: number, days?: number) => ipcRenderer.invoke('maintenance:getUpcomingReminders', companyId, days),

  // Spare Parts
  issueSparePart: (data: any) => ipcRenderer.invoke('maintenance:issueSparePart', data),
  returnSparePart: (workOrderId: number, sparePartId: number, quantity: number) => ipcRenderer.invoke('maintenance:returnSparePart', workOrderId, sparePartId, quantity),
  getWorkOrderSpareParts: (workOrderId: number) => ipcRenderer.invoke('maintenance:getWorkOrderSpareParts', workOrderId),
  getWorkOrderCostSummary: (workOrderId: number) => ipcRenderer.invoke('maintenance:getWorkOrderCostSummary', workOrderId),

  // ===== MATERIAL DEMAND =====
  createDemand: (serviceRequestId: number, items: any[], headerData?: any) => ipcRenderer.invoke('demand:create', serviceRequestId, items, headerData),
  getDemandItems: (serviceRequestId: number) => ipcRenderer.invoke('demand:getItems', serviceRequestId),
  issueMaterial: (serviceRequestId: number, issueSlipNumber: string, items: any[]) => ipcRenderer.invoke('demand:issue', serviceRequestId, issueSlipNumber, items),
  returnMaterial: (serviceRequestId: number, items: any[]) => ipcRenderer.invoke('demand:return', serviceRequestId, items),
  listDemands: (companyId: number, filter?: any) => ipcRenderer.invoke('demand:list', companyId, filter),
  getDemandDetail: (serviceRequestId: number) => ipcRenderer.invoke('demand:getDetail', serviceRequestId),
  getOpenDemands: (companyId: number, financialYearId?: number, demandType?: string) => ipcRenderer.invoke('demand:getOpenDemands', companyId, financialYearId, demandType),
  searchDemands: (companyId: number, query: string) => ipcRenderer.invoke('demand:searchDemands', companyId, query),
  getDemandByPhysicalNo: (companyId: number, physicalDemandNo: string) => ipcRenderer.invoke('demand:getByPhysicalNo', companyId, physicalDemandNo),
  createDirectDemand: (data: any) => ipcRenderer.invoke('demand:createDirect', data),
  updateDirectDemand: (serviceRequestId: number, data: any) => ipcRenderer.invoke('demand:updateDirect', serviceRequestId, data),
  deleteDirectDemand: (serviceRequestId: number) => ipcRenderer.invoke('demand:deleteDirect', serviceRequestId),
  getDemandAllocations: (serviceRequestId: number) => ipcRenderer.invoke('demand:getAllocations', serviceRequestId),
  getDemandAllocationsByTransaction: (transactionHeaderId: number) => ipcRenderer.invoke('demand:getAllocationsByTransaction', transactionHeaderId),

  // ===== MATERIAL CONSUMPTION =====
  createConsumption: (data: any) => ipcRenderer.invoke('consumption:create', data),
  cancelConsumption: (id: number, reason: string) => ipcRenderer.invoke('consumption:cancel', id, reason),
  findConsumptionById: (id: number) => ipcRenderer.invoke('consumption:findById', id),
  findAllConsumptions: (companyId: number, financialYearId: number, options?: any) => ipcRenderer.invoke('consumption:findAll', companyId, financialYearId, options),
  getConsumptionForLocation: (storeId: number, locationId?: number) => ipcRenderer.invoke('consumption:getForLocation', storeId, locationId),
  getConsumptionForDemand: (serviceRequestId: number) => ipcRenderer.invoke('consumption:getForDemand', serviceRequestId),
  getLocationConsumptionStock: (storeId: number, locationId?: number) => ipcRenderer.invoke('consumption:getLocationStock', storeId, locationId),

  // ===== MATERIAL INSTALLATION =====
  createInstallation: (data: any) => ipcRenderer.invoke('installation:create', data),
  cancelInstallation: (id: number, reason: string) => ipcRenderer.invoke('installation:cancel', id, reason),
  findInstallationById: (id: number) => ipcRenderer.invoke('installation:findById', id),
  findAllInstallations: (companyId: number, financialYearId: number, options?: any) => ipcRenderer.invoke('installation:findAll', companyId, financialYearId, options),
  getInstallationForDemand: (serviceRequestId: number) => ipcRenderer.invoke('installation:getForDemand', serviceRequestId),
  getInstallationForLocation: (storeId: number, locationId?: number) => ipcRenderer.invoke('installation:getForLocation', storeId, locationId),

  // ===== USER PREFERENCES =====
  getPreference: (userId: number, key: string) => ipcRenderer.invoke('preference:get', userId, key),
  setPreference: (userId: number, key: string, value: string) => ipcRenderer.invoke('preference:set', userId, key, value),
  getAllPreferences: (userId: number) => ipcRenderer.invoke('preference:getAll', userId),

  // ===== WORK COMPLETION =====
  createWorkCompletion: (data: any) => ipcRenderer.invoke('workCompletion:create', data),
  addVerificationSignature: (verificationId: number, data: any) => ipcRenderer.invoke('workCompletion:addSignature', verificationId, data),
  getWorkCompletion: (id: number) => ipcRenderer.invoke('workCompletion:get', id),
  listWorkCompletions: (companyId: number, filter?: any) => ipcRenderer.invoke('workCompletion:list', companyId, filter),
  recordDelayedEntry: (verificationId: number, data: any) => ipcRenderer.invoke('workCompletion:recordDelayedEntry', verificationId, data),

  // ===== DOCUMENT ATTACHMENTS =====
  attachDocument: (data: any) => ipcRenderer.invoke('doc:attach', data),
  listDocuments: (sourceType: string, sourceId: number) => ipcRenderer.invoke('doc:list', sourceType, sourceId),
  deleteDocument: (id: number) => ipcRenderer.invoke('doc:delete', id),

  // ===== DASHBOARD =====
  getSuperAdminDashboard: (filter: any) => ipcRenderer.invoke('dash:superAdmin', filter),
  getStoreManagerDashboard: (filter: any) => ipcRenderer.invoke('dash:storeManager', filter),
  getMaintenanceDashboard: (filter: any) => ipcRenderer.invoke('dash:maintenance', filter),
  getPurchaseDashboardData: (filter: any) => ipcRenderer.invoke('dash:purchase', filter),
  getKPIs: (filter: any) => ipcRenderer.invoke('dash:kpis', filter),
  getMonthlyTrend: (companyId: number, months?: number) => ipcRenderer.invoke('dash:monthlyTrend', companyId, months),
  getLowStockItems: (companyId: number, storeId?: number) => ipcRenderer.invoke('dash:lowStock', companyId, storeId),
  getOutOfStockItems: (companyId: number) => ipcRenderer.invoke('dash:outOfStock', companyId),
  getTopProblematicAssets: (companyId: number, limit?: number) => ipcRenderer.invoke('dash:topProblematic', companyId, limit),
  getEngineerWorkload: (companyId: number) => ipcRenderer.invoke('dash:engineerWorkload', companyId),
  getDeptConsumption: (companyId: number, fyId?: number) => ipcRenderer.invoke('dash:deptConsumption', companyId, fyId),

  // ===== REPORTS =====
  getOverallStock: (filter: any) => ipcRenderer.invoke('rpt:overallStock', filter),
  getStoreStockRpt: (filter: any) => ipcRenderer.invoke('rpt:storeStock', filter),
  getDeptStock: (filter: any) => ipcRenderer.invoke('rpt:deptStock', filter),
  getItemStock: (filter: any) => ipcRenderer.invoke('rpt:itemStock', filter),
  getCategoryStock: (filter: any) => ipcRenderer.invoke('rpt:categoryStock', filter),
  getReceiptReport: (filter: any) => ipcRenderer.invoke('rpt:receipt', filter),
  getIssueReport: (filter: any) => ipcRenderer.invoke('rpt:issue', filter),
  getTransferReport: (filter: any) => ipcRenderer.invoke('rpt:transfer', filter),
  getInstallationReport: (filter: any) => ipcRenderer.invoke('rpt:installation', filter),
  getUninstallationReport: (filter: any) => ipcRenderer.invoke('rpt:uninstallation', filter),
  getDamageReport: (filter: any) => ipcRenderer.invoke('rpt:damage', filter),
  getRepairReport: (filter: any) => ipcRenderer.invoke('rpt:repair', filter),
  getReplacementReport: (filter: any) => ipcRenderer.invoke('rpt:replacement', filter),
  getReturnReport: (filter: any) => ipcRenderer.invoke('rpt:return', filter),
  getAdjustmentReport: (filter: any) => ipcRenderer.invoke('rpt:adjustment', filter),
  getCompleteLedger: (filter: any) => ipcRenderer.invoke('rpt:completeLedger', filter),
  getItemLedger: (filter: any) => ipcRenderer.invoke('rpt:itemLedger', filter),
  getStoreLedger: (filter: any) => ipcRenderer.invoke('rpt:storeLedger', filter),
  getDeptLedger: (filter: any) => ipcRenderer.invoke('rpt:deptLedger', filter),
  getAssetRegister: (filter: any) => ipcRenderer.invoke('rpt:assetRegister', filter),
  getInstalledAssetsRpt: (filter: any) => ipcRenderer.invoke('rpt:installedAssets', filter),
  getAssetHealthRpt: (filter: any) => ipcRenderer.invoke('rpt:assetHealth', filter),
  getWarrantyExpiryReport: (filter: any) => ipcRenderer.invoke('rpt:warrantyExpiry', filter),
  getAMCExpiryReport: (filter: any) => ipcRenderer.invoke('rpt:amcExpiry', filter),
  getPurchaseRegister: (filter: any) => ipcRenderer.invoke('rpt:purchaseRegister', filter),
  getGRNRegister: (filter: any) => ipcRenderer.invoke('rpt:grnRegister', filter),
  getVendorPerformanceReport: (filter: any) => ipcRenderer.invoke('rpt:vendorPerformance', filter),
  getServiceRegister: (filter: any) => ipcRenderer.invoke('rpt:serviceRegister', filter),
  getWORegister: (filter: any) => ipcRenderer.invoke('rpt:woRegister', filter),
  getDowntimeReport: (filter: any) => ipcRenderer.invoke('rpt:downtime', filter),
  getRepairCostReport: (filter: any) => ipcRenderer.invoke('rpt:repairCost', filter),
  getInventoryValuation: (filter: any) => ipcRenderer.invoke('rpt:inventoryValuation', filter),
  getTransactionSummary: (filter: any) => ipcRenderer.invoke('rpt:transactionSummary', filter),
  getImportHistoryReport: (filter: any) => ipcRenderer.invoke('rpt:importHistory', filter),

  // ===== GLOBAL SEARCH =====
  globalSearch: (companyId: number, query: string, limit?: number) => ipcRenderer.invoke('global:search', companyId, query, limit),

  // ===== EXPORT =====
  exportToExcel: (data: any[], columns: any[], filename: string) => ipcRenderer.invoke('export:excel', data, columns, filename),
  exportToCSV: (data: any[], columns: any[], filename: string) => ipcRenderer.invoke('export:csv', data, columns, filename),
  exportToJSON: (data: any[], filename: string) => ipcRenderer.invoke('export:json', data, filename),
  listExports: () => ipcRenderer.invoke('export:list'),
  deleteExport: (filename: string) => ipcRenderer.invoke('export:delete', filename),

  // ============================================================
  // PHASE 11: ENHANCED IMPORT SERVICE
  // ============================================================

  // Get all import configurations
  getImportConfigs: () => ipcRenderer.invoke('import:getConfigs'),

  // Generate template for a specific model (v2)
  generateImportTemplateV2: (model: string) => ipcRenderer.invoke('import:generateTemplateV2', model),

  // Validate import data using the service
  validateImportV2: (model: string, rows: any[], companyId: number) =>
    ipcRenderer.invoke('import:validateV2', model, rows, companyId),

  // Execute import using the service
  executeImportV2: (model: string, rows: any[], companyId: number, financialYearId?: number) =>
    ipcRenderer.invoke('import:executeV2', model, rows, companyId, financialYearId),

  // Rollback an import (creates proper reversals)
  rollbackImportV2: (importHistoryId: number, companyId: number, financialYearId: number) =>
    ipcRenderer.invoke('import:rollbackV2', importHistoryId, companyId, financialYearId),

  // Download error Excel
  downloadErrorExcel: (filePath: string) => ipcRenderer.invoke('import:downloadErrorExcel', filePath),

  // ============================================================
  // PHASE 11: ENHANCED BACKUP SERVICE
  // ============================================================

  // Create manual versioned backup
  createManualBackup: (label?: string) => ipcRenderer.invoke('backup:createManual', label),

  // Create pre-import backup
  createPreImportBackup: (importType: string, rowCount: number) =>
    ipcRenderer.invoke('backup:createPreImport', importType, rowCount),

  // Create pre-upgrade backup
  createPreUpgradeBackup: (version: string) => ipcRenderer.invoke('backup:createPreUpgrade', version),

  // Create disaster recovery backup
  createDisasterRecoveryBackup: () => ipcRenderer.invoke('backup:createDisasterRecovery'),

  // List versioned backups
  listVersionedBackups: (type?: string) => ipcRenderer.invoke('backup:listVersioned', type),

  // Verify backup integrity
  verifyBackupIntegrity: (backupId: string) => ipcRenderer.invoke('backup:verifyIntegrity', backupId),

  // Verify all backups
  verifyAllBackups: () => ipcRenderer.invoke('backup:verifyAll'),

  // Disaster recovery restore
  disasterRecoveryRestore: (backupId: string) => ipcRenderer.invoke('backup:disasterRecoveryRestore', backupId),

  // ============================================================
  // PHASE 11: BULK OPERATIONS
  // ============================================================

  // Bulk Transfer
  bulkTransfer: (input: any) => ipcRenderer.invoke('bulk:transfer', input),

  // Bulk Issue
  bulkIssue: (input: any) => ipcRenderer.invoke('bulk:issue', input),

  // Bulk Return
  bulkReturn: (input: any) => ipcRenderer.invoke('bulk:return', input),

  // Bulk Install
  bulkInstall: (input: any) => ipcRenderer.invoke('bulk:install', input),

  // Bulk Uninstall
  bulkUninstall: (input: any) => ipcRenderer.invoke('bulk:uninstall', input),

  // Bulk Damage
  bulkDamage: (input: any) => ipcRenderer.invoke('bulk:damage', input),

  // Bulk Asset Assignment
  bulkAssetAssignment: (input: any) => ipcRenderer.invoke('bulk:assetAssignment', input),

  // Bulk Approval
  bulkApproval: (input: any) => ipcRenderer.invoke('bulk:approval', input),

  // Export bulk operation report
  exportBulkReport: (result: any, operationType: string) =>
    ipcRenderer.invoke('bulk:exportReport', result, operationType),

  // ============================================================
  // PHASE 11: PDF EXPORT & PRINT FOR REPORTS
  // ============================================================

  // Generate PDF report
  generateReportPdf: (data: { title: string; columns: Array<{ header: string; key: string }>; rows: any[]; fileName?: string }) =>
    ipcRenderer.invoke('report:generatePdf', data),

  // Print report
  printReport: (data: { title: string; columns: Array<{ header: string; key: string }>; rows: any[] }) =>
    ipcRenderer.invoke('report:print', data),

  // ===== FINANCIAL YEAR =====
  createFY: (data: any) => ipcRenderer.invoke('fy:create', data),
  findAllFY: (companyId: number) => ipcRenderer.invoke('fy:findAll', companyId),
  findByIdFY: (id: number) => ipcRenderer.invoke('fy:findById', id),
  updateFY: (id: number, data: any) => ipcRenderer.invoke('fy:update', id, data),
  validateClosingFY: (fyId: number) => ipcRenderer.invoke('fy:validateClosing', fyId),
  getClosingSummaryFY: (fyId: number) => ipcRenderer.invoke('fy:getClosingSummary', fyId),
  closeFY: (id: number) => ipcRenderer.invoke('fy:close', id),
  reopenFY: (id: number) => ipcRenderer.invoke('fy:reopen', id),
  importOpeningBalance: (data: any) => ipcRenderer.invoke('fy:importOpeningBalance', data),
  carryForwardFY: (companyId: number, fromFyId: number) => ipcRenderer.invoke('fy:carryForward', companyId, fromFyId),
  getVoucherSequences: (fyId: number) => ipcRenderer.invoke('fy:getVoucherSequences', fyId),
  archiveFY: (id: number) => ipcRenderer.invoke('fy:archive', id),
  deleteDuplicateFY: (id: number) => ipcRenderer.invoke('fy:deleteDuplicate', id),
  getFYDeletionDependencyInfo: (id: number) => ipcRenderer.invoke('fy:getDeletionDependencyInfo', id),
  getFYFullDeletionDependencyInfo: (id: number) => ipcRenderer.invoke('fy:getFullDeletionDependencyInfo', id),
  permanentDeleteFY: (id: number, confirmLabel: string) => ipcRenderer.invoke('fy:permanentDelete', id, confirmLabel),

  // ===== AUDIT =====
  setCompanyId: (companyId: number | null) => ipcRenderer.invoke('audit:setCompanyId', companyId),
  findAuditLogs: (filter: any) => ipcRenderer.invoke('audit:findAll', filter),
  getAuditStats: (companyId: number, fromDate?: string, toDate?: string) => ipcRenderer.invoke('audit:getStats', companyId, fromDate, toDate),
  getAuditActionTypes: () => ipcRenderer.invoke('audit:getActionTypes'),

  // ===== RBAC =====
  seedPermissions: () => ipcRenderer.invoke('rbac:seedPermissions'),
  seedRoles: (companyId: number) => ipcRenderer.invoke('rbac:seedRoles', companyId),
  createRole: (data: any) => ipcRenderer.invoke('rbac:createRole', data),
  updateRole: (id: number, data: any) => ipcRenderer.invoke('rbac:updateRole', id, data),
  deleteRole: (id: number) => ipcRenderer.invoke('rbac:deleteRole', id),
  findAllRoles: (companyId: number) => ipcRenderer.invoke('rbac:findAll', companyId),
  findRoleById: (id: number) => ipcRenderer.invoke('rbac:findById', id),
  getPermissions: () => ipcRenderer.invoke('rbac:getPermissions'),
  getPermissionsByModule: () => ipcRenderer.invoke('rbac:getPermissionsByModule'),
  assignRoleToUser: (userId: number, roleId: number) => ipcRenderer.invoke('rbac:assignRoleToUser', userId, roleId),
  getUserPermissions: (userId: number) => ipcRenderer.invoke('rbac:getUserPermissions', userId),
  hasPermissionRbac: (userId: number, permissionKey: string) => ipcRenderer.invoke('rbac:hasPermission', userId, permissionKey),

  // ===== SECURITY =====
  getPasswordPolicy: (companyId: number) => ipcRenderer.invoke('security:getPasswordPolicy', companyId),
  updatePasswordPolicy: (companyId: number, data: any) => ipcRenderer.invoke('security:updatePasswordPolicy', companyId, data),
  validatePassword: (password: string, policy: any) => ipcRenderer.invoke('security:validatePassword', password, policy),
  changePasswordSecure: (userId: number, oldPassword: string, newPassword: string) => ipcRenderer.invoke('security:changePassword', userId, oldPassword, newPassword),
  checkPasswordExpiry: (userId: number) => ipcRenderer.invoke('security:checkPasswordExpiry', userId),
  isAccountLocked: (userId: number) => ipcRenderer.invoke('security:isAccountLocked', userId),
  lockAccount: (userId: number) => ipcRenderer.invoke('security:lockAccount', userId),
  unlockAccount: (userId: number) => ipcRenderer.invoke('security:unlockAccount', userId),
  forceLogoutAll: (userId: number) => ipcRenderer.invoke('security:forceLogoutAll', userId),
  getActiveSessions: (userId?: number) => ipcRenderer.invoke('security:getActiveSessions', userId),
  getSessionStats: (companyId: number) => ipcRenderer.invoke('security:getSessionStats', companyId),
  createSession: (userId: number, ipAddress?: string, device?: string) => ipcRenderer.invoke('security:createSession', userId, ipAddress, device),
  logoutSession: (token: string) => ipcRenderer.invoke('security:logoutSession', token),

  // ===== DATA INTEGRITY =====
  runIntegrityAudit: (companyId: number) => ipcRenderer.invoke('integrity:runFullAudit', companyId),
  getIntegritySummary: (companyId: number) => ipcRenderer.invoke('integrity:getAuditSummary', companyId),
  checkNegativeStock: (companyId: number) => ipcRenderer.invoke('integrity:checkNegativeStock', companyId),
  checkOrphanTransactions: (companyId: number) => ipcRenderer.invoke('integrity:checkOrphanTransactions', companyId),
  checkDuplicateVouchers: (companyId: number) => ipcRenderer.invoke('integrity:checkDuplicateVouchers', companyId),
  checkStockLedgerSync: (companyId: number) => ipcRenderer.invoke('integrity:checkStockLedgerSync', companyId),
  checkFYIntegrity: (companyId: number) => ipcRenderer.invoke('integrity:checkFinancialYearIntegrity', companyId),
  checkReferentialIntegrity: (companyId: number) => ipcRenderer.invoke('integrity:checkReferentialIntegrity', companyId),

  // ============================================================
  // PHASE 12: PERFORMANCE & MONITORING
  // ============================================================

  // Performance Monitoring
  recordPerformanceMetric: (name: string, value: number, unit: string, tags?: Record<string, string>) =>
    ipcRenderer.invoke('monitoring:recordMetric', name, value, unit, tags),
  getPerformanceMetrics: (name?: string, since?: Date) =>
    ipcRenderer.invoke('monitoring:getMetrics', name, since),
  getPerformanceStats: () => ipcRenderer.invoke('monitoring:getStats'),
  exportPerformanceLogs: (format?: 'json' | 'csv') =>
    ipcRenderer.invoke('monitoring:exportLogs', format),

  // Application Logging
  logMessage: (level: string, message: string, source?: string, context?: Record<string, any>) =>
    ipcRenderer.invoke('logger:log', level, message, source, context),
  getLogs: (options?: { level?: string; source?: string; since?: Date; limit?: number }) =>
    ipcRenderer.invoke('logger:getLogs', options),
  getLogStats: () => ipcRenderer.invoke('logger:getStats'),
  exportLogs: (format?: 'json' | 'csv') =>
    ipcRenderer.invoke('logger:export', format),
  reportCrash: (error: any, context?: Record<string, any>) =>
    ipcRenderer.invoke('logger:reportCrash', error, context),

  // Database Migration
  getMigrationStatus: () => ipcRenderer.invoke('migration:getStatus'),
  runPendingMigrations: () => ipcRenderer.invoke('migration:runPending'),
  rollbackMigration: (targetVersion?: string) =>
    ipcRenderer.invoke('migration:rollback', targetVersion),

  // Keyboard Shortcuts
  getKeyboardShortcuts: () => ipcRenderer.invoke('shortcuts:getAll'),
  updateKeyboardShortcut: (id: string, keys: string[]) =>
    ipcRenderer.invoke('shortcuts:update', id, keys),
  resetKeyboardShortcuts: () => ipcRenderer.invoke('shortcuts:reset'),

  // Saved Views
  getSavedViews: (tableName: string) => ipcRenderer.invoke('views:getAll', tableName),
  createSavedView: (tableName: string, name: string, config: any) =>
    ipcRenderer.invoke('views:create', tableName, name, config),
  updateSavedView: (viewId: string, updates: any) =>
    ipcRenderer.invoke('views:update', viewId, updates),
  deleteSavedView: (viewId: string) => ipcRenderer.invoke('views:delete', viewId),
  setActiveView: (tableName: string, viewId: string) =>
    ipcRenderer.invoke('views:setActive', tableName, viewId),

  // Form Drafts (Autosave)
  saveFormDraft: (formId: string, data: Record<string, any>, name?: string) =>
    ipcRenderer.invoke('drafts:save', formId, data, name),
  getFormDrafts: (formId: string) => ipcRenderer.invoke('drafts:getAll', formId),
  restoreFormDraft: (formId: string, draftId: string) =>
    ipcRenderer.invoke('drafts:restore', formId, draftId),
  deleteFormDraft: (formId: string, draftId: string) =>
    ipcRenderer.invoke('drafts:delete', formId, draftId),
  clearFormDrafts: (formId: string) => ipcRenderer.invoke('drafts:clear', formId),

  // Query Cache
  invalidateCache: (key: string) => ipcRenderer.invoke('cache:invalidate', key),
  invalidateCacheAll: () => ipcRenderer.invoke('cache:invalidateAll'),
  getCacheStats: () => ipcRenderer.invoke('cache:getStats'),

  // System Health
  getSystemHealth: () => ipcRenderer.invoke('system:health'),
  getDiskUsage: () => ipcRenderer.invoke('system:diskUsage'),
  getMemoryUsage: () => ipcRenderer.invoke('system:memoryUsage'),
  getDbSize: () => ipcRenderer.invoke('system:dbSize'),
});
