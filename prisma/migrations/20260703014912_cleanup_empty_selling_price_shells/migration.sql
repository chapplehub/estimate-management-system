-- 既存の「空集約シェル」を一掃する（#512・B案 案E1）
--
-- 未来開始行だけを持つ販売単価/原価集約から最後の1行を deletePeriod で削除すると、子（期間行）が
-- 0件でも親行（集約ルート）が残り「空集約シェル」になる。この状態は edit query が version:非null を
-- 返す一方 UI は0件を「未設定＝新規登録」と見なし expectedVersion を送らず、再登録が ValidationError で
-- 詰まっていた（#512）。B案（最終期間の削除で親行ごと削除）を選んだ以上、既に生成済みのシェルは
-- 定義上ゴミであり掃除するのが完全な修正。
--
-- 不変条件「親行の存在 ⟺ 期間行≥1件」を回復するため、期間行を1件も持たない親行を3テーブルから削除する。
-- 親を消せば FK onDelete: Cascade で子は連鎖するが、対象は「子が0件の親」なので実質は親のみの削除。
-- NOT EXISTS の相関副問い合わせで冪等（再実行しても追加削除は起きない）。将来シェルが現れたら不変条件
-- 違反として既存 ValidationError で loud failure させ気づけるようにする（防御的寛容化＝案E2 は不採用）。
--
-- 対象は delete-period 経路が実在し空シェルに到達しうる3集約（ADR-0066 で同型）。納品先別販売単価は
-- delete-period が無く到達不能のため対象外（前方ポリシー: 将来 delete-period を載せる際に同時対応）。

DELETE FROM "common_selling_prices" p
 WHERE NOT EXISTS (
   SELECT 1 FROM "common_selling_price_periods" c WHERE c."product_id" = p."product_id"
 );

DELETE FROM "cost_prices" p
 WHERE NOT EXISTS (
   SELECT 1 FROM "cost_price_periods" c WHERE c."product_id" = p."product_id"
 );

DELETE FROM "customer_selling_prices" p
 WHERE NOT EXISTS (
   SELECT 1 FROM "customer_selling_price_periods" c
    WHERE c."customer_id" = p."customer_id" AND c."product_id" = p."product_id"
 );
