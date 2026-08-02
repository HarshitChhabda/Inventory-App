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
  createDamageEntry: (data: any) => ipcRenderer.invoke('challan:damage:create', data),
  createStockAdjustment: (data: any) => ipcRenderer.invoke('challan:adjustment:create', data),
  createVendorReturn: (data: any) => ipcRenderer.invoke('challan:vendorReturn:create', data),
  postVendorReturn: (id: number, departmentId?: number | null) => ipcRenderer.invoke('challan:vendorReturn:post', id, departmentId),
  loadDemoData: () => ipcRenderer.invoke('demo:load'),
  clearDemoData: () => ipcRenderer.invoke('demo:clear'),

  // Backup
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
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

  // XPS Converter
  convertXps: (buffer: ArrayBuffer) => ipcRenderer.invoke('xps:convert', buffer),
  convertXpsText: (text: string, fontType: string) => ipcRenderer.invoke('xps:convertText', text, fontType),
  exportXps: (result: any, format: string, options: any, fileName: string) =>
    ipcRenderer.invoke('xps:export', result, format, options, fileName),
  getXpsPagePreview: (doc: any, pageNumber: number) => ipcRenderer.invoke('xps:getPagePreview', doc, pageNumber),
  saveXpsFile: (buffer: ArrayBuffer, defaultName: string) => ipcRenderer.invoke('xps:saveFile', buffer, defaultName),

  // Item Import from XPS
  extractItemsFromXps: (buffer: ArrayBuffer) => ipcRenderer.invoke('import:extractItems', buffer),
  bulkImportItems: (items: any[], companyId: number, categoryId: number, unitId: number) =>
    ipcRenderer.invoke('import:bulkItems', items, companyId, categoryId, unitId),

  // Kruti Dev to Excel export
  exportKrutiDevToExcel: (data: any) => ipcRenderer.invoke('export:krutidevToExcel', data),

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
  createLocation: (data: any) => ipcRenderer.invoke('masterData:createLocation', data),
  updateLocation: (id: number, data: any) => ipcRenderer.invoke('masterData:updateLocation', id, data),
  deleteLocation: (id: number) => ipcRenderer.invoke('masterData:deleteLocation', id),
  bulkCreate: (model: string, rows: any[]) => ipcRenderer.invoke('masterData:bulkCreate', model, rows),
  bulkUpdate: (model: string, idField: string, rows: any[]) => ipcRenderer.invoke('masterData:bulkUpdate', model, idField, rows),
  bulkUpsertMaster: (model: string, idField: string, rows: any[]) => ipcRenderer.invoke('masterData:bulkUpsert', model, idField, rows),

  // Settings
  createCompany: (data: any) => ipcRenderer.invoke('settings:createCompany', data),
  updateCompany: (id: number, data: any) => ipcRenderer.invoke('settings:updateCompany', id, data),
  deleteCompany: (id: number) => ipcRenderer.invoke('settings:deleteCompany', id),
  createFinancialYear: (data: any) => ipcRenderer.invoke('settings:createFinancialYear', data),
  updateFinancialYear: (id: number, data: any) => ipcRenderer.invoke('settings:updateFinancialYear', id, data),
  closeFinancialYear: (fyId: number) => ipcRenderer.invoke('settings:closeFinancialYear', fyId),
});
