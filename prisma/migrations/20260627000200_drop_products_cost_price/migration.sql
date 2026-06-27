-- 原価移設 B（カットオーバー / ADR-20260627-a5c）。
-- 加法スライス #465 で原価は cost_prices / cost_price_periods 集約へバックフィル済。
-- 旧フォールバック列 products.cost_price を削除し、原価の正本を原価集約へ一本化する。
ALTER TABLE "products" DROP COLUMN "cost_price";
