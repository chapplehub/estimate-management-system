# Issue #466 実装の計画からの逸脱

## 1. 登録コマンドを「findById→NotFound 弾き」ではなく insert/update 分岐にした

- **元の計画**: Step 3 で4コマンド共通の流れを「findById→NotFound 弾き→ドメイン操作→`update(expectedVersion)`」と記載していた。
- **実際の実装**: `RegisterCommonSellingPricePeriodCommand` のみ、集約の存在チェックで insert/update を分岐させた。未設定商品（集約なし）→ `create`＋`insert`（version 1 始まり、`expectedVersion` 不要）、既存→ `addPeriod`＋`update(expectedVersion)`。編集・適用終了・削除の3コマンドは計画どおり「無ければ `NotFoundEntityError`→ドメイン操作→update」。
- **逸脱の理由**: 設計判断「母集合=全商品で未設定が初期は多数」より、登録は未設定商品への初回登録が正常系であって NotFound ではない。「findById→NotFound 弾き」は既存集約を前提とする編集系3コマンドの流れであり、登録だけは insert/update を吸収する upsert 的コマンドが自然。insert/update の選択をインフラ関心としてコマンドに閉じることで、UI は「登録」一択で未設定・既存を区別せず呼べる。

## 2. 一覧 DTO に `isActive` を追加した（計画に明記なし）

- **元の計画**: Step 4 の DTO は「商品単位・現在有効単価（値/null）・未設定可視化」とのみ記載。
- **実際の実装**: `CommonSellingPriceListItemDTO` に `isActive`（商品マスタの有効フラグ）を追加。
- **逸脱の理由**: 母集合=全商品（無効商品も含む）のため、UI 側で無効商品をバッジ表示・フィルタする判断材料が要る。LEFT JOIN の左表 `products` から取れるコストゼロの列で、母集合方針と整合する。現在有効単価の2値方針自体は変更していない。
