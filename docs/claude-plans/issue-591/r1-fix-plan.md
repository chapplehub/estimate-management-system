# issue-591 auto-review-fix ラウンド1 修正計画

`/code-review medium` → judge 評価の結果、**採用①②=0（収束）／採用③cleanup=2**。
本ラウンドは③cleanupの2件（seed 内の DB 往復削減）のみを修正する。①②の方針違反・correctness バグは無し。

## 対象

### ③-1 products.ts:610 — 商品の逐次 create を createMany 化
- **バケツ / severity**: ③ cleanup / Low（efficiency）
- **file:line**: `prisma/seed-dev-data/products.ts:610-622`
- **問題**: `seedProducts` が 48 商品を 1 件ずつ `await prisma.product.create`。48 往復。
- **修正方針**: `for` ループを `prisma.product.createMany({ data: PRODUCTS.map(...) })` に置換。id は `generateId()` を各要素で付与、スカラー列のみ。
- **採用根拠（挙動不変）**: create の戻り値に依存しない（直後に `findMany` で `productsByCode` を再構築）。同ファイルの `SET_COMPONENTS` は既に createMany 済みで前例。id 自前付与・スカラー列のみなのでネスト無し。
- **影響範囲**: `seedProducts` 内に閉じる。公開シグネチャ・戻り値不変。
- **想定テスト**: `pnpm lint` / `pnpm test`（seed は単体テスト対象外だが型・lint で確認）。挙動確認は既存の緑維持。

### ③-2 applications.ts:514 / estimates.ts:151 — findProduct の逐次 findFirst を IN 一括化
- **バケツ / severity**: ③ cleanup / Low（efficiency）
- **file:line**: `prisma/seed-dev-data/applications.ts:514-529`、`prisma/seed-dev-data/estimates.ts:151-177`
- **問題**: 商品コードごとに `findFirst` を逐次発行（applications 3回 / estimates 5回）。同ファイルは納品先・申請者を `IN` 一括取得しているのに商品だけ個別。
- **修正方針**: 必要な商品コードを1回の `findMany({ where: { code: { in: [...] } } })` で取得して Map 化し、`findProduct(code)` を「Map から引き、未存在なら現行と同じメッセージで throw」する同期関数に変える。呼び出し側の `await findProduct(...)` から `await` を外す。
- **採用根拠（挙動不変）**: 成功パスは同一 id を解決。**未存在時に商品コード付きで throw する現挙動を map lookup で維持**（judge の注意事項）。
- **影響範囲**: 各ファイル内 private ヘルパに閉じる。外部シグネチャ不変。
- **想定テスト**: `pnpm lint` / `pnpm test`。

## 却下・残課題（④・修正しない）
- seed-dev.ts:262 固定「高橋 三郎」の表示名衝突（機能的一意性は保持・美観課題・③未達）
- applications.ts:709 申請 createdAt が親見積(now)より前（機能正常・データ realism・③未達）
- createEstimate/定数の二重実装、daterange INSERT 5回コピペ、seedExempt AFTER_REPAIR インライン、seedPriceOverrides 再 findMany（いずれも③採用基準未達）
