-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "logoPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FinancialYear" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "departmentType" TEXT NOT NULL DEFAULT 'Store',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'GEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "minimumStockLevel" DECIMAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Item_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "gstNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "category" TEXT,
    "floor" TEXT,
    "parentId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptChallan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "sourceType" TEXT NOT NULL,
    "vendorId" INTEGER,
    "sourceName" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "vehicleNumber" TEXT,
    "receivedBy" TEXT NOT NULL,
    "departmentId" INTEGER,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "postedAt" DATETIME,
    "postedBy" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReceiptChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceiptChallan_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceiptChallan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReceiptChallan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptChallanItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "receiptChallanId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "locationId" INTEGER,
    "remarks" TEXT,
    CONSTRAINT "ReceiptChallanItem_receiptChallanId_fkey" FOREIGN KEY ("receiptChallanId") REFERENCES "ReceiptChallan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceiptChallanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceiptChallanItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceiptChallanItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueChallan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "serialNo" TEXT,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "sourceStoreId" INTEGER,
    "date" DATETIME NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "purpose" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "postedAt" DATETIME,
    "postedBy" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IssueChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IssueChallan_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IssueChallan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IssueChallan_sourceStoreId_fkey" FOREIGN KEY ("sourceStoreId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueChallanItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "issueChallanId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "locationId" INTEGER,
    "usedAt" TEXT,
    "purpose" TEXT,
    "remarks" TEXT,
    CONSTRAINT "IssueChallanItem_issueChallanId_fkey" FOREIGN KEY ("issueChallanId") REFERENCES "IssueChallan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IssueChallanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IssueChallanItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IssueChallanItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferChallan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "fromDepartmentId" INTEGER NOT NULL,
    "toDepartmentId" INTEGER NOT NULL,
    "transferredBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "postedAt" DATETIME,
    "postedBy" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferChallan_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferChallan_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferChallan_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferChallanItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "transferChallanId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL DEFAULT 0,
    "locationId" INTEGER,
    "toLocationId" INTEGER,
    "remarks" TEXT,
    CONSTRAINT "TransferChallanItem_transferChallanId_fkey" FOREIGN KEY ("transferChallanId") REFERENCES "TransferChallan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferChallanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferChallanItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferChallanItem_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "locationId" INTEGER,
    "transactionType" TEXT NOT NULL,
    "transactionDate" DATETIME NOT NULL,
    "quantityIn" DECIMAL NOT NULL DEFAULT 0,
    "quantityOut" DECIMAL NOT NULL DEFAULT 0,
    "rate" DECIMAL NOT NULL DEFAULT 0,
    "balanceQty" DECIMAL NOT NULL,
    "referenceType" TEXT,
    "referenceId" INTEGER,
    "referenceNo" TEXT,
    "refTransferId" TEXT,
    "condition" TEXT DEFAULT 'GOOD',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "StockTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransaction_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransaction_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpeningStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpeningStock_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpeningStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetInstallation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "issueChallanId" INTEGER,
    "installedDate" DATETIME NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "installedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetInstallation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetInstallation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DamageEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER,
    "itemId" INTEGER NOT NULL,
    "locationId" INTEGER,
    "assetInstallationId" INTEGER,
    "date" DATETIME NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "reason" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "remarks" TEXT,
    "originalPurchaseDate" DATETIME,
    "originalVendorName" TEXT,
    "originalInvoiceNumber" TEXT,
    "originalRate" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'Posted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DamageEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DamageEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "locationId" INTEGER,
    "date" DATETIME NOT NULL,
    "itemId" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Posted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorReturnChallan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "originalReceiptId" INTEGER,
    "date" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "returnedBy" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "postedAt" DATETIME,
    "postedBy" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorReturnChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorReturnChallan_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorReturnChallan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorReturnChallan_originalReceiptId_fkey" FOREIGN KEY ("originalReceiptId") REFERENCES "ReceiptChallan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorReturnChallanItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "vendorReturnChallanId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "VendorReturnChallanItem_vendorReturnChallanId_fkey" FOREIGN KEY ("vendorReturnChallanId") REFERENCES "VendorReturnChallan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorReturnChallanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "loginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" DATETIME,
    "ipAddress" TEXT,
    "device" TEXT,
    CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" INTEGER,
    "recordUuid" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChallanSequence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "challanType" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_uuid_key" ON "Company"("uuid");
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");
CREATE UNIQUE INDEX "FinancialYear_uuid_key" ON "FinancialYear"("uuid");
CREATE INDEX "FinancialYear_companyId_idx" ON "FinancialYear"("companyId");
CREATE UNIQUE INDEX "FinancialYear_companyId_label_key" ON "FinancialYear"("companyId", "label");
CREATE UNIQUE INDEX "Department_uuid_key" ON "Department"("uuid");
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");
CREATE UNIQUE INDEX "Department_companyId_name_key" ON "Department"("companyId", "name");
CREATE UNIQUE INDEX "ItemCategory_uuid_key" ON "ItemCategory"("uuid");
CREATE UNIQUE INDEX "ItemCategory_name_key" ON "ItemCategory"("name");
CREATE UNIQUE INDEX "ItemCategory_prefix_key" ON "ItemCategory"("prefix");
CREATE UNIQUE INDEX "Unit_uuid_key" ON "Unit"("uuid");
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");
CREATE UNIQUE INDEX "Item_uuid_key" ON "Item"("uuid");
CREATE UNIQUE INDEX "Item_itemCode_key" ON "Item"("itemCode");
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");
CREATE INDEX "Item_isActive_idx" ON "Item"("isActive");
CREATE UNIQUE INDEX "Vendor_uuid_key" ON "Vendor"("uuid");
CREATE UNIQUE INDEX "Location_uuid_key" ON "Location"("uuid");
CREATE INDEX "Location_locationType_idx" ON "Location"("locationType");
CREATE UNIQUE INDEX "ReceiptChallan_uuid_key" ON "ReceiptChallan"("uuid");
CREATE INDEX "ReceiptChallan_companyId_idx" ON "ReceiptChallan"("companyId");
CREATE INDEX "ReceiptChallan_financialYearId_idx" ON "ReceiptChallan"("financialYearId");
CREATE INDEX "ReceiptChallan_date_idx" ON "ReceiptChallan"("date");
CREATE INDEX "ReceiptChallan_status_idx" ON "ReceiptChallan"("status");
CREATE INDEX "ReceiptChallan_vendorId_idx" ON "ReceiptChallan"("vendorId");
CREATE INDEX "ReceiptChallan_companyId_financialYearId_idx" ON "ReceiptChallan"("companyId", "financialYearId");
CREATE INDEX "ReceiptChallan_companyId_financialYearId_status_idx" ON "ReceiptChallan"("companyId", "financialYearId", "status");
CREATE INDEX "ReceiptChallan_companyId_financialYearId_date_idx" ON "ReceiptChallan"("companyId", "financialYearId", "date");
CREATE UNIQUE INDEX "ReceiptChallan_companyId_financialYearId_challanNo_key" ON "ReceiptChallan"("companyId", "financialYearId", "challanNo");
CREATE UNIQUE INDEX "ReceiptChallanItem_uuid_key" ON "ReceiptChallanItem"("uuid");
CREATE INDEX "ReceiptChallanItem_receiptChallanId_idx" ON "ReceiptChallanItem"("receiptChallanId");
CREATE INDEX "ReceiptChallanItem_itemId_idx" ON "ReceiptChallanItem"("itemId");
CREATE UNIQUE INDEX "IssueChallan_uuid_key" ON "IssueChallan"("uuid");
CREATE INDEX "IssueChallan_companyId_idx" ON "IssueChallan"("companyId");
CREATE INDEX "IssueChallan_financialYearId_idx" ON "IssueChallan"("financialYearId");
CREATE INDEX "IssueChallan_departmentId_idx" ON "IssueChallan"("departmentId");
CREATE INDEX "IssueChallan_sourceStoreId_idx" ON "IssueChallan"("sourceStoreId");
CREATE INDEX "IssueChallan_date_idx" ON "IssueChallan"("date");
CREATE INDEX "IssueChallan_status_idx" ON "IssueChallan"("status");
CREATE INDEX "IssueChallan_companyId_financialYearId_idx" ON "IssueChallan"("companyId", "financialYearId");
CREATE INDEX "IssueChallan_companyId_financialYearId_status_idx" ON "IssueChallan"("companyId", "financialYearId", "status");
CREATE INDEX "IssueChallan_companyId_financialYearId_departmentId_idx" ON "IssueChallan"("companyId", "financialYearId", "departmentId");
CREATE UNIQUE INDEX "IssueChallan_companyId_financialYearId_challanNo_key" ON "IssueChallan"("companyId", "financialYearId", "challanNo");
CREATE UNIQUE INDEX "IssueChallanItem_uuid_key" ON "IssueChallanItem"("uuid");
CREATE INDEX "IssueChallanItem_issueChallanId_idx" ON "IssueChallanItem"("issueChallanId");
CREATE INDEX "IssueChallanItem_itemId_idx" ON "IssueChallanItem"("itemId");
CREATE INDEX "IssueChallanItem_locationId_idx" ON "IssueChallanItem"("locationId");
CREATE UNIQUE INDEX "TransferChallan_uuid_key" ON "TransferChallan"("uuid");
CREATE INDEX "TransferChallan_companyId_idx" ON "TransferChallan"("companyId");
CREATE INDEX "TransferChallan_financialYearId_idx" ON "TransferChallan"("financialYearId");
CREATE INDEX "TransferChallan_fromDepartmentId_idx" ON "TransferChallan"("fromDepartmentId");
CREATE INDEX "TransferChallan_toDepartmentId_idx" ON "TransferChallan"("toDepartmentId");
CREATE INDEX "TransferChallan_date_idx" ON "TransferChallan"("date");
CREATE INDEX "TransferChallan_status_idx" ON "TransferChallan"("status");
CREATE INDEX "TransferChallan_companyId_financialYearId_idx" ON "TransferChallan"("companyId", "financialYearId");
CREATE INDEX "TransferChallan_companyId_financialYearId_status_idx" ON "TransferChallan"("companyId", "financialYearId", "status");
CREATE UNIQUE INDEX "TransferChallan_companyId_financialYearId_challanNo_key" ON "TransferChallan"("companyId", "financialYearId", "challanNo");
CREATE UNIQUE INDEX "TransferChallanItem_uuid_key" ON "TransferChallanItem"("uuid");
CREATE INDEX "TransferChallanItem_transferChallanId_idx" ON "TransferChallanItem"("transferChallanId");
CREATE INDEX "TransferChallanItem_itemId_idx" ON "TransferChallanItem"("itemId");
CREATE INDEX "TransferChallanItem_locationId_idx" ON "TransferChallanItem"("locationId");
CREATE INDEX "TransferChallanItem_toLocationId_idx" ON "TransferChallanItem"("toLocationId");
CREATE UNIQUE INDEX "StockTransaction_uuid_key" ON "StockTransaction"("uuid");
CREATE INDEX "StockTransaction_companyId_financialYearId_itemId_idx" ON "StockTransaction"("companyId", "financialYearId", "itemId");
CREATE INDEX "StockTransaction_companyId_financialYearId_transactionType_idx" ON "StockTransaction"("companyId", "financialYearId", "transactionType");
CREATE INDEX "StockTransaction_companyId_financialYearId_transactionDate_idx" ON "StockTransaction"("companyId", "financialYearId", "transactionDate");
CREATE INDEX "StockTransaction_itemId_transactionType_idx" ON "StockTransaction"("itemId", "transactionType");
CREATE INDEX "StockTransaction_referenceType_referenceId_idx" ON "StockTransaction"("referenceType", "referenceId");
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");
CREATE INDEX "StockTransaction_departmentId_idx" ON "StockTransaction"("departmentId");
CREATE INDEX "StockTransaction_locationId_idx" ON "StockTransaction"("locationId");
CREATE INDEX "StockTransaction_refTransferId_idx" ON "StockTransaction"("refTransferId");
CREATE INDEX "StockTransaction_itemId_locationId_id_idx" ON "StockTransaction"("itemId", "locationId", "id");
CREATE INDEX "StockTransaction_condition_idx" ON "StockTransaction"("condition");
CREATE INDEX "StockTransaction_itemId_transactionDate_idx" ON "StockTransaction"("itemId", "transactionDate");
CREATE INDEX "StockTransaction_companyId_itemId_idx" ON "StockTransaction"("companyId", "itemId");
CREATE UNIQUE INDEX "OpeningStock_uuid_key" ON "OpeningStock"("uuid");
CREATE INDEX "OpeningStock_financialYearId_idx" ON "OpeningStock"("financialYearId");
CREATE INDEX "OpeningStock_itemId_idx" ON "OpeningStock"("itemId");
CREATE UNIQUE INDEX "OpeningStock_financialYearId_itemId_key" ON "OpeningStock"("financialYearId", "itemId");
CREATE UNIQUE INDEX "AssetInstallation_uuid_key" ON "AssetInstallation"("uuid");
CREATE INDEX "AssetInstallation_itemId_idx" ON "AssetInstallation"("itemId");
CREATE INDEX "AssetInstallation_locationId_idx" ON "AssetInstallation"("locationId");
CREATE INDEX "AssetInstallation_status_idx" ON "AssetInstallation"("status");
CREATE UNIQUE INDEX "DamageEntry_uuid_key" ON "DamageEntry"("uuid");
CREATE INDEX "DamageEntry_itemId_idx" ON "DamageEntry"("itemId");
CREATE INDEX "DamageEntry_locationId_idx" ON "DamageEntry"("locationId");
CREATE INDEX "DamageEntry_date_idx" ON "DamageEntry"("date");
CREATE UNIQUE INDEX "StockAdjustment_uuid_key" ON "StockAdjustment"("uuid");
CREATE INDEX "StockAdjustment_companyId_financialYearId_idx" ON "StockAdjustment"("companyId", "financialYearId");
CREATE INDEX "StockAdjustment_itemId_idx" ON "StockAdjustment"("itemId");
CREATE INDEX "StockAdjustment_departmentId_idx" ON "StockAdjustment"("departmentId");
CREATE INDEX "StockAdjustment_locationId_idx" ON "StockAdjustment"("locationId");
CREATE INDEX "StockAdjustment_companyId_financialYearId_itemId_idx" ON "StockAdjustment"("companyId", "financialYearId", "itemId");
CREATE UNIQUE INDEX "VendorReturnChallan_uuid_key" ON "VendorReturnChallan"("uuid");
CREATE INDEX "VendorReturnChallan_companyId_idx" ON "VendorReturnChallan"("companyId");
CREATE INDEX "VendorReturnChallan_financialYearId_idx" ON "VendorReturnChallan"("financialYearId");
CREATE INDEX "VendorReturnChallan_vendorId_idx" ON "VendorReturnChallan"("vendorId");
CREATE INDEX "VendorReturnChallan_date_idx" ON "VendorReturnChallan"("date");
CREATE INDEX "VendorReturnChallan_status_idx" ON "VendorReturnChallan"("status");
CREATE INDEX "VendorReturnChallan_companyId_financialYearId_idx" ON "VendorReturnChallan"("companyId", "financialYearId");
CREATE INDEX "VendorReturnChallan_companyId_financialYearId_status_idx" ON "VendorReturnChallan"("companyId", "financialYearId", "status");
CREATE UNIQUE INDEX "VendorReturnChallan_companyId_financialYearId_challanNo_key" ON "VendorReturnChallan"("companyId", "financialYearId", "challanNo");
CREATE UNIQUE INDEX "VendorReturnChallanItem_uuid_key" ON "VendorReturnChallanItem"("uuid");
CREATE INDEX "VendorReturnChallanItem_vendorReturnChallanId_idx" ON "VendorReturnChallanItem"("vendorReturnChallanId");
CREATE INDEX "VendorReturnChallanItem_itemId_idx" ON "VendorReturnChallanItem"("itemId");
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "LoginHistory_userId_idx" ON "LoginHistory"("userId");
CREATE INDEX "LoginHistory_loginAt_idx" ON "LoginHistory"("loginAt");
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");
CREATE INDEX "AuditLog_tableName_recordId_idx" ON "AuditLog"("tableName", "recordId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE UNIQUE INDEX "ChallanSequence_companyId_financialYearId_challanType_key" ON "ChallanSequence"("companyId", "financialYearId", "challanType");
