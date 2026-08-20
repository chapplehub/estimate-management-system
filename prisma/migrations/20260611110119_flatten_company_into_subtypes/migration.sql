-- ADR-0043: 取引先の CTI（companies 基底テーブル継承）を廃し、サブタイプ平坦化する。
--
-- 既存データ（customers 16 / delivery_locations 37 / companies 53 行）を保全するため、
-- Prisma が生成する“データ消失型”DDL を expand → backfill → contract に組み替える。
--   ① Expand : 共通列を追加（NOT NULL の code/name は一旦 nullable / is_active は default 付き）
--   ② Backfill: companies から各サブタイプへ値を移送（company_id を参照キーに使う）
--   ③ Contract: NOT NULL 化 → 旧 FK・unique・company_id 列 → companies / CompanyType を drop
-- company_id は backfill の参照キーなので、移送が終わる③まで残す。

-- ===== ① Expand: customers に共通列を追加（code/name は後で NOT NULL 化） =====
ALTER TABLE "customers"
ADD COLUMN     "code" VARCHAR(20),
ADD COLUMN     "name" VARCHAR(100),
ADD COLUMN     "postal_code" VARCHAR(7),
ADD COLUMN     "prefecture" VARCHAR(4),
ADD COLUMN     "address" VARCHAR(200),
ADD COLUMN     "phone_number" VARCHAR(11),
ADD COLUMN     "fax_number" VARCHAR(11),
ADD COLUMN     "contact_person" VARCHAR(100),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- ===== ① Expand: delivery_locations にも共通列を追加 =====
ALTER TABLE "delivery_locations"
ADD COLUMN     "code" VARCHAR(20),
ADD COLUMN     "name" VARCHAR(100),
ADD COLUMN     "postal_code" VARCHAR(7),
ADD COLUMN     "prefecture" VARCHAR(4),
ADD COLUMN     "address" VARCHAR(200),
ADD COLUMN     "phone_number" VARCHAR(11),
ADD COLUMN     "fax_number" VARCHAR(11),
ADD COLUMN     "contact_person" VARCHAR(100),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- ===== ② Backfill: companies から customers へ値を移送 =====
UPDATE "customers" AS cu
SET "code" = co."code",
    "name" = co."name",
    "postal_code" = co."postal_code",
    "prefecture" = co."prefecture",
    "address" = co."address",
    "phone_number" = co."phone_number",
    "fax_number" = co."fax_number",
    "contact_person" = co."contact_person",
    "is_active" = co."is_active"
FROM "companies" AS co
WHERE cu."company_id" = co."id";

-- ===== ② Backfill: companies から delivery_locations へ値を移送 =====
UPDATE "delivery_locations" AS dl
SET "code" = co."code",
    "name" = co."name",
    "postal_code" = co."postal_code",
    "prefecture" = co."prefecture",
    "address" = co."address",
    "phone_number" = co."phone_number",
    "fax_number" = co."fax_number",
    "contact_person" = co."contact_person",
    "is_active" = co."is_active"
FROM "companies" AS co
WHERE dl."company_id" = co."id";

-- ===== ③ Contract: backfill 済みなので code/name を NOT NULL 化 =====
ALTER TABLE "customers"
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "delivery_locations"
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- ===== ③ Contract: 旧 company_id FK・unique・列を drop =====
ALTER TABLE "customers" DROP CONSTRAINT "customers_company_id_fkey";
ALTER TABLE "delivery_locations" DROP CONSTRAINT "delivery_locations_company_id_fkey";

DROP INDEX "customers_company_id_key";
DROP INDEX "delivery_locations_company_id_key";

ALTER TABLE "customers" DROP COLUMN "company_id";
ALTER TABLE "delivery_locations" DROP COLUMN "company_id";

-- ===== ③ Contract: companies テーブルと CompanyType enum を削除 =====
DROP TABLE "companies";
DROP TYPE "CompanyType";

-- ===== 新インデックス・一意制約（型内一意。Prisma 命名に一致させる） =====
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");
CREATE INDEX "customers_is_active_idx" ON "customers"("is_active");
CREATE UNIQUE INDEX "delivery_locations_code_key" ON "delivery_locations"("code");
CREATE INDEX "delivery_locations_is_active_idx" ON "delivery_locations"("is_active");
