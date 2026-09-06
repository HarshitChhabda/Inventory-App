declare global {
  interface Window {
    electronAPI: {
      getDbPath: () => Promise<string>;
      dbQuery: (model: string, method: string, ...args: any[]) => Promise<any>;
      saveReceiptChallan: (payload: any, items: any[], isEdit: boolean, id?: number) => Promise<any>;
      saveIssueChallan: (payload: any, items: any[], isEdit: boolean, id?: number) => Promise<any>;
      saveTransferChallan: (payload: any, items: any[], isEdit: boolean, id?: number) => Promise<any>;
      createReceiptChallanImport: (data: any) => Promise<any>;
      createIssueChallanImport: (data: any) => Promise<any>;
      createTransferChallanImport: (data: any) => Promise<any>;
      postReceiptChallan: (id: number) => Promise<any>;
      cancelReceiptChallan: (id: number, reason: string) => Promise<any>;
      deleteReceiptChallan: (id: number) => Promise<any>;
      postIssueChallan: (id: number) => Promise<any>;
      cancelIssueChallan: (id: number, reason: string) => Promise<any>;
      deleteIssueChallan: (id: number) => Promise<any>;
      postTransferChallan: (id: number) => Promise<any>;
      cancelTransferChallan: (id: number, reason: string) => Promise<any>;
      deleteTransferChallan: (id: number) => Promise<any>;
      saveShiftChallan: (payload: any, items: any[], shiftType: string, isEdit: boolean, id?: number) => Promise<any>;
      listShiftChallans: (shiftType: string) => Promise<any>;
      postShiftChallan: (id: number) => Promise<any>;
      cancelShiftChallan: (id: number, reason: string) => Promise<any>;
      deleteShiftChallan: (id: number) => Promise<any>;
      createDamageEntry: (data: any) => Promise<any>;
      sendToRepair: (data: any) => Promise<any>;
      receiveFromRepair: (data: any) => Promise<any>;
      createScrapEntry: (data: any) => Promise<any>;
      createStockAdjustment: (data: any) => Promise<any>;
      createVendorReturn: (data: any) => Promise<any>;
      postVendorReturn: (id: number, departmentId?: number | null) => Promise<any>;
      loadDemoData: () => Promise<string>;
      clearDemoData: () => Promise<string>;
      createBackup: () => Promise<string>;
      listBackups: () => Promise<any[]>;
      getStorageInfo: () => Promise<{ totalSize: number; totalCount: number; byType: Record<string, { count: number; size: number }>; backupPath: string }>;
      restoreBackup: (path: string) => Promise<void>;
      getExportsDir: () => Promise<string>;
      changeBackupLocation: (dir: string) => Promise<{ success: boolean; path: string }>;
      getBackupLocation: () => Promise<string>;

      // Shell
      openFolder: (path: string) => Promise<void>;
      saveFile: (options: any) => Promise<any>;
      openFile: (options: any) => Promise<any>;
      showMessage: (options: any) => Promise<any>;
      getVersion: () => Promise<string>;
      relaunch: () => Promise<void>;
      checkForUpdates: () => Promise<void>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      getUpdateInfo: () => Promise<{ version: string; releaseDate: string } | null>;

      // Event listeners
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;

      // PDF generation
      generatePdf: (htmlContent: string, options?: { fileName?: string; width?: number; height?: number }) => Promise<{ success: boolean; path?: string }>;
      generatePdfFromPrint: (data: { type: string; challanData: any }) => Promise<{ success: boolean; path?: string }>;

      // Import/Export
      readFileBuffer: (filePath: string) => Promise<ArrayBuffer>;
      parseImportFile: (buffer: ArrayBuffer, fileName: string) => Promise<{ headers: string[]; rows: any[] }>;
      exportExcel: (data: any[], columns: Array<{ header: string; key: string; width?: number }>, fileName: string) => Promise<ArrayBuffer>;
      exportCSV: (data: any[], columns: Array<{ header: string; key: string }>) => Promise<string>;
      exportStockReport: (reportData: { title: string; subTitle: string; columns: Array<{ header: string; key: string }>; rows: any[] }) => Promise<ArrayBuffer>;
      bulkUpsert: (model: string, data: any[], matchField: string, companyId?: number) => Promise<{ created: number; updated: number; skipped: number; total: number }>;
      exportAllTables: () => Promise<ArrayBuffer>;
      exportAllTablesComplete: () => Promise<ArrayBuffer>;
      getImportTables: () => Promise<Array<{ model: string; name: string; matchField: string; fields: string[] }>>;
      generateImportTemplate: (model: string) => Promise<ArrayBuffer>;
      getBackupInfo: () => Promise<Array<{ model: string; name: string; count: number }>>;

      // Stock drill-down
      getIssueBreakdown: (companyId: number, financialYearId: number, itemId: number) => Promise<Array<{
        departmentId: number | null;
        departmentName: string;
        locationId: number | null;
        locationName: string;
        totalQty: number;
        transactions: Array<{ id: number; date: string; quantity: number; challanNo: string; balanceAfter: number; remarks: string }>;
      }>>;

      // Historical room-level opening stock
      createRoomLevelOpeningStock: (data: {
        companyId: number;
        financialYearId: number;
        storeId: number;
        dharamshalaId: number;
        roomId: number;
        itemId: number;
        quantity: number;
        rate: number;
        date: string;
        createdBy: string;
        remarks?: string;
      }) => Promise<{ success: boolean; transactionCount: number }>;

      // Bulk opening stock import
      bulkImportOpeningStock: (data: {
        companyId: number;
        financialYearId: number;
        rows: Array<{
          dharamshalaDept?: string;
          roomLocation?: string;
          category?: string;
          itemCode?: string;
          itemName?: string;
          unit?: string;
          quantity?: number;
          rate?: number;
          date?: string;
          status?: string;
          remarks?: string;
        }>;
      }) => Promise<{ imported: number; skipped: number; total: number; errors: string[] }>;

      generateOpeningStockTemplate: (type?: string) => Promise<ArrayBuffer>;
      undoOpeningStockImport: (data: { companyId: number; financialYearId: number; departmentId?: number; minutes?: number }) => Promise<{ deleted: number; message: string }>;

      // Import History
      listImportHistory: (companyId: number) => Promise<Array<{
        id: number;
        fileName: string;
        importType: string;
        level: string | null;
        departmentId: number | null;
        departmentName: string | null;
        rowCount: number;
        importedCount: number;
        status: string;
        companyId: number;
        financialYearId: number;
        createdAt: Date;
        deletedAt: Date | null;
      }>>;
      createImportHistory: (data: {
        fileName: string;
        importType: string;
        level?: string;
        departmentId?: number;
        departmentName?: string;
        rowCount: number;
        importedCount: number;
        companyId: number;
        financialYearId: number;
      }) => Promise<any>;
      deleteImportHistory: (data: {
        id: number;
        companyId: number;
        financialYearId: number;
      }) => Promise<{ deleted: number; message: string }>;

      // Room-to-room shift
      shiftRoomStock: (data: {
        companyId: number;
        financialYearId: number;
        dharamshalaId: number;
        fromRoomId: number;
        toRoomId: number;
        itemId: number;
        quantity: number;
        rate: number;
        date: string;
        createdBy: string;
        remarks?: string;
      }) => Promise<{ success: boolean; transactionCount: number; refTransferId: string }>;

      // Return stock to store
      returnToStore: (data: {
        companyId: number;
        financialYearId: number;
        dharamshalaId: number;
        targetStoreId: number;
        itemId: number;
        quantity: number;
        rate: number;
        date: string;
        createdBy: string;
        fromRoomId?: number | null;
        remarks?: string;
      }) => Promise<{ success: boolean; transactionCount: number; refTransferId: string }>;

      // Dashboard
      getDashboardData: (companyId: number, financialYearId: number) => Promise<any>;

      // Auth
      login: (username: string, password: string) => Promise<{
        id: number;
        uuid: string;
        username: string;
        fullName: string;
        role: string;
        permissions: string[];
        isActive: boolean;
        createdAt: string;
      }>;
      logout: () => Promise<{ success: boolean }>;
      getCurrentUser: () => Promise<{
        id: number;
        uuid: string;
        username: string;
        fullName: string;
        role: string;
        permissions: string[];
        isActive: boolean;
        createdAt: string;
      } | null>;
      changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean }>;
      hasPermission: (permissionKey: string) => Promise<boolean>;
      getPermissionKeys: () => Promise<string[]>;
      listUsers: () => Promise<Array<{
        id: number;
        uuid: string;
        username: string;
        fullName: string;
        role: string;
        permissions: string[];
        isActive: boolean;
        createdAt: string;
      }>>;
      createUser: (data: {
        username: string;
        password: string;
        fullName: string;
        role?: string;
        permissions?: string[];
      }) => Promise<any>;
      updateUser: (userId: number, data: {
        fullName?: string;
        role?: string;
        permissions?: string[];
        isActive?: boolean;
      }) => Promise<any>;
      adminResetPassword: (userId: number, newPassword: string) => Promise<{ success: boolean }>;
      deleteUser: (userId: number) => Promise<{ success: boolean }>;

      // Master Data
      createCategory: (data: { name: string; prefix: string; storeId?: number | null; isActive?: boolean }) => Promise<any>;
      updateCategory: (id: number, data: { name?: string; prefix?: string; storeId?: number | null; isActive?: boolean }) => Promise<any>;
      deleteCategory: (id: number) => Promise<any>;
      createUnit: (data: { name: string; symbol?: string }) => Promise<any>;
      updateUnit: (id: number, data: { name?: string; symbol?: string }) => Promise<any>;
      deleteUnit: (id: number) => Promise<any>;
      createItem: (data: { itemCode: string; itemName: string; categoryId: number; unitId: number; minimumStockLevel?: number; isActive?: boolean }) => Promise<any>;
      updateItem: (id: number, data: { itemCode?: string; itemName?: string; categoryId?: number; unitId?: number; minimumStockLevel?: number; isActive?: boolean }) => Promise<any>;
      deleteItem: (id: number) => Promise<any>;
      createVendor: (data: { name: string; contactPerson?: string; phone?: string; address?: string; gstNumber?: string; isActive?: boolean }) => Promise<any>;
      updateVendor: (id: number, data: { name?: string; contactPerson?: string; phone?: string; address?: string; gstNumber?: string; isActive?: boolean }) => Promise<any>;
      deleteVendor: (id: number) => Promise<any>;
      createDepartment: (data: { companyId: number; name: string; code?: string; isActive?: boolean }) => Promise<any>;
      updateDepartment: (id: number, data: { name?: string; code?: string; isActive?: boolean }) => Promise<any>;
      deleteDepartment: (id: number) => Promise<any>;
      createLocation: (data: { storeId: number; locationType: string; locationName: string; parentId?: number | null; isActive?: boolean }) => Promise<any>;
      updateLocation: (id: number, data: { storeId?: number; locationType?: string; locationName?: string; parentId?: number | null; isActive?: boolean }) => Promise<any>;
      deleteLocation: (id: number) => Promise<any>;
      bulkCreate: (model: string, rows: any[]) => Promise<{ count: number }>;
      bulkUpdate: (model: string, idField: string, rows: any[]) => Promise<any[]>;
      bulkUpsertMaster: (model: string, idField: string, rows: any[]) => Promise<any[]>;

      // Settings
      createCompany: (data: { name: string; address?: string; phone?: string; logoPath?: string; isActive?: boolean }) => Promise<any>;
      updateCompany: (id: number, data: { name?: string; address?: string; phone?: string; logoPath?: string; isActive?: boolean }) => Promise<any>;
      deleteCompany: (id: number) => Promise<any>;
      createFinancialYear: (data: { companyId: number; label: string; startDate: Date | string; endDate: Date | string }) => Promise<any>;
      updateFinancialYear: (id: number, data: { label: string; startDate: Date | string; endDate: Date | string }) => Promise<any>;
      closeFinancialYear: (fyId: number) => Promise<{ success: boolean }>;

      // Installation
      installItems: (data: { companyId: number; financialYearId: number; itemId: number; sourceLocationId: number; targetLocationId: number; quantity: number; rate?: number; installedBy: string; remarks?: string; transactionDate?: Date | string }) => Promise<any>;
      uninstallItems: (data: { companyId: number; financialYearId: number; itemId: number; sourceLocationId: number; targetStoreLocationId: number; quantity: number; rate?: number; uninstalledBy: string; remarks?: string; transactionDate?: Date | string }) => Promise<any>;
      getActiveInstallations: (companyId: number, itemId?: number) => Promise<any[]>;
      getInstallationsByLocation: (locationId: number) => Promise<any[]>;

      // ============================================================
      // ENTERPRISE INVENTORY ENGINE
      // ============================================================

      // System Configuration
      getConfig: (companyId: number, key: string) => Promise<string | null>;
      getConfigBool: (companyId: number, key: string) => Promise<boolean>;
      getConfigNumber: (companyId: number, key: string) => Promise<number>;
      setConfig: (companyId: number, key: string, value: string, category?: string, description?: string) => Promise<void>;
      getAllConfigs: (companyId: number, category?: string) => Promise<Array<{ key: string; value: string; category: string; description?: string; dataType: string }>>;
      deleteConfig: (companyId: number, key: string) => Promise<void>;
      initializeDefaultConfigs: (companyId: number) => Promise<void>;

      // Store Master
      createStore: (data: { companyId: number; name: string; code?: string; storeType: string; parentStoreId?: number; departmentId?: number; dharmshalaId?: number }) => Promise<any>;
      updateStore: (id: number, data: { name?: string; code?: string; storeType?: string; parentStoreId?: number | null; departmentId?: number | null; dharmshalaId?: number | null; isActive?: boolean }) => Promise<any>;
      getStoreById: (id: number) => Promise<any>;
      listStores: (companyId: number, storeType?: string) => Promise<any[]>;
      deleteStore: (id: number) => Promise<any>;
      getMainStores: (companyId: number) => Promise<any[]>;
      getStoresByType: (companyId: number, storeType: string) => Promise<any[]>;
      getStoreHierarchy: (companyId: number) => Promise<any[]>;

      // Location Master (enhanced)
      createLocationEnterprise: (data: { locationType: string; locationName: string; category?: string; floor?: string; parentId?: number; storeId?: number }) => Promise<any>;
      updateLocationEnterprise: (id: number, data: { locationType?: string; locationName?: string; category?: string; floor?: string; parentId?: number | null; storeId?: number | null; isActive?: boolean }) => Promise<any>;
      getLocationById: (id: number) => Promise<any>;
      listLocations: (companyId: number, locationType?: string, storeId?: number) => Promise<any[]>;
      deleteLocationEnterprise: (id: number) => Promise<any>;
      getLocationHierarchy: (companyId: number) => Promise<any[]>;

      // Item Master (enhanced)
      createItemEnterprise: (data: { companyId: number; itemCode: string; itemName: string; categoryId: number; unitId: number; minimumStockLevel?: number; maximumStockLevel?: number; itemType?: string; isSerialized?: boolean; hasWarranty?: boolean; warrantyMonths?: number; hsnCode?: string; description?: string }) => Promise<any>;
      updateItemEnterprise: (id: number, data: { itemName?: string; categoryId?: number; unitId?: number; minimumStockLevel?: number; maximumStockLevel?: number; itemType?: string; isSerialized?: boolean; hasWarranty?: boolean; warrantyMonths?: number; hsnCode?: string; description?: string; isActive?: boolean }) => Promise<any>;
      getItemById: (id: number) => Promise<any>;
      listItemsEnterprise: (companyId: number, categoryId?: number, itemType?: string, isSerialized?: boolean) => Promise<any[]>;
      deleteItemEnterprise: (id: number) => Promise<any>;
      createSerializedItem: (data: { itemId: number; serialNumber: string; batchNumber?: string; manufactureDate?: Date | string; purchaseDate?: Date | string; warrantyExpiry?: Date | string; currentStoreId?: number; purchasePrice?: number; assetTag?: string }) => Promise<any>;
      getSerializedItems: (itemId: number, storeId?: number) => Promise<any[]>;
      updateSerializedItemStatus: (id: number, status: string, locationId?: number) => Promise<any>;

      // Transfer Matrix
      initializeTransferMatrix: (companyId: number) => Promise<void>;
      isTransferAllowed: (companyId: number, fromStoreType: string, toStoreType: string) => Promise<{ allowed: boolean; requiresApproval: boolean }>;
      updateTransferRule: (companyId: number, fromStoreType: string, toStoreType: string, isAllowed: boolean, requiresApproval: boolean) => Promise<any>;
      getTransferRules: (companyId: number) => Promise<any[]>;
      validateTransfer: (companyId: number, fromStoreId: number, toStoreId: number) => Promise<{ valid: boolean; message: string }>;

      // Installation Engine (new)
      installItemsEnterprise: (data: { companyId: number; financialYearId: number; itemId: number; storeId: number; locationId: number; quantity: number; installedBy: string; issueChallanId?: number; remarks?: string; transactionDate?: Date | string; serialNumbers?: string[] }) => Promise<any>;
      uninstallItemsEnterprise: (data: { companyId: number; financialYearId: number; installationId: number; uninstalledBy: string; remarks?: string; transactionDate?: Date | string }) => Promise<any>;
      shiftInstallation: (data: { companyId: number; financialYearId: number; itemId: number; fromLocationId: number; toLocationId: number; storeId: number; quantity: number; shiftedBy: string; remarks?: string; transactionDate?: Date | string }) => Promise<any>;
      getInstallationsByStore: (storeId: number) => Promise<any[]>;
      getInstallationSummary: (companyId: number) => Promise<any[]>;

      // Unified Inventory Engine
      getStoreBalance: (companyId: number, financialYearId: number, itemId: number, storeId: number) => Promise<number>;
      getBalanceBreakdown: (companyId: number, financialYearId: number, itemId: number, storeId: number) => Promise<{ available: number; installed: number; reserved: number; damaged: number; repair: number; transit: number; scrap: number; blocked: number; lost: number; total: number }>;
      getStoreStock: (companyId: number, financialYearId: number, storeId: number) => Promise<any[]>;
      getItemStockAcrossStores: (companyId: number, financialYearId: number, itemId: number) => Promise<any[]>;
      getLocationItems: (companyId: number, financialYearId: number, roomId: number) => Promise<any[]>;
      getAllLocationItems: (companyId: number, financialYearId: number) => Promise<any[]>;
      validateStockEnterprise: (companyId: number, financialYearId: number, itemId: number, storeId: number, quantity: number, allowNegative?: boolean) => Promise<{ valid: boolean; available: number; requested: number; itemName: string; storeName: string; message?: string }>;
      getItemLifecycle: (companyId: number, itemId: number, financialYearId?: number) => Promise<any[]>;
      moveSerializedItem: (data: { companyId: number; financialYearId: number; serializedItemId: number; fromStoreId: number; toStoreId: number; transactionType: string; transactionDate: Date | string; referenceType: string; referenceId: number; referenceNo: string; createdBy: string; remarks?: string }) => Promise<void>;
      createReversal: (data: { companyId: number; financialYearId: number; itemId: number; storeId: number; originalTransactionType: string; quantity: number; transactionDate: Date | string; referenceType: string; referenceId: number; referenceNo: string; createdBy: string; reason: string }) => Promise<void>;

      // Data Migration
      migrateData: (companyId: number) => Promise<{ success: boolean; storesCreated: number; locationsUpdated: number; itemsUpdated: number; stockMigrated: number; installationsMigrated: number; errors: string[] }>;
      isMigrationNeeded: (companyId: number) => Promise<{ needed: boolean; reasons: string[] }>;

      // Stock Formula Validation
      validateItemStock: (companyId: number, financialYearId: number, itemId: number, departmentId?: number | null, locationId?: number | null) => Promise<any>;
      validateAllStock: (companyId: number, financialYearId: number) => Promise<any[]>;
      getItemStockSummary: (companyId: number, financialYearId: number, itemId: number) => Promise<any[]>;

      // Import Validation
      validateImportRows: (model: string, data: any[], matchField: string, companyId?: number) => Promise<{ results: Array<{ row: number; valid: boolean; errors: string[]; warnings: string[] }>; summary: { total: number; valid: number; invalid: number; canImport: boolean } }>;
      bulkUpsertWithValidation: (model: string, data: any[], matchField: string, companyId?: number, dryRun?: boolean) => Promise<any>;

      // Material Demand
      createDemand: (serviceRequestId: number, items: any[], headerData?: any) => Promise<any>;
      getDemandItems: (serviceRequestId: number) => Promise<any[]>;
      issueMaterial: (serviceRequestId: number, issueSlipNumber: string, items: any[]) => Promise<any>;
      returnMaterial: (serviceRequestId: number, items: any[]) => Promise<any>;
      listDemands: (companyId: number, filter?: any) => Promise<any[]>;

      // Work Completion Verification
      createWorkCompletion: (data: any) => Promise<any>;
      addVerificationSignature: (verificationId: number, data: any) => Promise<any>;
      getWorkCompletion: (id: number) => Promise<any>;
      listWorkCompletions: (companyId: number, filter?: any) => Promise<any[]>;
      recordDelayedEntry: (verificationId: number, data: any) => Promise<any>;

      // Document Attachments
      attachDocument: (data: any) => Promise<any>;
      listDocuments: (sourceType: string, sourceId: number) => Promise<any[]>;
      deleteDocument: (id: number) => Promise<any>;

      // ============================================================
      // MOVEMENT ENGINE
      // ============================================================
      createMovement: (data: any) => Promise<any>;
      approveMovement: (companyId: number, transactionId: number, approvedBy: string) => Promise<any>;
      rejectMovement: (companyId: number, transactionId: number, rejectedBy: string, reason: string) => Promise<any>;
      cancelMovement: (companyId: number, transactionId: number, cancelledBy: string, reason: string) => Promise<any>;

      // Movement Registry
      getMovementTypes: () => Promise<any[]>;
      getMovementType: (code: string) => Promise<any>;
      getMovementTypesByCategory: (category: string) => Promise<any[]>;
      getMovementCategories: () => Promise<string[]>;

      // Stock Engine
      getStockBalance: (companyId: number, financialYearId: number, itemId: number, storeId: number) => Promise<number>;
      getStockBreakdown: (companyId: number, financialYearId: number, itemId: number, storeId: number) => Promise<any>;
      getStoreStock: (companyId: number, financialYearId: number, storeId: number) => Promise<any[]>;
      getItemStockAcrossStores: (companyId: number, financialYearId: number, itemId: number) => Promise<any[]>;
      getLocationItems: (companyId: number, financialYearId: number, roomId: number) => Promise<any[]>;
      getAllLocationItems: (companyId: number, financialYearId: number) => Promise<any[]>;
      getLowStockAlerts: (companyId: number, financialYearId: number) => Promise<any[]>;
      validateStock: (companyId: number, financialYearId: number, itemId: number, storeId: number, quantity: number) => Promise<{ valid: boolean; available: number; message?: string }>;

      // Voucher Engine
      previewVoucherNo: (companyId: number, financialYearId: number, voucherType: string) => Promise<string>;
      getCurrentSequence: (companyId: number, financialYearId: number, voucherType: string) => Promise<number>;
      isValidVoucherType: (type: string) => Promise<boolean>;
      getVoucherPrefixes: () => Promise<Record<string, string>>;

      // Data Migration
      migrateData: (companyId: number) => Promise<any>;
      isMigrationNeeded: (companyId: number) => Promise<any>;

      // ============================================================
      // DIGITAL ASSET REGISTRY
      // ============================================================
      createAsset: (data: any) => Promise<any>;
      getAsset: (id: number) => Promise<any>;
      getAssetByCode: (assetCode: string) => Promise<any>;
      updateAsset: (id: number, data: any) => Promise<any>;
      deleteAsset: (id: number) => Promise<any>;
      searchAssets: (filters: any) => Promise<any[]>;
      installAsset: (assetId: number, storeId: number, locationId?: number, roomId?: number, departmentId?: number, installedBy?: string, remarks?: string) => Promise<any>;
      uninstallAsset: (assetId: number, uninstalledBy?: string, remarks?: string) => Promise<any>;
      transferAsset: (assetId: number, toStoreId: number, toLocationId?: number, toRoomId?: number, toDepartmentId?: number, transactionId?: number, voucherNo?: string, performedBy?: string, reason?: string, remarks?: string) => Promise<any>;
      repairAsset: (assetId: number, data: any) => Promise<any>;
      damageAsset: (assetId: number, condition: string, reportedBy?: string, remarks?: string) => Promise<any>;
      scrapAsset: (assetId: number, performedBy?: string, remarks?: string) => Promise<any>;
      disposeAsset: (assetId: number, reason: string, performedBy?: string) => Promise<any>;
      getAssetTimeline: (assetId: number) => Promise<any[]>;
      addAssetTimelineEvent: (assetId: number, eventType: string, data: any) => Promise<any>;
      addAssetPhoto: (assetId: number, photoType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, caption?: string, takenBy?: string) => Promise<any>;
      getAssetPhotos: (assetId: number, photoType?: string) => Promise<any[]>;
      deleteAssetPhoto: (photoId: number) => Promise<any>;
      addAssetDocument: (assetId: number, documentType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, description?: string, uploadedBy?: string) => Promise<any>;
      getAssetDocuments: (assetId: number, documentType?: string) => Promise<any[]>;
      deleteAssetDocument: (docId: number) => Promise<any>;
      getInstalledAssetsReport: (companyId: number) => Promise<any[]>;
      getWarrantyExpiringReport: (companyId: number, days?: number) => Promise<any[]>;
      getAmcExpiringReport: (companyId: number, days?: number) => Promise<any[]>;
      getRepairHistoryReport: (companyId: number) => Promise<any[]>;
      getAssetHealthReport: (companyId: number) => Promise<any[]>;
      getAssetAgeReport: (companyId: number) => Promise<any[]>;
      getScrappedAssetsReport: (companyId: number) => Promise<any[]>;
      getDisposedAssetsReport: (companyId: number) => Promise<any[]>;
      getLostAssetsReport: (companyId: number) => Promise<any[]>;
      getReplacementSuggestions: (companyId: number, costThreshold?: number, repairThreshold?: number) => Promise<any[]>;
      getAssetDashboard: (companyId: number) => Promise<any>;
      importAssets: (companyId: number, assets: any[]) => Promise<any>;
      bulkUpdateAssetCondition: (assetIds: number[], condition: string, updatedBy?: string) => Promise<any>;
      getExpiringWarranties: (companyId: number, days?: number) => Promise<any[]>;
      getExpiringAMCs: (companyId: number, days?: number) => Promise<any[]>;
      getEndOfLifeAssets: (companyId: number) => Promise<any[]>;
      generateAssetQR: (assetId: number) => Promise<any>;
      printAssetQR: (assetId: number) => Promise<any>;
      selectAssetFile: (options?: { type?: 'photo' | 'document' }) => Promise<any>;
      copyAssetFileToStorage: (sourcePath: string, assetCode: string, subfolder: string) => Promise<any>;

      // ============================================================
      // REQUISITION & APPROVAL WORKFLOW
      // ============================================================
      createRequisition: (data: any) => Promise<any>;
      getRequisition: (id: number) => Promise<any>;
      getRequisitionByNumber: (number: string) => Promise<any>;
      searchRequisitions: (filters: any) => Promise<any[]>;
      updateRequisition: (id: number, data: any) => Promise<any>;
      submitRequisition: (id: number) => Promise<any>;
      cancelRequisition: (id: number, reason?: string) => Promise<any>;
      closeRequisition: (id: number) => Promise<any>;
      reopenRequisition: (id: number) => Promise<any>;
      approveRequest: (data: any) => Promise<any>;
      rejectRequest: (data: any) => Promise<any>;
      returnRequest: (data: any) => Promise<any>;
      holdRequest: (data: any) => Promise<any>;
      partialApproveRequest: (data: any) => Promise<any>;
      forwardRequest: (data: any) => Promise<any>;
      escalateRequest: (data: any) => Promise<any>;
      getPendingApprovals: (userId: number, companyId: number) => Promise<any[]>;
      convertRequisition: (data: any) => Promise<any>;
      bulkConvertRequisitions: (ids: number[], companyId: number, fyId: number, userId: number, userName: string, postedBy: string) => Promise<any>;
      checkRequisitionStock: (reqId: number) => Promise<any>;
      createWorkflow: (data: any) => Promise<any>;
      getWorkflow: (id: number) => Promise<any>;
      getWorkflows: (companyId: number, type?: string) => Promise<any[]>;
      getActiveWorkflow: (companyId: number, type: string) => Promise<any>;
      updateWorkflow: (id: number, data: any) => Promise<any>;
      deleteWorkflow: (id: number) => Promise<any>;
      toggleWorkflow: (id: number, enabled: boolean) => Promise<any>;
      seedWorkflows: (companyId: number) => Promise<any>;
      isWorkflowEnabled: (companyId: number, type: string) => Promise<boolean>;
      getWorkflowTypes: () => Promise<string[]>;
      addApprovalLevel: (data: any) => Promise<any>;
      updateApprovalLevel: (id: number, data: any) => Promise<any>;
      deleteApprovalLevel: (id: number) => Promise<any>;
      getApprovalLevels: (workflowId: number) => Promise<any[]>;
      getRequisitionDashboard: (companyId: number) => Promise<any>;
      getRequisitionRegister: (companyId: number, dateFrom?: Date, dateTo?: Date) => Promise<any[]>;
      getApprovalRegister: (companyId: number) => Promise<any[]>;
      getPendingRequestReport: (companyId: number) => Promise<any[]>;
      getRejectedRequestReport: (companyId: number) => Promise<any[]>;
      getUserWiseRequests: (companyId: number, userId: number) => Promise<any[]>;
      getDepartmentWiseRequests: (companyId: number) => Promise<any[]>;
      getIssuedAgainstRequest: (companyId: number) => Promise<any[]>;
      getRequisitionNotifications: (userId: number, options?: any) => Promise<any[]>;
      markNotificationRead: (id: number) => Promise<any>;
      markAllNotificationsRead: (userId: number) => Promise<any>;
      getUnreadNotificationCount: (userId: number) => Promise<number>;
      getNotificationStats: (companyId: number) => Promise<any>;

      // ============================================================
      // PROCUREMENT & PURCHASE
      // ============================================================
      createVendorP: (data: any) => Promise<any>;
      getVendorP: (id: number) => Promise<any>;
      getVendorPByCode: (code: string) => Promise<any>;
      updateVendorP: (id: number, data: any) => Promise<any>;
      deleteVendorP: (id: number) => Promise<any>;
      searchVendorsP: (filters: any) => Promise<any[]>;
      toggleVendorP: (id: number, isActive: boolean) => Promise<any>;
      updateVendorPRating: (id: number, rating: number) => Promise<any>;
      getVendorPPerformance: (vendorId: number) => Promise<any>;
      getVendorPDashboard: (companyId: number) => Promise<any>;
      addVendorDocument: (vendorId: number, docType: string, fileName: string, filePath: string, fileSize?: number, mimeType?: string, desc?: string, uploadedBy?: string) => Promise<any>;
      getVendorDocuments: (vendorId: number) => Promise<any[]>;
      deleteVendorDocument: (docId: number) => Promise<any>;
      addItemVendorMapping: (data: any) => Promise<any>;
      getItemVendorMappings: (itemId: number) => Promise<any[]>;
      deleteItemVendorMapping: (id: number) => Promise<any>;
      createPO: (data: any) => Promise<any>;
      getPO: (id: number) => Promise<any>;
      searchPOs: (filters: any) => Promise<any[]>;
      updatePO: (id: number, data: any) => Promise<any>;
      approvePO: (id: number, approvedBy: string) => Promise<any>;
      orderPO: (id: number, orderedBy: string) => Promise<any>;
      cancelPO: (id: number) => Promise<any>;
      closePO: (id: number) => Promise<any>;
      getPODashboard: (companyId: number) => Promise<any>;
      createGRN: (data: any) => Promise<any>;
      getGRN: (id: number) => Promise<any>;
      searchGRNs: (filters: any) => Promise<any[]>;
      recordQC: (data: any) => Promise<any>;
      postGRNToInventory: (grnId: number, postedById: string) => Promise<any>;
      getGRNDashboard: (companyId: number) => Promise<any>;
      getPurchaseHistory: (companyId: number, itemId?: number, vendorId?: number) => Promise<any[]>;
      getPriceHistory: (companyId: number, itemId?: number) => Promise<any[]>;
      createRTV: (data: any) => Promise<any>;
      getRTV: (id: number) => Promise<any>;
      searchRTVs: (filters: any) => Promise<any[]>;
      transitionRTV: (id: number, status: string) => Promise<any>;

      // ============================================================
      // MAINTENANCE
      // ============================================================
      createServiceRequest: (data: any) => Promise<any>;
      updateServiceRequest: (id: number, data: any) => Promise<any>;
      submitServiceRequest: (id: number) => Promise<any>;
      assignServiceRequest: (id: number, assignedToId: number, assignedToName: string) => Promise<any>;
      getServiceRequest: (id: number) => Promise<any>;
      listServiceRequests: (filter: any) => Promise<any[]>;
      serviceRequestDashboard: (companyId: number) => Promise<any>;
      addChecklist: (serviceRequestId: number, items: string[]) => Promise<any>;
      toggleChecklistItem: (id: number, isChecked: boolean, remarks?: string) => Promise<any>;
      getChecklists: (serviceRequestId: number) => Promise<any[]>;
      createWorkOrder: (data: any) => Promise<any>;
      updateWorkOrderStatus: (id: number, status: string) => Promise<any>;
      getWorkOrder: (id: number) => Promise<any>;
      listWorkOrders: (filter: any) => Promise<any[]>;
      workOrderDashboard: (companyId: number) => Promise<any>;
      addSparePartToWO: (workOrderId: number, data: any) => Promise<any>;
      removeSparePartFromWO: (id: number) => Promise<any>;
      getWOSpareParts: (workOrderId: number) => Promise<any[]>;
      addWOCost: (workOrderId: number, data: any) => Promise<any>;
      getWOCosts: (workOrderId: number) => Promise<any[]>;
      addWOPhoto: (workOrderId: number, data: any) => Promise<any>;
      getWOPhotos: (workOrderId: number) => Promise<any[]>;
      addWODocument: (workOrderId: number, data: any) => Promise<any>;
      getWODocuments: (workOrderId: number) => Promise<any[]>;
      recordMaintenanceHistory: (data: any) => Promise<any>;
      getMaintenanceHistory: (companyId: number, assetId?: number) => Promise<any[]>;
      recordBreakdown: (data: any) => Promise<any>;
      getBreakdownHistory: (companyId: number, assetId?: number) => Promise<any[]>;
      updateAssetHealth: (assetId: number) => Promise<any>;
      createAMC: (data: any) => Promise<any>;
      updateAMC: (id: number, data: any) => Promise<any>;
      getAMC: (id: number) => Promise<any>;
      listAMCs: (filter: any) => Promise<any[]>;
      addAMCDocument: (amcId: number, data: any) => Promise<any>;
      getAMCDocuments: (amcId: number) => Promise<any[]>;
      cancelAMC: (id: number) => Promise<any>;
      createWarrantyClaim: (data: any) => Promise<any>;
      updateWarrantyClaimStatus: (id: number, status: string, resolution?: string) => Promise<any>;
      getWarrantyClaims: (companyId: number, assetId?: number) => Promise<any[]>;
      createServiceSchedule: (data: any) => Promise<any>;
      updateServiceSchedule: (id: number, data: any) => Promise<any>;
      listServiceSchedules: (companyId: number, assetId?: number) => Promise<any[]>;
      getUpcomingReminders: (companyId: number, days?: number) => Promise<any[]>;
      issueSparePart: (data: any) => Promise<any>;
      returnSparePart: (workOrderId: number, sparePartId: number, quantity: number) => Promise<any>;
      getWorkOrderSpareParts: (workOrderId: number) => Promise<any[]>;
      getWorkOrderCostSummary: (workOrderId: number) => Promise<any>;

      // ============================================================
      // DASHBOARD
      // ============================================================
      getSuperAdminDashboard: (filter: any) => Promise<any>;
      getStoreManagerDashboard: (filter: any) => Promise<any>;
      getMaintenanceDashboard: (filter: any) => Promise<any>;
      getPurchaseDashboardData: (filter: any) => Promise<any>;
      getKPIs: (filter: any) => Promise<any>;
      getMonthlyTrend: (companyId: number, months?: number) => Promise<any[]>;
      getLowStockItems: (companyId: number, storeId?: number) => Promise<any[]>;
      getOutOfStockItems: (companyId: number) => Promise<any[]>;
      getTopProblematicAssets: (companyId: number, limit?: number) => Promise<any[]>;
      getEngineerWorkload: (companyId: number) => Promise<any[]>;
      getDeptConsumption: (companyId: number, fyId?: number) => Promise<any[]>;

      // ============================================================
      // REPORTS
      // ============================================================
      getOverallStock: (filter: any) => Promise<any[]>;
      getStoreStockRpt: (filter: any) => Promise<any[]>;
      getDeptStock: (filter: any) => Promise<any[]>;
      getItemStock: (filter: any) => Promise<any[]>;
      getCategoryStock: (filter: any) => Promise<any[]>;
      getReceiptReport: (filter: any) => Promise<any[]>;
      getIssueReport: (filter: any) => Promise<any[]>;
      getTransferReport: (filter: any) => Promise<any[]>;
      getInstallationReport: (filter: any) => Promise<any[]>;
      getUninstallationReport: (filter: any) => Promise<any[]>;
      getDamageReport: (filter: any) => Promise<any[]>;
      getRepairReport: (filter: any) => Promise<any[]>;
      getReplacementReport: (filter: any) => Promise<any[]>;
      getReturnReport: (filter: any) => Promise<any[]>;
      getAdjustmentReport: (filter: any) => Promise<any[]>;
      getCompleteLedger: (filter: any) => Promise<any[]>;
      getItemLedger: (filter: any) => Promise<any[]>;
      getStoreLedger: (filter: any) => Promise<any[]>;
      getDeptLedger: (filter: any) => Promise<any[]>;
      getAssetRegister: (filter: any) => Promise<any[]>;
      getInstalledAssetsRpt: (filter: any) => Promise<any[]>;
      getAssetHealthRpt: (filter: any) => Promise<any[]>;
      getWarrantyExpiryReport: (filter: any) => Promise<any[]>;
      getAMCExpiryReport: (filter: any) => Promise<any[]>;
      getPurchaseRegister: (filter: any) => Promise<any[]>;
      getGRNRegister: (filter: any) => Promise<any[]>;
      getVendorPerformanceReport: (filter: any) => Promise<any[]>;
      getServiceRegister: (filter: any) => Promise<any[]>;
      getWORegister: (filter: any) => Promise<any[]>;
      getDowntimeReport: (filter: any) => Promise<any[]>;
      getRepairCostReport: (filter: any) => Promise<any[]>;
      getInventoryValuation: (filter: any) => Promise<any[]>;
      getTransactionSummary: (filter: any) => Promise<any[]>;
      getImportHistoryReport: (filter: any) => Promise<any[]>;

      // ============================================================
      // GLOBAL SEARCH & EXPORT
      // ============================================================
      globalSearch: (companyId: number, query: string, limit?: number) => Promise<any[]>;
      exportToExcel: (data: any[], columns: any[], filename: string) => Promise<any>;
      exportToCSV: (data: any[], columns: any[], filename: string) => Promise<any>;
      exportToJSON: (data: any[], filename: string) => Promise<any>;
      listExports: () => Promise<any[]>;
      deleteExport: (filename: string) => Promise<any>;

      // ============================================================
      // ENHANCED IMPORT (Phase 11)
      // ============================================================
      getImportConfigs: () => Promise<any[]>;
      generateImportTemplateV2: (model: string) => Promise<ArrayBuffer>;
      validateImportV2: (model: string, rows: any[], companyId: number) => Promise<any>;
      executeImportV2: (model: string, rows: any[], companyId: number, financialYearId?: number) => Promise<any>;
      rollbackImportV2: (importHistoryId: number, companyId: number, financialYearId: number) => Promise<any>;
      downloadErrorExcel: (filePath: string) => Promise<any>;

      // ============================================================
      // ENHANCED BACKUP (Phase 11)
      // ============================================================
      createManualBackup: (label?: string) => Promise<any>;
      createPreImportBackup: (importType: string, rowCount: number) => Promise<any>;
      createPreUpgradeBackup: (version: string) => Promise<any>;
      createDisasterRecoveryBackup: () => Promise<any>;
      listVersionedBackups: (type?: string) => Promise<any[]>;
      verifyBackupIntegrity: (backupId: string) => Promise<any>;
      verifyAllBackups: () => Promise<any>;
      disasterRecoveryRestore: (backupId: string) => Promise<any>;

      // ============================================================
      // BULK OPERATIONS
      // ============================================================
      bulkTransfer: (input: any) => Promise<any>;
      bulkIssue: (input: any) => Promise<any>;
      bulkReturn: (input: any) => Promise<any>;
      bulkInstall: (input: any) => Promise<any>;
      bulkUninstall: (input: any) => Promise<any>;
      bulkDamage: (input: any) => Promise<any>;
      bulkAssetAssignment: (input: any) => Promise<any>;
      bulkApproval: (input: any) => Promise<any>;
      exportBulkReport: (result: any, operationType: string) => Promise<any>;

      // ============================================================
      // PDF EXPORT & PRINT
      // ============================================================
      generateReportPdf: (data: { title: string; columns: Array<{ header: string; key: string }>; rows: any[]; fileName?: string }) => Promise<any>;
      printReport: (data: { title: string; columns: Array<{ header: string; key: string }>; rows: any[] }) => Promise<any>;

      // ============================================================
      // FINANCIAL YEAR
      // ============================================================
      createFY: (data: any) => Promise<any>;
      findAllFY: (companyId: number) => Promise<any[]>;
      findByIdFY: (id: number) => Promise<any>;
      updateFY: (id: number, data: any) => Promise<any>;
      validateClosingFY: (fyId: number) => Promise<any>;
      getClosingSummaryFY: (fyId: number) => Promise<any>;
      closeFY: (id: number) => Promise<any>;
      reopenFY: (id: number) => Promise<any>;
      importOpeningBalance: (data: any) => Promise<any>;
      carryForwardFY: (companyId: number, fromFyId: number) => Promise<any>;
      getVoucherSequences: (fyId: number) => Promise<any[]>;
      archiveFY: (id: number) => Promise<any>;
      deleteDuplicateFY: (id: number) => Promise<any>;

      // ============================================================
      // AUDIT
      // ============================================================
      setCompanyId: (companyId: number | null) => Promise<void>;
      findAuditLogs: (filter: any) => Promise<any[]>;
      getAuditStats: (companyId: number, fromDate?: string, toDate?: string) => Promise<any>;
      getAuditActionTypes: () => Promise<string[]>;

      // ============================================================
      // RBAC
      // ============================================================
      seedPermissions: () => Promise<any>;
      seedRoles: (companyId: number) => Promise<any>;
      createRole: (data: any) => Promise<any>;
      updateRole: (id: number, data: any) => Promise<any>;
      deleteRole: (id: number) => Promise<any>;
      findAllRoles: (companyId: number) => Promise<any[]>;
      findRoleById: (id: number) => Promise<any>;
      getPermissions: () => Promise<any[]>;
      getPermissionsByModule: () => Promise<Record<string, any[]>>;
      assignRoleToUser: (userId: number, roleId: number) => Promise<any>;
      getUserPermissions: (userId: number) => Promise<any[]>;
      hasPermissionRbac: (userId: number, permissionKey: string) => Promise<boolean>;

      // ============================================================
      // SECURITY
      // ============================================================
      getPasswordPolicy: (companyId: number) => Promise<any>;
      updatePasswordPolicy: (companyId: number, data: any) => Promise<any>;
      validatePassword: (password: string, policy: any) => Promise<any>;
      changePasswordSecure: (userId: number, oldPassword: string, newPassword: string) => Promise<any>;
      checkPasswordExpiry: (userId: number) => Promise<any>;
      isAccountLocked: (userId: number) => Promise<boolean>;
      lockAccount: (userId: number) => Promise<any>;
      unlockAccount: (userId: number) => Promise<any>;
      forceLogoutAll: (userId: number) => Promise<any>;
      getActiveSessions: (userId?: number) => Promise<any[]>;
      getSessionStats: (companyId: number) => Promise<any>;
      createSession: (userId: number, ipAddress?: string, device?: string) => Promise<any>;
      logoutSession: (token: string) => Promise<any>;

      // ============================================================
      // DATA INTEGRITY
      // ============================================================
      runIntegrityAudit: (companyId: number) => Promise<any>;
      getIntegritySummary: (companyId: number) => Promise<any>;
      checkNegativeStock: (companyId: number) => Promise<any[]>;
      checkOrphanTransactions: (companyId: number) => Promise<any[]>;
      checkDuplicateVouchers: (companyId: number) => Promise<any[]>;
      checkStockLedgerSync: (companyId: number) => Promise<any[]>;
      checkFYIntegrity: (companyId: number) => Promise<any[]>;
      checkReferentialIntegrity: (companyId: number) => Promise<any[]>;

      // ============================================================
      // PERFORMANCE & MONITORING
      // ============================================================
      recordPerformanceMetric: (name: string, value: number, unit: string, tags?: Record<string, string>) => Promise<void>;
      getPerformanceMetrics: (name?: string, since?: Date) => Promise<any[]>;
      getPerformanceStats: () => Promise<any>;
      exportPerformanceLogs: (format?: 'json' | 'csv') => Promise<any>;

      // ============================================================
      // LOGGING
      // ============================================================
      logMessage: (level: string, message: string, source?: string, context?: Record<string, any>) => Promise<void>;
      getLogs: (options?: { level?: string; source?: string; since?: Date; limit?: number }) => Promise<any[]>;
      getLogStats: () => Promise<any>;
      exportLogs: (format?: 'json' | 'csv') => Promise<any>;
      reportCrash: (error: any, context?: Record<string, any>) => Promise<void>;

      // ============================================================
      // DATABASE MIGRATION
      // ============================================================
      getMigrationStatus: () => Promise<any>;
      runPendingMigrations: () => Promise<any>;
      rollbackMigration: (targetVersion?: string) => Promise<any>;

      // ============================================================
      // KEYBOARD SHORTCUTS
      // ============================================================
      getKeyboardShortcuts: () => Promise<any[]>;
      updateKeyboardShortcut: (id: string, keys: string[]) => Promise<any>;
      resetKeyboardShortcuts: () => Promise<any>;

      // ============================================================
      // SAVED VIEWS
      // ============================================================
      getSavedViews: (tableName: string) => Promise<any[]>;
      createSavedView: (tableName: string, name: string, config: any) => Promise<any>;
      updateSavedView: (viewId: string, updates: any) => Promise<any>;
      deleteSavedView: (viewId: string) => Promise<any>;
      setActiveView: (tableName: string, viewId: string) => Promise<any>;

      // ============================================================
      // FORM DRAFTS
      // ============================================================
      saveFormDraft: (formId: string, data: Record<string, any>, name?: string) => Promise<any>;
      getFormDrafts: (formId: string) => Promise<any[]>;
      restoreFormDraft: (formId: string, draftId: string) => Promise<any>;
      deleteFormDraft: (formId: string, draftId: string) => Promise<any>;
      clearFormDrafts: (formId: string) => Promise<any>;

      // ============================================================
      // QUERY CACHE
      // ============================================================
      invalidateCache: (key: string) => Promise<void>;
      invalidateCacheAll: () => Promise<void>;
      getCacheStats: () => Promise<any>;

      // ============================================================
      // SYSTEM HEALTH
      // ============================================================
      getSystemHealth: () => Promise<any>;
      getDiskUsage: () => Promise<any>;
      getMemoryUsage: () => Promise<any>;
      getDbSize: () => Promise<any>;

      // ============================================================
      // MISSING FROM ORIGINAL (preload lines not in electron.d.ts)
      // ============================================================
      toggleStore: (id: number) => Promise<any>;
      extractTextFromPdf: (buffer: ArrayBuffer) => Promise<string>;
      toggleDepartment: (id: number) => Promise<any>;
      getCurrentFinancialYear: (companyId: number) => Promise<any>;
      createRoomLevelOpeningStock: (data: any) => Promise<any>;
      shiftRoomStock: (data: any) => Promise<any>;
      returnToStore: (data: any) => Promise<any>;
      getIssueBreakdown: (companyId: number, financialYearId: number, itemId: number) => Promise<any[]>;

      // Item History Paginated
      getItemHistoryPaginated: (params: {
        companyId: number;
        financialYearId: number;
        itemId: number;
        storeId?: number;
        locationId?: number;
        departmentId?: number;
        startDate?: string;
        endDate?: string;
        voucherType?: string;
        movementType?: string;
        page?: number;
        pageSize?: number;
      }) => Promise<{
        data: Array<{
          id: number; uuid: string; voucherNo: string; voucherType: string;
          movementType: string; quantityIn: number; quantityOut: number;
          balanceQty: number; rate: number; condition: string; serialNumber: string | null;
          batchNumber: string | null; transactionDate: Date; createdBy: string;
          itemName: string; itemCode: string; storeName: string;
          locationId: number | null; locationName: string | null;
          departmentId: number | null; departmentName: string | null;
          unitId: number | null; unitName: string | null;
          transactionId: number; remarks: string | null;
        }>;
        total: number; page: number; pageSize: number; totalPages: number;
      }>;

      // Material Consumption
      createConsumption: (data: any) => Promise<any>;
      cancelConsumption: (id: number, reason: string) => Promise<any>;
      findConsumptionById: (id: number) => Promise<any>;
      findAllConsumptions: (companyId: number, financialYearId: number, options?: any) => Promise<any>;
      getConsumptionForLocation: (storeId: number, locationId?: number) => Promise<any>;
      getConsumptionForDemand: (serviceRequestId: number) => Promise<any>;
      getLocationConsumptionStock: (storeId: number, locationId?: number) => Promise<any>;

      // Material Installation
      createInstallation: (data: any) => Promise<any>;
      cancelInstallation: (id: number, reason: string) => Promise<any>;
      findInstallationById: (id: number) => Promise<any>;
      findAllInstallations: (companyId: number, financialYearId: number, options?: any) => Promise<any>;
      getInstallationForDemand: (serviceRequestId: number) => Promise<any>;
      getInstallationForLocation: (storeId: number, locationId?: number) => Promise<any>;

      // User Preferences
      getPreference: (userId: number, key: string) => Promise<string | null>;
      setPreference: (userId: number, key: string, value: string) => Promise<boolean>;
      getAllPreferences: (userId: number) => Promise<Record<string, string>>;
    };
  }
}

export {};
