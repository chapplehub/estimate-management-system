-- 納品先別販売単価集約（pricing サブドメイン・ADR-0066 / 0067 / 20260624-8tg）
--
-- 共通・得意先別販売単価と同型だが、宛先が納品先である独立集約。集約ルートの identity は複合自然キー
-- (delivery_location_id, product_id)。適用期間は daterange 1列で表現し、同一の納品先・商品内の期間
-- 重複を GiST 排他制約で物理禁止する。番兵・NULL を使わず無期限を上端 unbounded で表す（ADR-0067）。
-- 共通販売単価（common_selling_prices）への FK・存在依存は張らない（同じ ProductId を ID 参照で
-- 結ぶ別集約）。

-- 区間重複禁止の EXCLUDE で delivery_location_id / product_id のスカラー等値 (WITH =) を GiST に載せるため必要。
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable: 親（集約ルート・複合PK・楽観ロック version 保持）
CREATE TABLE "delivery_location_selling_prices" (
    "delivery_location_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_location_selling_prices_pkey" PRIMARY KEY ("delivery_location_id", "product_id")
);

-- CreateTable: 子（適用期間行）。applicable_period は daterange（Prisma Unsupported）。
CREATE TABLE "delivery_location_selling_price_periods" (
    "id" UUID NOT NULL,
    "delivery_location_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "applicable_period" daterange NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_location_selling_price_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_location_selling_price_periods_dl_id_product_id_idx" ON "delivery_location_selling_price_periods"("delivery_location_id", "product_id");

-- AddForeignKey: 親 → delivery_locations（DeliveryLocationId 流用）
ALTER TABLE "delivery_location_selling_prices" ADD CONSTRAINT "delivery_location_selling_prices_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "delivery_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 親 → products（ProductId 流用）
ALTER TABLE "delivery_location_selling_prices" ADD CONSTRAINT "delivery_location_selling_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: 子 → 親（複合キー）
ALTER TABLE "delivery_location_selling_price_periods" ADD CONSTRAINT "delivery_location_selling_price_periods_dl_id_product_id_fkey" FOREIGN KEY ("delivery_location_id", "product_id") REFERENCES "delivery_location_selling_prices"("delivery_location_id", "product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: 売単価は非負（ドメイン SellingUnitPrice の不変条件を DB でも担保）
ALTER TABLE "delivery_location_selling_price_periods" ADD CONSTRAINT "delivery_location_selling_price_periods_selling_price_check" CHECK ("selling_price" >= 0);

-- CheckConstraint: 適用期間は半開区間 [開始, 終了) で下端は必ず有界・空区間禁止
-- （ApplicablePeriod VO の不変条件を DB でも担保。下端 unbounded や empty range の混入を防ぐ）
ALTER TABLE "delivery_location_selling_price_periods" ADD CONSTRAINT "delivery_location_selling_price_periods_period_bounds_check"
    CHECK (
        NOT isempty("applicable_period")
        AND lower_inc("applicable_period")
        AND NOT upper_inc("applicable_period")
        AND lower("applicable_period") IS NOT NULL
    );

-- ExcludeConstraint: 同一の納品先・商品内で適用期間の重複を物理禁止（ADR-0067 の最後の砦・集約内 overlaps と二重防御）
ALTER TABLE "delivery_location_selling_price_periods" ADD CONSTRAINT "delivery_location_selling_price_periods_no_overlap"
    EXCLUDE USING gist ("delivery_location_id" WITH =, "product_id" WITH =, "applicable_period" WITH &&);
