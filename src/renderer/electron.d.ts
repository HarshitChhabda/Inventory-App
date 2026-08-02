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
      createDamageEntry: (data: any) => Promise<any>;
      createStockAdjustment: (data: any) => Promise<any>;
      createVendorReturn: (data: any) => Promise<any>;
      postVendorReturn: (id: number, departmentId?: number | null) => Promise<any>;
      loadDemoData: () => Promise<string>;
      clearDemoData: () => Promise<string>;
      createBackup: () => Promise<string>;
      listBackups: () => Promise<any[]>;
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
      convertXps: (buffer: ArrayBuffer) => Promise<any>;
      convertXpsText: (text: string, fontType: string) => Promise<{ hindi: string; english: string; detectedFont: string; conversionCount: number }>;
      exportXps: (result: any, format: string, options: any, fileName: string) => Promise<any>;
      getXpsPagePreview: (doc: any, pageNumber: number) => Promise<any>;
      saveXpsFile: (buffer: ArrayBuffer, defaultName: string) => Promise<string | null>;
      extractItemsFromXps: (buffer: ArrayBuffer) => Promise<any>;
      bulkImportItems: (items: any[], companyId: number, categoryId: number, unitId: number) => Promise<any>;

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
      createCategory: (data: { name: string; prefix: string; departmentId?: number | null; isActive?: boolean }) => Promise<any>;
      updateCategory: (id: number, data: { name?: string; prefix?: string; departmentId?: number | null; isActive?: boolean }) => Promise<any>;
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
      createLocation: (data: { locationType: string; locationName: string; parentId?: number | null; isActive?: boolean }) => Promise<any>;
      updateLocation: (id: number, data: { locationType?: string; locationName?: string; parentId?: number | null; isActive?: boolean }) => Promise<any>;
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

      // Export KrutiDev
      exportKrutiDevToExcel: (data: any) => Promise<any>;
    };
  }
}

export {};
