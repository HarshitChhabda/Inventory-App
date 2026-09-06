ALTER TABLE "ItemCategory" ADD COLUMN "storeId" INTEGER REFERENCES "Store"("id");

CREATE INDEX IF NOT EXISTS "ItemCategory_storeId_idx" ON "ItemCategory"("storeId");
