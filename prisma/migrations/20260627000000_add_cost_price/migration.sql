-- 原価集約（pricing サブドメイン・ADR-0066 / 0067 / 20260627-a5c）
--
-- 原価を Product 集約から剥がすための加法スライス（expand）。CommonSellingPrice と完全同型で、
-- 適用期間は daterange 1列で表現し、同一商品内の期間重複を GiST 排他制約で物理禁止する。
-- 番兵・NULL を使わず無期限を上端 unbounded で表す（ADR-0067 のトリレンマ判断）。
-- ※ products.cost_price 列は本マイグレーションでは変更しない（一時併存・列削除は Issue B）。

-- 区間重複禁止の EXCLUDE で product_id のスカラー等値 (WITH =) を GiST に載せるため必要（既存なら冪等）。
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable: 親（集約ルート・楽観ロック version 保持）
CREATE TABLE "cost_prices" (
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cost_prices_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable: 子（適用期間行）。applicable_period は daterange（Prisma Unsupported）。
CREATE TABLE "cost_price_periods" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "applicable_period" daterange NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cost_price_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_price_periods_product_id_idx" ON "cost_price_periods"("product_id");

-- AddForeignKey: 親 → products（ProductId 流用）
ALTER TABLE "cost_prices" ADD CONSTRAINT "cost_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 子 → 親
ALTER TABLE "cost_price_periods" ADD CONSTRAINT "cost_price_periods_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "cost_prices"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: 原価は非負（ドメイン CostUnitPrice の不変条件を DB でも担保）
ALTER TABLE "cost_price_periods" ADD CONSTRAINT "cost_price_periods_cost_price_check" CHECK ("cost_price" >= 0);

-- CheckConstraint: 適用期間は半開区間 [開始, 終了) で下端は必ず有界・空区間禁止
-- （ApplicablePeriod VO の不変条件を DB でも担保。下端 unbounded や empty range の混入を防ぐ）
ALTER TABLE "cost_price_periods" ADD CONSTRAINT "cost_price_periods_period_bounds_check"
    CHECK (
        NOT isempty("applicable_period")
        AND lower_inc("applicable_period")
        AND NOT upper_inc("applicable_period")
        AND lower("applicable_period") IS NOT NULL
    );

-- ExcludeConstraint: 同一商品内で適用期間の重複を物理禁止（ADR-0067 の最後の砦・集約内 overlaps と二重防御）
ALTER TABLE "cost_price_periods" ADD CONSTRAINT "cost_price_periods_no_overlap"
    EXCLUDE USING gist ("product_id" WITH =, "applicable_period" WITH &&);
