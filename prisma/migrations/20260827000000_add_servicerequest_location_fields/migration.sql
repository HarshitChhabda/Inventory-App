-- AlterTable: Add location/department/dharmshala/store text fields to ServiceRequest
ALTER TABLE "ServiceRequest" ADD COLUMN "storeName" TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN "locationName" TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN "departmentName" TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN "dharmshalaName" TEXT;
