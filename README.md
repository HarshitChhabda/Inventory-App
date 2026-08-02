# Mahaveerji Inventory — Store & Material Movement Management System

![Electron](https://img.shields.io/badge/Electron-28-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6)
![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)
![SQLite](https://img.shields.io/badge/SQLite-003B57)
![MUI](https://img.shields.io/badge/MUI-5-007FFF)
![License](https://img.shields.io/badge/License-Proprietary-red)

**Shri Mahaveerji (Digamber Jain Atishay Kshetra)** के लिए बना यह एक Desktop Inventory Management Application है। यह stores, departments, और rooms (धर्मशाला कमरे) के बीच materials के पूरे flow — आना (Receipt), जाना (Issue), और Transfer — को track करता है।

> **Version:** 1.5.0 | **Platform:** Windows (NSIS Installer) | **Database:** SQLite + Prisma ORM

---

## Table of Contents

- [1. App Overview](#1-app-overview)
- [2. Database Structure](#2-database-structure)
- [3. Current Workflow / Business Logic](#3-current-workflow--business-logic)
- [4. Services Architecture](#4-services-architecture)
- [5. Reports System](#5-reports-system)
- [6. Tools & Utilities](#6-tools--utilities)
- [7. Tech Stack](#7-tech-stack)
- [8. Project Structure](#8-project-structure)
- [9. Key Features](#9-key-features)
- [10. Getting Started](#10-getting-started)
- [11. Database Schema Diagram](#11-database-schema-diagram)

---

## 1. App Overview

### किस लिए बना है?

यह application एक बड़े धार्मिक संस्थान (Shri Mahaveerji) के विभिन्न stores, departments और धर्मशाला कमरों के बीच inventory movement को manage करने के लिए बनाया गया है। इसमें:

- **Stores** से **Dharamshala rooms** तक माल जाता है (Issue)
- **Vendor** से stores में माल आता है (Receipt)
- **एक store से दूसरे store/department** में माल shift होता है (Transfer)
- **Vendor को ख़राब माल वापस** जाता है (Vendor Return)
- **Damage, Adjustment, Asset Installation** जैसी और गतिविधियाँ track होती हैं

### Main Modules / Pages

| Module | Description |
|---|---|
| **Dashboard** | पूरे system का overview — stock summary, recent activity, quick actions |
| **Receipt Challans** | Vendor से माल receive करना (Inward) |
| **Issue Challans** | Store से department/room को माल देना (Outward) |
| **Transfer Challans** | एक department से दूसरे department में माल भेजना |
| **Vendor Returns** | ख़राब/extra माल vendor को वापस करना |
| **Stock Adjustments** | Physical verification के बाद stock में सुधार |
| **Damage Entry** | ख़राब हुए माल की entry |
| **Stock Ledger** | किसी भी item की पूरी transaction history |
| **Item History** | किसी item का पूरा journey — कहाँ गया, कब आया |
| **Room Details (Facilities)** | धर्मशाला के हर कमरे में क्या-क्या है, कितना है |
| **Reports** | 25+ तरह की reports — Receipt Register, Issue Register, Stock Summary, Department Stock, Low Stock, Dead Stock, Consumption, Audit Log आदि |
| **Tools** | Kruti Dev/DevLys text converter, XPS/PDF file converter, Item import from XPS/CSV |
| **Masters** | Items, Categories, Units, Vendors, Departments, Locations को manage करना |
| **Financial Year** | नया FY बनाना, पुराना FY बंद करना, opening balance carry-forward |
| **Backup** | Automatic scheduled backups (15 min, daily, weekly, monthly, yearly) |
| **Settings** | App configuration, theme, preferences |

---

## 2. Database Structure (सबसे ज़रूरी हिस्सा)

Database **SQLite** पर है और **Prisma ORM** से manage होता है। Database file `dev.db` के रूप में store होती है।

### 2.1 Organisation & Admin Tables

#### `Company`
संस्था की जानकारी।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `name` | String (unique) | Company/Institution name |
| `address` | String? | Address |
| `phone` | String? | Phone number |
| `logoPath` | String? | Logo file path |
| `isActive` | Boolean | Active/inactive |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

#### `FinancialYear`
Accounting financial years।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `companyId` | Int (FK → Company) | किस company का FY है |
| `label` | String | जैसे "2025-26" |
| `startDate` | DateTime | FY start date |
| `endDate` | DateTime | FY end date |
| `isClosed` | Boolean | FY बंद हुआ या नहीं |
| `closedAt` | DateTime? | कब बंद हुआ |
| `createdAt` | DateTime | Creation timestamp |

#### `Department`
Stores, Dharamshalas, और अन्य departments।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `companyId` | Int (FK → Company) | किस company का department है |
| `name` | String | Department name (जैसे "इमारत स्टोर", "कटला उत्तरी विंग") |
| `code` | String? | Short code |
| `departmentType` | String | **"Store"** या **"Dharamshala"** या अन्य |
| `isActive` | Boolean | Active/inactive |

**महत्वपूर्ण:** `departmentType` field यह decide करता है कि department "Source Store" है (जहाँ से माल जाता है) या "Destination" (जहाँ माल आता है)। Issue Challan में source store "Store" type का होता है और destination "Dharamshala" type का।

#### `Location`
Physical locations — Buildings (धर्मशाला), Rooms, Floors।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `locationType` | String | **"Dharamshala"** या **"Room"** या "Building" |
| `locationName` | String | Location name |
| `category` | String? | Room category (जैसे "A.C. DELUXE 2 BED") |
| `floor` | String? | Floor name |
| `parentId` | Int? (FK → Location) | **Self-referencing parent** — Room का parent Dharamshala है |
| `isActive` | Boolean | Active/inactive |

**Hierarchy/Parent-Child Relation:**
```
Dharamshala (parentId = null)
├── Room 1 (parentId = Dharamshala.id)
├── Room 2 (parentId = Dharamshala.id)
└── Room 3 (parentId = Dharamshala.id)
```

`parentId` field खुद Location table की `id` को point करता है — इसे "self-referencing relation" कहते हैं। इससे Building → Room hierarchy बनती है।

**Department और Location का रिश्ता:** Department और Location अलग-अलग tables हैं। धर्मशाला का **Department record** (जैसे "कटला उत्तरी विंग", departmentType="Dharamshala") और उसका **Location record** (जैसे "कटला उत्तरी विंग", locationType="Dharamshala") — दोनों अलग-अलग होते हैं। IssueChallan `departmentId` से department को refer करता है, और IssueChallanItem `locationId` से specific room को।

### 2.2 Item Master Tables

#### `ItemCategory`
Items की categories।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `name` | String (unique) | Category name (जैसे "इमारत स्टोर") |
| `prefix` | String (unique) | Code prefix (जैसे "IM", "BL", "JS") |
| `isActive` | Boolean | Active/inactive |

#### `Unit`
Measurement units।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `name` | String (unique) | Unit name (जैसे "Pcs", "Kg", "Ltr", "Meter") |
| `symbol` | String? | Short symbol |

#### `Item`
Inventory items।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `itemCode` | String (unique) | Item code (जैसे "IM-008") |
| `itemName` | String | Item name (जैसे "1 खुरपी") |
| `categoryId` | Int (FK → ItemCategory) | किस category का item है |
| `unitId` | Int (FK → Unit) | किस unit से measure होता है |
| `minimumStockLevel` | Decimal | Minimum stock level (low stock alert के लिए) |
| `isActive` | Boolean | Active/inactive |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

#### `Vendor`
Suppliers।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `name` | String | Vendor name |
| `contactPerson` | String? | Contact person |
| `phone` | String? | Phone |
| `address` | String? | Address |
| `gstNumber` | String? | GST number |
| `isActive` | Boolean | Active/inactive |
| `createdAt` | DateTime | Creation timestamp |

### 2.3 Transaction Tables (Challans)

#### `ReceiptChallan` — माल आना (Inward)

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `challanNo` | String (unique) | Auto-generated (RC-XXXXX) |
| `companyId` | Int (FK) | Company |
| `financialYearId` | Int (FK) | Financial Year |
| `date` | DateTime | Receipt date |
| `sourceType` | String | "Vendor", "JaipurOffice", "OtherBranch", "Donation" |
| `vendorId` | Int? (FK → Vendor) | Vendor (if source is Vendor) |
| `sourceName` | String? | Source name (if not vendor) |
| `invoiceNumber` | String? | Vendor invoice number |
| `invoiceDate` | DateTime? | Vendor invoice date |
| `vehicleNumber` | String? | Vehicle number |
| `receivedBy` | String | किसने receive किया |
| `departmentId` | Int? (FK → Department) | किस store में आया |
| `remarks` | String? | Additional remarks |
| `status` | String | **"Draft"** → **"Posted"** → "Cancelled" |
| `postedAt` | DateTime? | Posting timestamp |
| `postedBy` | String? | किसने post किया |
| `cancelledAt` | DateTime? | Cancellation timestamp |
| `cancelReason` | String? | Cancellation reason |

**Status Flow:** Draft → Posted (final, creates stock transactions) → Cancelled (reverses stock)

#### `ReceiptChallanItem`

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `receiptChallanId` | Int (FK) | Parent receipt challan |
| `itemId` | Int (FK → Item) | कौन सा item |
| `unitId` | Int (FK → Unit) | Unit |
| `quantity` | Decimal | कितना |
| `rate` | Decimal | Rate per unit |
| `amount` | Decimal | Total amount |
| `locationId` | Int? (FK → Location) | किस room/location में गया |
| `remarks` | String? | Additional remarks |

#### `IssueChallan` — माल जाना (Outward)

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `challanNo` | String (unique) | Auto-generated (IC-XXXXX) |
| `serialNo` | String? | Serial number |
| `companyId` | Int (FK) | Company |
| `financialYearId` | Int (FK) | Financial Year |
| `departmentId` | Int (FK → Department) | **Destination** — किस department/dharamshala को माल गया |
| `sourceStoreId` | Int? (FK → Department) | **Source** — किस store से माल गया |
| `date` | DateTime | Issue date |
| `issuedBy` | String | किसने issue किया |
| `approvedBy` | String? | किसने approve किया |
| `purpose` | String? | माल किसलिए गया |
| `remarks` | String? | Additional remarks |
| `status` | String | Draft → Posted → Cancelled |
| `postedAt` | DateTime? | Posting timestamp |
| `postedBy` | String? | किसने post किया |
| `cancelledAt` | DateTime? | Cancellation timestamp |
| `cancelReason` | String? | Cancellation reason |

#### `IssueChallanItem`

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `issueChallanId` | Int (FK) | Parent issue challan |
| `itemId` | Int (FK → Item) | कौन सा item |
| `unitId` | Int (FK → Unit) | Unit |
| `quantity` | Decimal | कितना |
| `locationId` | Int? (FK → Location) | किस specific room में गया |
| `usedAt` | String? | कहाँ इस्तेमाल हुआ |
| `purpose` | String? | Purpose |
| `remarks` | String? | Additional remarks |

#### `TransferChallan` — एक department से दूसरे department में

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `challanNo` | String (unique) | Auto-generated (TC-XXXXX) |
| `companyId` | Int (FK) | Company |
| `financialYearId` | Int (FK) | Financial Year |
| `date` | DateTime | Transfer date |
| `fromDepartmentId` | Int (FK → Department) | कहाँ से गया |
| `toDepartmentId` | Int (FK → Department) | कहाँ गया |
| `transferredBy` | String | किसने transfer किया |
| `approvedBy` | String? | किसने approve किया |
| `remarks` | String? | Additional remarks |
| `status` | String | Draft → Posted → Cancelled |
| `postedAt` | DateTime? | Posting timestamp |
| `postedBy` | String? | किसने post किया |
| `cancelledAt` | DateTime? | Cancellation timestamp |
| `cancelReason` | String? | Cancellation reason |

#### `TransferChallanItem`

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `transferChallanId` | Int (FK) | Parent transfer challan |
| `itemId` | Int (FK → Item) | कौन सा item |
| `quantity` | Decimal | कितना |
| `rate` | Decimal | Rate |
| `locationId` | Int? (FK → Location) | Source location (room level) |
| `toLocationId` | Int? (FK → Location) | Destination location (room level) |
| `remarks` | String? | Additional remarks |

#### `VendorReturnChallan`

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `challanNo` | String (unique) | Auto-generated (VRC-XXXXX) |
| `vendorId` | Int (FK → Vendor) | किस vendor को वापस जा रहा है |
| `originalReceiptId` | Int? (FK → ReceiptChallan) | Original receipt reference |
| `date` | DateTime | Return date |
| `reason` | String | वापसी का कारण |
| `returnedBy` | String | किसने return किया |
| `remarks` | String? | Additional remarks |
| `status` | String | Draft → Posted → Cancelled |
| `postedAt` | DateTime? | Posting timestamp |
| `postedBy` | String? | किसने post किया |
| `cancelledAt` | DateTime? | Cancellation timestamp |
| `cancelReason` | String? | Cancellation reason |

#### `VendorReturnChallanItem`

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `vendorReturnChallanId` | Int (FK) | Parent VRC |
| `itemId` | Int (FK → Item) | Item |
| `quantity` | Decimal | Quantity |
| `rate` | Decimal | Rate |

### 2.4 Core Ledger Table — StockTransaction (सबसे Important)

यह पूरे system की **backbone** है। हर stock movement का record यहाँ store होता है।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `companyId` | Int (FK) | Company |
| `financialYearId` | Int (FK) | Financial Year |
| `itemId` | Int (FK → Item) | कौन सा item |
| `departmentId` | Int? (FK → Department) | किस department का transaction है |
| `locationId` | Int? (FK → Location) | किस specific room का (if any) |
| `transactionType` | String | **"PURCHASE"**, **"ISSUE"**, **"TRANSFER_OUT"**, **"TRANSFER_IN"**, **"REVERSAL"**, **"ADJUSTMENT_IN"**, **"ADJUSTMENT_OUT"**, **"DAMAGE"**, **"VENDOR_RETURN"**, **"OPENING_STOCK"** |
| `transactionDate` | DateTime | Transaction date |
| `quantityIn` | Decimal | आया कितना (positive movement) |
| `quantityOut` | Decimal | गया कितना (negative movement) |
| `rate` | Decimal | Rate per unit |
| `balanceQty` | Decimal | **Running balance** — इस transaction के बाद कितना बचा |
| `referenceType` | String? | किस challan का transaction है ("ReceiptChallan", "IssueChallan", "TransferChallan" आदि) |
| `referenceId` | Int? | उस challan की ID |
| `referenceNo` | String? | उस challan का number (जैसे "IC-00001") |
| `refTransferId` | String? | Transfer की pair linking — TRANSFER_OUT और TRANSFER_IN को जोड़ता है |
| `condition` | String | "GOOD" या "DAMAGED" — vendor return के लिए important |
| `remarks` | String? | Additional remarks |
| `createdAt` | DateTime | Creation timestamp |
| `createdBy` | String | किसने create किया |

**Transaction Types Explained:**

| Type | When Created | Description |
|---|---|---|
| `PURCHASE` | Receipt Challan post | माल आया |
| `ISSUE` | Issue Challan post | दो rows: source पर quantityOut, destination पर quantityIn |
| `TRANSFER_OUT` | Transfer Challan post | Source से माल गया |
| `TRANSFER_IN` | Transfer Challan post | Destination को माल मिला |
| `REVERSAL` | Challan cancel | Stock वापस आया |
| `ADJUSTMENT_IN` | Stock adjustment | Stock बढ़ा |
| `ADJUSTMENT_OUT` | Stock adjustment | Stock घटा |
| `DAMAGE` | Damage entry | ख़राब माल record हुआ |
| `VENDOR_RETURN` | Vendor return | Vendor को माल वापस गया |
| `OPENING_STOCK` | FY start | Financial Year की शुरुआत में opening balance |

### 2.5 Supporting Tables

#### `OpeningStock`
Financial Year की शुरुआत में opening balances।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `financialYearId` | Int (FK) | Financial Year |
| `itemId` | Int (FK → Item) | Item |
| `quantity` | Decimal | Opening quantity |
| `rate` | Decimal | Opening rate |
| `createdAt` | DateTime | Creation timestamp |

#### `AssetInstallation`
कमरों में installed assets का record।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `itemId` | Int (FK → Item) | कौन सा item installed है |
| `locationId` | Int (FK → Location) | कहाँ installed है |
| `issueChallanId` | Int? (FK) | किस issue challan से आया |
| `installedDate` | DateTime | कब install hua |
| `quantity` | Decimal | कितना installed |
| `installedBy` | String? | किसने install किया |
| `status` | String | "Active", "Inactive", "Damaged" |
| `remarks` | String? | Additional remarks |

Issue Challan delete/cancel करने पर installations "Inactive" हो जाती हैं।

#### `DamageEntry`
ख़राब हुए माल की entry।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `companyId` | Int? (FK) | Company |
| `itemId` | Int (FK) | Item |
| `locationId` | Int? (FK) | कहाँ ख़राब हुआ |
| `assetInstallationId` | Int? (FK) | किस asset installation से जुड़ा है |
| `date` | DateTime | Date |
| `quantity` | Decimal | कितना ख़राब |
| `reason` | String | कारण |
| `reportedBy` | String | किसने report किया |
| `remarks` | String? | Additional remarks |
| `originalPurchaseDate` | DateTime? | Original purchase date |
| `originalVendorName` | String? | Original vendor name |
| `originalInvoiceNumber` | String? | Original invoice number |
| `originalRate` | Decimal? | Original rate |
| `status` | String | "Posted" |

#### `StockAdjustment`
Physical verification के बाद stock सुधार।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `companyId` | Int (FK) | Company |
| `financialYearId` | Int (FK) | Financial Year |
| `departmentId` | Int? (FK) | Department |
| `locationId` | Int? (FK) | Location |
| `date` | DateTime | Adjustment date |
| `itemId` | Int (FK) | Item |
| `adjustmentType` | String | "INCREASE" या "DECREASE" |
| `quantity` | Decimal | कितना adjust |
| `reason` | String | कारण |
| `adjustedBy` | String | किसने adjust किया |
| `approvedBy` | String? | किसने approve किया |
| `remarks` | String? | Additional remarks |
| `status` | String | "Posted" |

#### `ChallanSequence`
Auto-incrementing challan numbers के लिए।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `companyId` | Int | Company |
| `financialYearId` | Int | FY |
| `challanType` | String | "RC", "IC", "TC", "VRC" |
| `lastNumber` | Int | आखिरी number |

#### `AuditLog`
हर important action का audit trail।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `companyId` | Int? (FK) | Company |
| `userId` | Int? (FK → User) | किस user ने action किया |
| `action` | String | "CREATE", "UPDATE", "DELETE", "POST", "CANCEL", "LOGIN", "LOGOUT", "EXPORT", "IMPORT", "BACKUP", "RESTORE" |
| `tableName` | String | किस table पर action हुआ |
| `recordId` | Int? | Record ID |
| `recordUuid` | String? | Record UUID |
| `oldValues` | String? | JSON — पुरानी values |
| `newValues` | String? | JSON — नई values |
| `description` | String? | Action description |
| `createdAt` | DateTime | Creation timestamp |

#### `User`
System users की जानकारी।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `uuid` | String | Unique identifier |
| `username` | String (unique) | Login username |
| `passwordHash` | String | Hashed password |
| `fullName` | String | Full name |
| `role` | String | User role (Admin, User, etc.) |
| `isActive` | Boolean | Active/inactive |
| `createdAt` | DateTime | Creation timestamp |

#### `LoginHistory`
User login/logout history।

| Field | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `userId` | Int (FK → User) | किस user ने login किया |
| `loginAt` | DateTime | Login time |
| `logoutAt` | DateTime? | Logout time |
| `ipAddress` | String? | IP address |
| `device` | String? | Device info |

---

## 3. Current Workflow / Business Logic

### 3.1 Receipt Challan — माल आना (Inward)

**Step 1: Draft बनाना**
User Receipt Challan form भरता है — date, vendor, items, quantities, rates। यह "Draft" status में save होता है। Stock पर कोई असर नहीं होता।

**Step 2: Posting (Finalize)**
जब user "Post" बटन दबाता है:
1. Status check — Draft है तो ही post होगा
2. `StockTransaction` में एक नई row बनती है:
   - `transactionType: "PURCHASE"`
   - `quantityIn: item.quantity` (माल आया)
   - `quantityOut: 0`
   - `balanceQty: prevBalance + quantityIn`
   - `departmentId: receipt.departmentId` (किस store में आया)
   - `referenceType: "ReceiptChallan"`, `referenceNo: "RC-XXXXX"`
3. अगर backdated entry है, तो उस date के बाद की सारी transactions का balance फिर से recalculate होता है
4. AuditLog में record save होता है

### 3.2 Issue Challan — माल जाना (Outward)

**Step 1: Draft बनाना**
User चुनता है:
- **Source Store** — किस store से माल जाएगा (departmentType = "Store")
- **Issue To** — किस department/dharamshala को जाएगा
- Items, quantities, rooms (अगर dharamshala है)

**Step 2: Posting**
1. **Stock Validation** — Check करता है कि source store में पर्याप्त stock है या नहीं। `StockTransaction` table में उस item का **सबसे आखिरी transaction** ढूँढता है और उसका `balanceQty` पढ़ता है।
2. **दो StockTransaction rows बनती हैं:**

**Row 1 — Source Store (माल गया):**
```
departmentId: sourceStoreId
quantityIn: 0
quantityOut: item.quantity
balanceQty: prevBalance - item.quantity
transactionType: "ISSUE"
```

**Row 2 — Destination Department (माल मिला):**
```
departmentId: destinationDepartmentId
locationId: item.locationId (specific room)
quantityIn: item.quantity
quantityOut: 0
balanceQty: prevBalance + item.quantity
transactionType: "ISSUE"
```

3. **Asset Installation** — अगर item का `locationId` set है (किसी specific room में गया), तो `AssetInstallation` table में record बनता है
4. Backdated recalculation और AuditLog

### 3.3 Transfer Challan — एक department से दूसरे में

**Step 1: Draft**
User चुनता है from department और to department, items, quantities।

**Step 2: Posting**
1. **Atomic Balance Check** — Transaction के अंदर ही check करता है कि source में पर्याप्त stock है
2. **दो rows बनती हैं:**

**TRANSFER_OUT (Source):**
```
departmentId: fromDepartmentId
quantityOut: item.quantity
balanceQty: prevBalance - quantity
```

**TRANSFER_IN (Destination):**
```
departmentId: toDepartmentId
quantityIn: item.quantity
balanceQty: prevBalance + quantity
```

3. दोनों rows को `refTransferId` से link किया जाता है
4. Source पर अगर कोई Asset installed था, तो उसे "Inactive" mark किया जाता है

### 3.4 Challan Cancel करना

जब कोई Posted challan cancel होता है:
1. **REVERSAL transactions** बनती हैं — जो stock गया था वो वापस आता है
2. Source का balance बढ़ता है, destination का घटता है
3. Asset installations "Inactive" हो जाती हैं
4. Transfer cancel में extra check होता है — destination के पास reversal के लिए enough stock होना चाहिए

### 3.5 Balance Quantity कैसे Calculate होता है?

**Running Balance Ledger System:**

हर `StockTransaction` row में `balanceQty` field होता है। यह बताता है कि इस transaction के बाद उस item का balance कितना है।

**Formula:**
```
balanceQty = previousBalance + quantityIn - quantityOut
```

**Current Stock जानने का तरीका:**
System को शुरुआत से सारे plus-minus करने की ज़रूरत नहीं। बस उस item का **सबसे latest transaction** ढूँढो (ORDER BY transactionDate DESC, id DESC LIMIT 1) और उसका `balanceQty` पढ़ लो।

**Backdated Entry Handling:**
अगर कोई पुराने दिन की entry डाली जाए, तो `recalculateBalancesAfterInsert()` function उस date के बाद की सारी rows का balance फिर से calculate करता है। यह `stockValidation.service.ts` में है।

### 3.6 Transaction History / Ledger

**हाँ, पूरी history maintain होती है।** `StockTransaction` table में हर movement का record है — कब आया, कब गया, किससे, कहाँ, कितना। यह table कभी delete नहीं होता (सिर्फ cancel/reversal entries add होती हैं)।

---

## 4. Services Architecture

### Backend Services (`src/main/services/`)

| Service | Responsibility |
|---|---|
| `receiptChallan.service.ts` | Receipt challan CRUD + post + cancel + delete |
| `issueChallan.service.ts` | Issue challan CRUD + post + cancel + delete |
| `transferChallan.service.ts` | Transfer challan CRUD + post + cancel + delete |
| `vendorReturn.service.ts` | Vendor return (DAMAGED stock only) |
| `stock.service.ts` | Stock balance queries, ledger, department-wise, low stock |
| `stockValidation.service.ts` | Centralized balance validation + recalculation engine |
| `stockAdjustment.service.ts` | Stock adjustments (INCREASE/DECREASE) |
| `stockLedger.service.ts` | Location-level transfers, damage entries, replacements |
| `damage.service.ts` | Damage entry creation |
| `financialYear.service.ts` | FY management + FY close + opening balance carry-forward |
| `backup.service.ts` | Scheduled backups (15-min, daily, weekly, monthly, yearly) |
| `report.service.ts` | 25+ report types + Excel export |

### XPS Converter Services (`src/main/services/xps-converter/`)

| Service | Responsibility |
|---|---|
| `xps-parser.ts` | Parse XPS documents and extract text |
| `kruti-parser.ts` | Parse Kruti Dev encoded text |
| `kruti-to-unicode.ts` | Convert Kruti Dev to Unicode Hindi |
| `font-converter.ts` | Font encoding conversion |
| `font-mapping.ts` | Font character mapping tables |
| `translator.ts` | Hindi to English translation |
| `export.service.ts` | Export converted data to Excel |
| `item-import.service.ts` | Extract and import items from XPS/CSV |

### Data Access Layer (`src/main/repositories/`)

| Repository | Responsibility |
|---|---|
| `stock.repository.ts` | Stock transaction data access |
| `report.repository.ts` | Report data queries |
| `receiptChallan.repository.ts` | Receipt challan data access |
| `issueChallan.repository.ts` | Issue challan data access |
| `item.repository.ts` | Item master data access |

### Key Utility: `stockValidation.service.ts`

यह service stock balance की **single source of truth** है:

- `validateSufficientStock()` — Check करता है कि enough stock है या नहीं
- `getLatestBalance()` — किसी item+location का latest balance
- `recalculateBalancesAfterInsert()` — Backdated entry के बाद balances fix
- `recalculateBalancesAfterDelete()` — Transaction delete के बाद recalculate

### IPC Layer (`electron/ipc/`)

Electron main process से renderer तक communication के लिए IPC handlers:

| Handler | Purpose |
|---|---|
| `challan.ipc.ts` | Challan CRUD operations |
| `stock.ipc.ts` | Stock queries and movements |
| `dashboard.ipc.ts` | Dashboard stats and charts |
| `reports.ipc.ts` | Report generation and export |
| `backup.ipc.ts` | Backup operations |
| `import.ipc.ts` | Data import functionality |

### Worker Thread (`electron/worker/`)

Heavy tasks को background में run करने के लिए:

| File | Purpose |
|---|---|
| `worker-manager.ts` | Worker thread pool management |
| `heavy-tasks.worker.ts` | Background processing tasks (report generation, data export) |

---

## 5. Reports System

Reports page पर 25+ तरह की reports available हैं:

### Purchase Reports
- **Receipt Register** — सभी receipt challans
- **Vendor Purchase** — Vendor-wise purchase summary
- **Vendor Returns** — Vendor return register
- **Purchase History** — Item-wise purchase history with avg rate

### Issue Reports
- **Issue Register** — सभी issue challans
- **Department Wise** — Department-wise consumption
- **Transfer Register** — सभी transfer challans
- **Central Store Summary** — Store stock & issue breakdown with KPIs

### Inventory Reports
- **Stock Ledger** — Complete stock movement ledger
- **Stock Summary** — Current stock levels by item
- **Item History** — Transaction history per item
- **Movement Register** — All stock movements
- **Dharamshala Items** — धर्मशाला में क्या-क्या है
- **Department Stock Status** — Current stock in department and rooms
- **Current Stock** — Store-wise current stock with value
- **Stock Distribution** — Store/Dharamshala/Room wise stock breakdown
- **Dharamshala Distribution** — Dharamshala-level stock & room allocation
- **Room Facilities Checklist** — Installed assets per room
- **Item Audit Ledger** — Complete item movement history

### Analytics Reports
- **Low Stock Items** — Minimum stock level से कम items
- **Dead Stock** — जो items बिल्कुल नहीं बिके/उपयोग हुए
- **Damage Report** — Damaged items report
- **Stock Adjustments** — All adjustments made
- **Audit Log** — System activity log
- **Damage/Scrap/Returns** — Damage, scrap & vendor return audit

Reports **Excel** में export हो सकती हैं (ExcelJS के through)।

---

## 6. Tools & Utilities

Application में एक dedicated **Tools** page है जिसमें तीन मुख्य utilities हैं:

### 6.1 Kruti Dev / DevLys Text Converter
- Kruti Dev 010 या DevLys 010 encoded text को Unicode Hindi में convert करता है
- Auto-detect font type (Kruti Dev, DevLys, या Auto)
- Converted text को Hindi या English में copy कर सकते हैं
- Excel में export कर सकते हैं
- Table data को structured format में parse करता है

### 6.2 XPS/PDF/TXT File Converter
- XPS files को parse करके Hindi text extract करता है
- PDF files से text extraction support
- Text files का direct conversion
- Font detection (Kruti Dev, DevLys, Unicode)
- Bilingual mode (Hindi + English) में Excel export
- Drag & drop file upload support

### 6.3 Item Import
- XPS files से items extract करके bulk import
- CSV files से items import (Item Name, Category, Unit, Item Code columns)
- Preview before import — items को select/deselect कर सकते हैं
- Duplicate detection (already existing items skip होते हैं)
- Unit और Category mapping with existing masters

---

## 7. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | React, TypeScript, Material UI (MUI) | 18, 5.3, v5 |
| **State Management** | TanStack React Query, React Context | v5, — |
| **Routing** | React Router (lazy-loaded routes) | v6 |
| **Desktop Framework** | Electron | 28 |
| **Build Tool** | Vite (with `vite-plugin-electron`) | 5 |
| **Database** | SQLite (local file `dev.db`) | — |
| **ORM** | Prisma | 5 |
| **Validation** | Zod | — |
| **Charts** | Recharts | — |
| **PDF Generation** | @react-pdf/renderer, pdf-lib, pdf-parse | — |
| **Excel Export** | ExcelJS | — |
| **Virtualization** | @tanstack/react-virtual | v3 |
| **Tables** | @tanstack/react-table | v8 |
| **Date Handling** | dayjs | — |
| **Notifications** | react-hot-toast | — |
| **XML Processing** | xml2js | — |
| **Encoding** | iconv-lite | — |
| **Compression** | jszip | — |
| **Scheduling** | node-cron (for backups) | — |
| **Auto-Update** | electron-updater | — |
| **Testing** | Vitest, Testing Library | — |
| **Packaging** | electron-builder (Windows NSIS installer) | — |

---

## 8. Project Structure

```
inventory-app/
├── electron/                         # Electron main process
│   ├── main.ts                       # App entry, window creation, IPC registration
│   ├── preload.ts                    # Context bridge (exposes APIs to renderer)
│   ├── updater.ts                    # Auto-update logic
│   ├── ipc/                          # IPC handlers
│   │   ├── challan.ipc.ts            #   Challan CRUD operations
│   │   ├── stock.ipc.ts             #   Stock queries and movements
│   │   ├── dashboard.ipc.ts         #   Dashboard stats and charts
│   │   ├── reports.ipc.ts           #   Report generation and export
│   │   ├── backup.ipc.ts            #   Backup operations
│   │   └── import.ipc.ts            #   Data import functionality
│   └── worker/                       # Heavy task worker (background processing)
│       ├── worker-manager.ts         #   Worker thread manager
│       └── heavy-tasks.worker.ts     #   Background processing tasks
├── src/
│   ├── main/                         # Backend business logic (runs in main process)
│   │   ├── database/
│   │   │   ├── prisma.client.ts      # Prisma singleton
│   │   │   ├── seed.ts               # Initial data
│   │   │   ├── demo-data.ts          # Demo data loader
│   │   │   └── demo-data-rooms.ts    # Room location data
│   │   ├── services/                 # Core business services
│   │   │   ├── receiptChallan.service.ts
│   │   │   ├── issueChallan.service.ts
│   │   │   ├── transferChallan.service.ts
│   │   │   ├── vendorReturn.service.ts
│   │   │   ├── stock.service.ts
│   │   │   ├── stockValidation.service.ts  # Balance engine
│   │   │   ├── stockAdjustment.service.ts
│   │   │   ├── stockLedger.service.ts
│   │   │   ├── damage.service.ts
│   │   │   ├── financialYear.service.ts
│   │   │   ├── backup.service.ts
│   │   │   ├── report.service.ts
│   │   │   └── xps-converter/        # XPS/PDF text conversion utilities
│   │   │       ├── index.ts
│   │   │       ├── xps-parser.ts
│   │   │       ├── kruti-parser.ts
│   │   │       ├── kruti-to-unicode.ts
│   │   │       ├── font-converter.ts
│   │   │       ├── font-mapping.ts
│   │   │       ├── translator.ts
│   │   │       ├── export.service.ts
│   │   │       └── item-import.service.ts
│   │   ├── repositories/             # Data access layer
│   │   │   ├── stock.repository.ts
│   │   │   ├── report.repository.ts
│   │   │   ├── receiptChallan.repository.ts
│   │   │   ├── issueChallan.repository.ts
│   │   │   └── item.repository.ts
│   │   └── xps-converter/            # XPS/PDF document conversion
│   ├── renderer/                     # React frontend
│   │   ├── App.tsx                   # Root component, routes, providers
│   │   ├── main.tsx                  # Entry point
│   │   ├── pages/
│   │   │   ├── Dashboard/            # Main dashboard with charts/KPIs
│   │   │   ├── Masters/              # Items, Categories, Units, Vendors, Departments, Locations
│   │   │   ├── Inventory/            # Receipt, Issue, Transfer, Vendor Return, Stock Adjustment, Damage, Ledger
│   │   │   ├── Facilities/           # Room Details (dharamshala room tracking)
│   │   │   ├── Reports/              # 25+ reports with configs and queries
│   │   │   ├── Tools/                # Kruti Dev converter, XPS converter, Item Import
│   │   │   ├── FinancialYear/        # FY management
│   │   │   ├── CompanyManagement/
│   │   │   ├── Backup/
│   │   │   ├── Settings/
│   │   │   └── Auth/
│   │   ├── components/               # Shared UI components
│   │   │   ├── Layout/               # Sidebar, header, navigation
│   │   │   ├── CommandPalette/       # Cmd+K search
│   │   │   ├── TabBar/               # Browser-like tab system
│   │   │   ├── ChallanPrintLayout/   # Challan print/PDF generation
│   │   │   ├── MetricCard/           # Dashboard KPI cards
│   │   │   ├── ItemHistoryTimeline/  # Item transaction timeline
│   │   │   ├── VirtualizedTable/     # High-performance virtualized table
│   │   │   ├── EmptyState/           # Empty state illustrations
│   │   │   ├── LoadingSkeleton/      # Loading placeholders
│   │   │   ├── PageHeader/           # Page header with actions
│   │   │   ├── PageTransition/       # Page transition animations
│   │   │   ├── DatePickerField/      # Date picker component
│   │   │   ├── ImportExportButtons/  # Import/Export action buttons
│   │   │   └── ErrorBoundary/        # Error boundary component
│   │   ├── context/                  # React contexts
│   │   │   ├── CompanyContext        #   Selected company + FY
│   │   │   ├── TabContext            #   Tab management
│   │   │   └── ThemeContext          #   Dark/light mode
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── theme/                    # MUI theme (light/dark)
│   │   ├── styles/                   # Global styles
│   │   └── utils/                    # Date utilities, helpers
│   │       ├── dateUtils.ts
│   │       ├── numberUtils.ts
│   │       ├── unitUtils.ts
│   │       └── importExport.ts
│   └── shared/                       # Shared types and Zod schemas
│       ├── types.ts                  # TypeScript interfaces + enums
│       └── zod-schemas/              # Zod validation schemas
├── prisma/
│   ├── schema.prisma                 # Database schema (25+ models)
│   └── dev.db                        # SQLite database file
├── scripts/                          # Build/utility scripts
├── tests/                            # Test files
├── public/                           # Static assets
├── package.json
├── vite.config.ts
├── tsconfig.json
├── electron-builder.config.ts
├── business_logic.md                 # Detailed business logic documentation
└── README.md
```

---

## 9. Key Features

1. **Multi-Company & Multi-FY** — एक ही app में कई companies और financial years manage कर सकते हैं
2. **Tab System** — Browser-like tabs, एक साथ कई pages खुले रह सकते हैं
3. **Command Palette** — Cmd+K से कोई भी page तुरंत खोजें
4. **Dark/Light Mode** — Theme toggle
5. **Automatic Backups** — 15-minute, daily, weekly, monthly, yearly scheduled backups
6. **Auto-Update** — Built-in Electron auto-update via `electron-updater`
7. **Backdated Entries** — पुरानी date की entry हो सकती है, balances automatically recalculate होते हैं
8. **Room-level Tracking** — धर्मशाला के हर कमरे में क्या-क्या है, वो track होता है
9. **Asset Installation Tracking** — Items कहाँ installed हैं, वो track होता है
10. **Damaged Stock Separation** — GOOD और DAMAGED stock अलग-अलग track होता है
11. **25+ Reports** — Excel export के साथ
12. **Audit Trail** — हर important action का log
13. **Hindi Support** — Hindi item names, unit names, department names full support
14. **Challan Lifecycle** — Draft → Posted → Cancelled with full stock reversal
15. **Running Balance Ledger** — No need to recalculate from scratch; latest transaction holds the balance
16. **Zod Validation** — Schema-based input validation across the app
17. **Text Conversion** — Kruti Dev/DevLys to Unicode Hindi conversion
18. **XPS/PDF Parsing** — Extract text from XPS and PDF files for item import
19. **Bulk Item Import** — Import items from XPS or CSV files with preview
20. **Virtualized Tables** — High-performance tables for large datasets
21. **Background Processing** — Heavy tasks run in worker threads
22. **Store-Department-Location Linking** — Stores can have Room locations underneath them (not just Dharamshalas)
23. **Hierarchical Stock Calculation** — Balance at location = Total received - Sent to child locations
24. **Cumulative Balance Maps** — Cancel/post flows use cumulative balance tracking to prevent stale reads
25. **Server-side Challan Numbers** — Race condition-free challan number generation
26. **Downstream Dependency Checks** — Cannot cancel challans if stock has moved further
27. **Permissions Handling** — Robust parsing of stored permissions (string or array)

---

## 10. Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** 9+
- **Windows** (for building NSIS installer)

### Installation & Development

```bash
# Clone the repository
git clone <repository-url>
cd inventory-app

# Install dependencies
npm install

# Generate Prisma client (required for SQLite)
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed initial data
npx tsx prisma/seed.ts

# Run in development mode (starts Vite + Electron)
npm run dev
```

### Build for Production

```bash
# Build Windows installer
npm run build:win
```

### Useful Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development mode |
| `npm run build:win` | Build Windows NSIS installer |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio (DB browser) |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run linting |

---

## 12. Recent Changes (v1.5.0)

### Report Center Improvements
- **Search/Category/Item filters** — Now work in real-time without clicking Apply button
- **Room Facilities Checklist** — Department filter fixed (dept→location mapping); Location dropdown filtered by department
- **Dharamshala Distribution** — Store & Dharamshala both work; OPENING_STOCK included
- **Item History** — Added running balance computation, source/destination resolution, fixed double-entry display
- **Current Stock** — Department filter hidden (not needed)

### Issue Challan
- **Location column** — Shows for ALL departments (not just Dharamshala); dept without rooms shows its own location

### Department ↔ Location Auto-Sync
- **Create/Update/Delete** — Department changes auto-sync corresponding Location entry
- **Department type** — Added as valid Location type for parent hierarchy
- **Cascade delete** — Department delete cascades to child rooms then parent location

### Security & Session
- **Logout cleanup** — Tabs, React Query cache, and user-scoped localStorage cleared on logout
- **No tab leakage** — New user sees clean Dashboard only

### Performance
- **Auto-reload** — `refetchOnMount: true`, `refetchOnWindowFocus: true` for all pages
- **Report state persistence** — Selected report and filters saved to localStorage across tab switches
- **QueryClient** — Optimized staleTime (2min) for balance between freshness and performance

### Bug Fixes
- **Location delete safety** — Graceful handling for already-deleted records (P2025 error)
- **Icon file** — Fixed corrupted ICO file (was UTF-16 text, now proper binary)
- **Department Location entries** — All existing departments now have matching Location entries

---

## 11. Recent Changes (v1.4.0)

### Bug Fixes
- **Current Stock report** — Fixed blank display due to 200-row limit; now paginated with First/Prev/Next/Last/All controls
- **Category filter** — When category name matches department name (e.g. "बिजली स्टोर"), filter maps to departmentId instead of categoryId
- **Drilldown dialog** — Stock detail popup now respects active category/department filters
- **Challan date handling** — All challan save/create handlers now convert date strings to Date objects via `convertPayloadDates()`
- **Duplicate Financial Year** — Removed duplicate FY 9 "2025-26" (was duplicate of FY 8 "2025-2026")
- **Duplicate key warning** — Fixed duplicate `departmentName` key in reportConfigs.ts
- **Bijli data in FY 8** — 147 bijli items with stock data copied to FY 8 (665 items total)
- **Mixed-type DATETIME bug** — Normalized all DATETIME columns to epoch ms integers

### Data Imports
- **imartStore_stock.csv** — 518 items, 715 stock transactions imported
- **bijlistore_stock.csv** — 262 items, 294 stock records imported
- **Hindi name repair** — Fixed 8 garbled richText item names from xlsx import

### Architecture
- **Report pagination** — Generic renderer now supports configurable page sizes (50 rows/page)
- **Error logging** — `db:query` IPC handler now logs errors with full context
- **Schema** — 25+ Prisma models covering the full challan lifecycle

---

## 11. Database Schema Diagram (Simplified)

```
Company ──┬── FinancialYear
          ├── Department ──┐
          ├── ItemCategory ─── Item ──┬── Unit
          ├── Vendor                  ├── StockTransaction (LEDGER)
          ├── Location (self-ref)     ├── ReceiptChallanItem ── ReceiptChallan
          │   ├── parentId            ├── IssueChallanItem ─── IssueChallan
          │   └── children            ├── TransferChallanItem ─ TransferChallan
          ├── User                    ├── VendorReturnChallanItem ── VendorReturnChallan
          │   └── LoginHistory        ├── DamageEntry
          └── AuditLog                ├── AssetInstallation
                                      ├── OpeningStock
                                      └── StockAdjustment
```

---

*यह documentation codebase को directly analyze करके बनाया गया है। अगर कोई section update करना हो या और details चाहिए, तो बताइए।*

*Last updated: August 2026*
