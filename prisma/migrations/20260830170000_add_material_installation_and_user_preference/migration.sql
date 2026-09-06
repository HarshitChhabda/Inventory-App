-- AlterTable: Add quantityInstalled to MaterialDemandItem
ALTER TABLE MaterialDemandItem ADD COLUMN quantityInstalled DECIMAL NOT NULL DEFAULT 0;

-- CreateTable: MaterialInstallation
CREATE TABLE IF NOT EXISTS MaterialInstallation (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    installationNumber TEXT NOT NULL,
    companyId INTEGER NOT NULL,
    financialYearId INTEGER NOT NULL,
    storeId INTEGER NOT NULL,
    locationId INTEGER,
    locationName TEXT,
    departmentId INTEGER,
    departmentName TEXT,
    dharmshalaName TEXT,
    date DATETIME NOT NULL,
    installedBy TEXT,
    approvedBy TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'POSTED',
    serviceRequestId INTEGER,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL,
    CONSTRAINT MaterialInstallation_companyId_fkey FOREIGN KEY (companyId) REFERENCES Company (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallation_financialYearId_fkey FOREIGN KEY (financialYearId) REFERENCES FinancialYear (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallation_storeId_fkey FOREIGN KEY (storeId) REFERENCES Store (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallation_locationId_fkey FOREIGN KEY (locationId) REFERENCES Location (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallation_serviceRequestId_fkey FOREIGN KEY (serviceRequestId) REFERENCES ServiceRequest (id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: MaterialInstallationItem
CREATE TABLE IF NOT EXISTS MaterialInstallationItem (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    materialInstallationId INTEGER NOT NULL,
    itemId INTEGER NOT NULL,
    itemName TEXT NOT NULL,
    itemCode TEXT,
    unitName TEXT,
    quantityInstalled DECIMAL NOT NULL,
    condition TEXT NOT NULL DEFAULT 'GOOD',
    remarks TEXT,
    serviceRequestId INTEGER,
    materialDemandItemId INTEGER,
    transactionHeaderId INTEGER,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL,
    CONSTRAINT MaterialInstallationItem_materialInstallationId_fkey FOREIGN KEY (materialInstallationId) REFERENCES MaterialInstallation (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallationItem_itemId_fkey FOREIGN KEY (itemId) REFERENCES Item (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallationItem_serviceRequestId_fkey FOREIGN KEY (serviceRequestId) REFERENCES ServiceRequest (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallationItem_materialDemandItemId_fkey FOREIGN KEY (materialDemandItemId) REFERENCES MaterialDemandItem (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT MaterialInstallationItem_transactionHeaderId_fkey FOREIGN KEY (transactionHeaderId) REFERENCES TransactionHeader (id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: UserPreference
CREATE TABLE IF NOT EXISTS UserPreference (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL
);

-- CreateIndex: Unique constraint on MaterialInstallation.installationNumber
CREATE UNIQUE INDEX IF NOT EXISTS MaterialInstallation_installationNumber_key ON MaterialInstallation(installationNumber);

-- CreateIndex: Indexes for MaterialInstallation
CREATE INDEX IF NOT EXISTS MaterialInstallation_companyId_idx ON MaterialInstallation(companyId);
CREATE INDEX IF NOT EXISTS MaterialInstallation_financialYearId_idx ON MaterialInstallation(financialYearId);
CREATE INDEX IF NOT EXISTS MaterialInstallation_storeId_idx ON MaterialInstallation(storeId);
CREATE INDEX IF NOT EXISTS MaterialInstallation_serviceRequestId_idx ON MaterialInstallation(serviceRequestId);

-- CreateIndex: Indexes for MaterialInstallationItem
CREATE INDEX IF NOT EXISTS MaterialInstallationItem_materialInstallationId_idx ON MaterialInstallationItem(materialInstallationId);
CREATE INDEX IF NOT EXISTS MaterialInstallationItem_itemId_idx ON MaterialInstallationItem(itemId);
CREATE INDEX IF NOT EXISTS MaterialInstallationItem_serviceRequestId_idx ON MaterialInstallationItem(serviceRequestId);
CREATE INDEX IF NOT EXISTS MaterialInstallationItem_materialDemandItemId_idx ON MaterialInstallationItem(materialDemandItemId);
CREATE INDEX IF NOT EXISTS MaterialInstallationItem_transactionHeaderId_idx ON MaterialInstallationItem(transactionHeaderId);

-- CreateIndex: Unique constraint on UserPreference
CREATE UNIQUE INDEX IF NOT EXISTS UserPreference_userId_key_key ON UserPreference(userId, key);

-- CreateIndex: Index for UserPreference
CREATE INDEX IF NOT EXISTS UserPreference_userId_idx ON UserPreference(userId);
