-- products.cost_price を原価集約へバックフィル移行（ADR-20260627-a5c）
--
-- 加法スライス（expand）の移行相。既存 products.cost_price を新原価集約（cost_prices ＋
-- cost_price_periods）へ写す。products.cost_price 列は温存し、Product 集約は無改変（列削除は Issue B）。
--
-- 写像規則（カテゴリ分岐・遅延疎生成）:
--   - 複合品（category = 'SET'）           → 行を作らない（強制 0 は単一値原価のプレースホルダ。粗利は構成品合算で後続）
--   - 非複合品 ＆ cost_price IS NULL        → 行を作らない（期間なし＝原価未設定）
--   - 非複合品 ＆ cost_price 非NULL         → [2026-04-01, ) を1本作成（本物の 0 も保存）
--
-- 起点 2026-04-01（当年度期首・ADR-0024）は暦日定数で直書きする。now() の非決定性を避け再現可能にする。
--
-- サロゲート id は UUIDv7。EntityId VO（CostPricePeriodId 基底）が version ニブルまで正規表現で
-- UUIDv7 を強制するため、gen_random_uuid()（v4）で投入するとリポジトリのロード時に
-- 「不正なUUIDv7形式です」で弾かれる（seed の generateId() と生成系を揃える）。PG16 にネイティブ
-- uuidv7() が無いため、移行セッション内に一時関数を定義して v7 を生成し、セッション終了で自動破棄する。
CREATE OR REPLACE FUNCTION pg_temp.gen_uuid_v7() RETURNS uuid AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6),
        52, 1),
      53, 1), 'hex')::uuid;
$$ LANGUAGE sql VOLATILE;

-- 親（集約ルート・version=1）。非複合品 ＆ 非NULL のみ生成（遅延・疎）。
INSERT INTO "cost_prices" ("product_id", "version", "updated_at")
SELECT "id", 1, CURRENT_TIMESTAMP
FROM "products"
WHERE "category" <> 'SET'
  AND "cost_price" IS NOT NULL;

-- 期間行（開放端 [2026-04-01, )）。親と同一の WHERE で1本ずつ。id は UUIDv7（pg_temp.gen_uuid_v7）。
INSERT INTO "cost_price_periods" ("id", "product_id", "cost_price", "applicable_period", "updated_at")
SELECT pg_temp.gen_uuid_v7(), "id", "cost_price", daterange('2026-04-01'::date, NULL, '[)'), CURRENT_TIMESTAMP
FROM "products"
WHERE "category" <> 'SET'
  AND "cost_price" IS NOT NULL;
