-- AlterTable: Add quantityConsumed to MaterialDemandItem
ALTER TABLE "MaterialDemandItem" ADD COLUMN "quantityConsumed" DECIMAL NOT NULL DEFAULT 0;

-- AlterTable: Add totalConsumption to FinancialYear
ALTER TABLE "FinancialYear" ADD COLUMN "totalConsumption" REAL NOT NULL DEFAULT 0;

-- CreateTable: MaterialConsumption
CREATE TABLE IF NOT EXISTS "MaterialConsumption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "consumptionNumber" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "locationId" INTEGER,
    "locationName" TEXT,
    "departmentId" INTEGER,
    "dharmshalaName" TEXT,
    "date" DATETIME NOT NULL,
    "usedBy" TEXT,
    "issuedBy" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "transactionHeaderId" INTEGER,
    "serviceRequestId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_transactionHeaderId_fkey" FOREIGN KEY ("transactionHeaderId") REFERENCES "TransactionHeader" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: MaterialConsumptionItem
CREATE TABLE IF NOT EXISTS "MaterialConsumptionItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "materialConsumptionId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemCode" TEXT,
    "unitName" TEXT,
    "quantityUsed" DECIMAL NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,
    "serviceRequestId" INTEGER,
    "materialDemandItemId" INTEGER,
    "transactionHeaderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialConsumptionItem_materialConsumptionId_fkey" FOREIGN KEY ("materialConsumptionId") REFERENCES "MaterialConsumption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumptionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumptionItem_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumptionItem_materialDemandItemId_fkey" FOREIGN KEY ("materialDemandItemId") REFERENCES "MaterialDemandItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumptionItem_transactionHeaderId_fkey" FOREIGN KEY ("transactionHeaderId") REFERENCES "TransactionHeader" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaterialConsumption_companyId_idx" ON "MaterialConsumption"("companyId");
CREATE INDEX IF NOT EXISTS "MaterialConsumption_financialYearId_idx" ON "MaterialConsumption"("financialYearId");
CREATE INDEX IF NOT EXISTS "MaterialConsumption_storeId_idx" ON "MaterialConsumption"("storeId");
CREATE INDEX IF NOT EXISTS "MaterialConsumption_locationId_idx" ON "MaterialConsumption"("locationId");
CREATE INDEX IF NOT EXISTS "MaterialConsumption_serviceRequestId_idx" ON "MaterialConsumption"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "MaterialConsumption_transactionHeaderId_idx" ON "MaterialConsumption"("transactionHeaderId");
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialConsumption_consumptionNumber_key" ON "MaterialConsumption"("consumptionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialConsumption_uuid_key" ON "MaterialConsumption"("uuid");
CREATE INDEX IF NOT EXISTS "MaterialConsumptionItem_materialConsumptionId_idx" ON "MaterialConsumptionItem"("materialConsumptionId");
CREATE INDEX IF NOT EXISTS "MaterialConsumptionItem_itemId_idx" ON "MaterialConsumptionItem"("itemId");
CREATE INDEX IF NOT EXISTS "MaterialConsumptionItem_serviceRequestId_idx" ON "MaterialConsumptionItem"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "MaterialConsumptionItem_materialDemandItemId_idx" ON "MaterialConsumptionItem"("materialDemandItemId");
CREATE INDEX IF NOT EXISTS "MaterialConsumptionItem_transactionHeaderId_idx" ON "MaterialConsumptionItem"("transactionHeaderId");
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialConsumptionItem_uuid_key" ON "MaterialConsumptionItem"("uuid");
