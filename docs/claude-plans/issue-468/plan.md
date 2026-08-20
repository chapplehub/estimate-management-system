# Issue #468: 原価移設 B — 集約剥離＋原価UI撤去＋列削除（カットオーバー・純減算）— 実装計画

## Context

原価移設の expand/contract のうち **contract 相**。加法スライス #465（develop マージ済 `868b8c5`）で新原価集約 `pricing/CostPrice`＋スキーマ＋バックフィルが揃った。#468 は Product から原価を**完全に剥がす純減算**スライス: 原価UIの撤去・読み取り経路の除去・Product 集約からの `CostPrice` 除去・`products.cost_price` 列削除・旧VO削除。

**設計変更（要 deviations 記録）**: 当初 ADR-20260627-a5c の Issue B は「Product 画面の原価欄を新集約へ付け替え」だったが、純粋契約（撤去）に変更し、編集の再配線は後続の専用原価管理画面 **#470** へ送った。理由: 時間有効性を持つ集約を単一値フォームへ写すインピーダンスミスマッチを #468 に持ち込まないため。pre-production ゆえ #468 完了〜#470 配線間の編集・閲覧不能を受容。ADR は本ブランチで改訂済（コミット `27e695a`）。

**新集約を読む新規配線は #468 には一切無い**（純減算）。

## 重要な温存ポイント（消さないもの）

- seed の curated `PRODUCTS` 配列の `costPrice` フィールド（seed.ts:760-915 / seed-e2e.ts:334-398）→ #465 の原価集約導出のソース。**温存**。
- seed の新原価集約導出ブロック（seed.ts:1314-1331・`cost_price_periods` INSERT / seed-e2e.ts:705-722）と `prisma.costPrice.deleteMany()`（seed.ts:1177 / seed-e2e.ts:582）→ **温存**。
- `pricing/` 配下の新 `CostPrice` 集約・`CostUnitPrice` VO・`cost_price_periods` テーブル一式 → **温存**（同名 `CostPrice` だが別物）。

## 実装ステップ（コミット単位）

### Step 1: Product 集約から原価(CostPrice)を剥離（domain＋application＋infra-write）
- `product/domain/entities/Product.ts`: `CostPrice` import・`_costPrice` フィールド・`create()` の `costPrice` 引数＆SET強制0ロジック・`reconstruct()` の `costPrice` 引数・`changeCostPrice()`・`costPrice` getter・クラス doc の「原価は常に0」記述を除去。
- `product/application/commands/CreateProductCommand.ts` / `UpdateProductCommand.ts`: `CostPrice` import・`CreateProductInput`/`UpdateProductInput` の `costPrice`・VO化＆`Product.create`/`changeCostPrice` 呼び出しを除去。
- `product/infrastructure/mappers/ProductMapper.ts`: `CostPrice` import・`toDomain` の cost_price→VO 変換・`toPrismaCreate`/`toPrismaUpdate` の `costPrice` 出力を除去。
- `product/domain/values/CostPrice.ts`: **ファイル削除**。
- 同時更新テスト: `Product.test.ts`・`CreateProductCommand.test.ts`・`UpdateProductCommand.test.ts` の costPrice / SET強制0 アサーションを除去。
- コミット: `refactor: Product 集約から原価(CostPrice)を剥離`

### Step 2: 商品の読み取り経路から原価を除去
- `product/application/queries/dto/ProductDTO.ts:13`: `costPrice` 除去。
- `product/infrastructure/queries/PrismaProductQueryService.ts:132`: `costPrice` SELECT/返却を除去（列削除前に必須）。
- `app/(features)/products/[productCd]/page.tsx:96-100`: 「原価」表示ブロックを除去。
- 同時更新テスト: `SearchProductsQuery.test.ts`・`GetProductByIdQuery.test.ts` の costPrice 期待値を除去。
- estimate 側フィクスチャ: `estimate/application/shared/__tests__/assertSetComponentsValid.test.ts:28`・`app/(features)/estimates/_shared/setComponentExpansion.test.ts:15` の `costPrice: null` 行を除去（ProductDTO 形フィクスチャ）。
- コミット: `refactor: 商品の読み取り経路から原価を除去（DTO/QueryService/詳細画面）`

### Step 3: 商品作成/編集画面から原価UIを撤去
- `app/(features)/products/_shared/schema.ts:53-66`: `costPrice` バリデーション除去。
- `app/(features)/products/new/ProductCreateForm.tsx:113-131` / `[productCd]/edit/ProductEditForm.tsx:135-152`: 原価入力フィールド除去（edit の初期値変換も）。
- `app/(features)/products/new/actions.ts` / `[productCd]/edit/actions.ts`: formData からの `costPrice` 抽出・コマンドへの受け渡しを除去。
- コミット: `refactor: 商品作成/編集画面から原価UIを撤去`

### Step 4: products.cost_price 列削除（schema＋migration＋seed）
- `prisma/schema.prisma`: Product モデルの `costPrice`（line 371）除去。line 398 / 504 の「Issue A で温存・列削除は B」コメントを実態に合わせ更新。
- seed の**列書き込みのみ**除去: `seed.ts:1261`（`costPrice: product.costPrice`）・`seed-e2e.ts:695`。curated 配列フィールドと集約導出は温存。
- migration: `prisma/migrations/<ts>_drop_products_cost_price/migration.sql` を**手書き**（#465 の手書き SQL 運用に同じ）。内容: `ALTER TABLE "products" DROP COLUMN "cost_price";`。
- `pnpm db:generate`（Prisma Client 再生成）。
- **migration 適用は `!` 委譲**（dev DB は全 worktree 共有・migrate は deny）。
- コミット: `feat: products.cost_price 列を削除`

### Step 5: 旧VOの最終確認とクリーンアップ
- `grep -rn "values/CostPrice" src`（pricing 除く）が 0 件、`product.costPrice` 残存参照が無いことを確認。残骸があれば修正コミット。

### Step 6: deviations.md
- `docs/claude-plans/issue-468/deviations.md` に {計画=画面付け替え}／{実装=純粋契約・撤去}／{理由=インピーダンスミスマッチ回避・編集は#470へ・pre-production} を記録。
- コミット: `docs: #468 の計画逸脱（付け替え→純粋契約）を記録`

## Verification

- `pnpm db:generate` → 型エラー無し。
- `pnpm build` / `pnpm lint` / `pnpm test`（ユニット）が green。
- migration を `!` で適用後、`pnpm e2e`（テストデータ再シード込み）。seed が `products` に cost_price 無しで通り、`cost_price_periods` は非SET＆非null商品ぶん生成されることを確認。
- DB で `\d products` に cost_price 列が無いこと、`cost_price_periods` が温存されていることを確認。

## マージ条件

- #465 が develop マージ済（充足）。#468 は #465 の後にマージ。

## 注意

- pricing 側 `CostPrice`（集約ルート）と product 側 `CostPrice`（旧VO・削除対象）は同名。import パス（`product/domain/values/CostPrice` のみ削除、`pricing/...` は不可侵）で必ず判別する。
- worktree 絶対パスにブランチセグメントを含めること（main 側誤着弾防止）。serena 編集ツールは使わない。
