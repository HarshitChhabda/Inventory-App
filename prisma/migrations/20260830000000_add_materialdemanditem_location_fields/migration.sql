-- AlterTable: Add locationId and locationName to MaterialDemandItem
ALTER TABLE "MaterialDemandItem" ADD COLUMN "locationId" INTEGER;
ALTER TABLE "MaterialDemandItem" ADD COLUMN "locationName" TEXT;

-- CreateIndex for locationId (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "MaterialDemandItem_locationId_idx" ON "MaterialDemandItem"("locationId");
