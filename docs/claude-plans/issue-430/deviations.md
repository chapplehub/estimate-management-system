# Issue #430 実装の計画からの逸脱記録

## 逸脱1: フィクスチャ商品へのマスタ単価付与（Step 3）

### 元の計画内容
Step 3 の対象ファイルは `CreateEstimateCommand.ts` / `new/schema.ts` / `new/actions.ts` / コマンドファクトリの4点。C1 の作成経路に価格解決を接続することのみを想定していた。

### 実際の実装内容
`CreateEstimateCommand` のコンストラクタに必須の第3引数（価格決定 resolver）を追加し、`CreateEstimateItemInput` から `unitPrice` を削除した結果、`CreateEstimateCommand` を「見積の種」として使う兄弟コマンドテスト8ファイル（Activate / Deactivate / UpdateVariationMemos / ReviseForCustomer / UpdateVariation / UpdateEstimate / AddVariation / AdjustRevised）が一斉に破損した。加えて、単価がマスタ解決になったことで、種の見積作成にも「対象商品に有効な販売単価が存在する」前提が必要になった。

対応として、共有フィクスチャ `ensureEstimateFixtures` の商品（`ids.productId`）に正準の共通販売単価（1000円）を並列安全な「不在時のみ挿入」で付与した（`ensureCommonSellingPrice`）。これにより種テストは「resolver 注入＋種 `unitPrice` 除去」の最小変更で通るようにした。8ファイルの機械的修正はスクリプトで一括適用した。

### 逸脱の理由
`CreateEstimateCommand` が多数の兄弟テストの種として共有されていたため、破壊的変更（コンストラクタ・入力型）の波及が計画の想定より広かった。フィクスチャに正準単価を持たせるのが最小churnで、正準値1000が AdjustRevised の既存アサーション（作成時単価=1000）と一致し金額アサーションの書き換えを不要にできた。ユーザー承認済み（2026-07-09 の対話）。

## 逸脱2: 過去日（2019年）を使う税率不一致テストの専用商品化（Step 3）

### 元の計画内容
記載なし（Step 3 の想定外）。

### 実際の実装内容
`AdjustRevisedVariationCommand` の税率不一致テストは消費税8%→10%境界を跨ぐため `estimateDate: 2019-09-01` を使う。フィクスチャ単価は「今日始まり・無期限」で2019を被覆しないため解決不能になった。このテスト専用に、2019以降を無期限で被覆する履歴単価付き商品（`ensurePricedProduct({ code: "ADJ430H", start: "2019-01-01", today: "2019-01-01" })`）を用意し、当該テストの明細商品をこれに差し替えた。参照日を2019に指定して `addPeriod` の過去不変制約を回避している（テスト支援用途）。

### 逸脱の理由
価格決定は「見積年月日で有効な販売単価」を引くため、過去日の見積は過去日を被覆する単価が必要。フィクスチャ単価を広域期間にする案は、テストDBに残る旧期間の掃除が必要で扱いにくいため、影響を当該テストに閉じる専用商品方式を採用した。ユーザー承認済み（2026-07-09 の対話）。

## 逸脱3: lineSchema の unitPrice 除去を Step 7 へ繰り延べ（Step 4）

### 元の計画内容
Step 4 の Green は「`lineSchema` から `unitPrice` 除去・`itemId`（optional）追加、`variationContentInput` の変換をヘルパー解決に置換」。zod の `lineSchema`（`variationSchema.ts`）から `unitPrice` を外すことを含んでいた。

### 実際の実装内容
Step 4 では次に留めた:
- `variationContentInput.ts`（コマンド入力型 `EstimateItemInput`）から `unitPrice` を除去し `itemId?` を追加、`toVariationContentDescriptor` を priceMap 受け取りへ変更。
- `AddVariationCommand`（C3）/`UpdateVariationCommand`（C4）へ価格決定を注入。C4 は現行明細から `existingLines` を組み立て、`itemId` 一致かつ `productId` 不変の行の永続単価を保全（ADR-20260709-5ea）。
- `variationContentMapping.ts` はコマンドへ `unitPrice` を転送せず、`itemId` を透過。
- `lineSchema`（`variationSchema.ts`）には `itemId`（optional）を **追加のみ**行い、`unitPrice` の **除去は行わなかった**。

`lineSchema` からの `unitPrice` 除去と、それに連鎖する FE 表示・作業行コード（`variationLines.ts` の `WorkingLine`/`toNodePayload`、`previewAmounts` 等）の改修は Step 7 に繰り延べた。

### 逸脱の理由
`lineSchema` の `unitPrice` は zod 推論型 `VariationLineInput`/`VariationNodeInput` を介して FE 表示層（`variationLines.ts` の作業行モデル・ライブプレビュー＝Step 7 対象）に深く結合している。Step 4 で外すと Step 7 相当の広範な FE 改修を巻き込み、スコープが肥大化する（メモリ「大きすぎるスコープの実装は分割する」に反する）。Step 4 はバックエンドのコマンド挙動（C3/C4 サーバー解決・C4 既存行保全）に集中し、FE zod の `unitPrice` 除去は表示層改修とまとめて Step 7 で行う。中間状態として FE は `unitPrice` を送出し続けるが、zod は保持しつつ mapping がコマンドへ渡さないため、単価はサーバーがマスタから権威解決する（データの正しさは成立。計画「許容する中間状態」と整合）。
