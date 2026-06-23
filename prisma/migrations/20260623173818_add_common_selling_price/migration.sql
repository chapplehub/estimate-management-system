-- 共通販売単価集約（pricing サブドメイン・ADR-0066 / 0067）
--
-- 適用期間は daterange 1列で表現し、同一商品内の期間重複を GiST 排他制約で物理禁止する。
-- 番兵・NULL を使わず無期限を上端 unbounded で表す（ADR-0067 のトリレンマ判断）。

-- 区間重複禁止の EXCLUDE で product_id のスカラー等値 (WITH =) を GiST に載せるため必要。
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable: 親（集約ルート・楽観ロック version 保持）
CREATE TABLE "common_selling_prices" (
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "common_selling_prices_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable: 子（適用期間行）。applicable_period は daterange（Prisma Unsupported）。
CREATE TABLE "common_selling_price_periods" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "applicable_period" daterange NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "common_selling_price_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "common_selling_price_periods_product_id_idx" ON "common_selling_price_periods"("product_id");

-- AddForeignKey: 親 → products（ProductId 流用）
ALTER TABLE "common_selling_prices" ADD CONSTRAINT "common_selling_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 子 → 親
ALTER TABLE "common_selling_price_periods" ADD CONSTRAINT "common_selling_price_periods_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "common_selling_prices"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: 売単価は非負（ドメイン SellingUnitPrice の不変条件を DB でも担保）
ALTER TABLE "common_selling_price_periods" ADD CONSTRAINT "common_selling_price_periods_selling_price_check" CHECK ("selling_price" >= 0);

-- CheckConstraint: 適用期間は半開区間 [開始, 終了) で下端は必ず有界・空区間禁止
-- （ApplicablePeriod VO の不変条件を DB でも担保。下端 unbounded や empty range の混入を防ぐ）
ALTER TABLE "common_selling_price_periods" ADD CONSTRAINT "common_selling_price_periods_period_bounds_check"
    CHECK (
        NOT isempty("applicable_period")
        AND lower_inc("applicable_period")
        AND NOT upper_inc("applicable_period")
        AND lower("applicable_period") IS NOT NULL
    );

-- ExcludeConstraint: 同一商品内で適用期間の重複を物理禁止（ADR-0067 の最後の砦・集約内 overlaps と二重防御）
ALTER TABLE "common_selling_price_periods" ADD CONSTRAINT "common_selling_price_periods_no_overlap"
    EXCLUDE USING gist ("product_id" WITH =, "applicable_period" WITH &&);
