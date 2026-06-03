/*
  Warnings:

  - Made the column `customer_memo` on table `estimate_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `internal_memo` on table `estimate_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `customer_memo` on table `estimate_variations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `internal_memo` on table `estimate_variations` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill: 既存 NULL を空文字へ正規化してから NOT NULL 化する（冪等・安全策）。
UPDATE "estimate_items" SET "customer_memo" = '' WHERE "customer_memo" IS NULL;
UPDATE "estimate_items" SET "internal_memo" = '' WHERE "internal_memo" IS NULL;
UPDATE "estimate_variations" SET "customer_memo" = '' WHERE "customer_memo" IS NULL;
UPDATE "estimate_variations" SET "internal_memo" = '' WHERE "internal_memo" IS NULL;

-- AlterTable
ALTER TABLE "estimate_items" ALTER COLUMN "customer_memo" SET NOT NULL,
ALTER COLUMN "customer_memo" SET DEFAULT '',
ALTER COLUMN "internal_memo" SET NOT NULL,
ALTER COLUMN "internal_memo" SET DEFAULT '';

-- AlterTable
ALTER TABLE "estimate_variations" ALTER COLUMN "customer_memo" SET NOT NULL,
ALTER COLUMN "customer_memo" SET DEFAULT '',
ALTER COLUMN "internal_memo" SET NOT NULL,
ALTER COLUMN "internal_memo" SET DEFAULT '';
