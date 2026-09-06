-- AlterTable: Add invoiceDate, invoiceNumber, sourceType columns to GoodsReceipt
ALTER TABLE "GoodsReceipt" ADD COLUMN "invoiceDate" DATETIME;
ALTER TABLE "GoodsReceipt" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN "sourceType" TEXT;
