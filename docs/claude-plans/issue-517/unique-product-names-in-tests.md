# Issue #517: fix: ユニットテストのProductName重複によるunique制約違反（並列実行での非決定的失敗） — 実装計画

## Context

`products.name` は `@unique`（DB上 `products_name_key`）。複数のユニットテストファイルが同一の商品名リテラルをハードコードしており、vitest のファイル並列実行 + 全ワークツリー共有の dev DB という条件下で、`beforeEach`（product 作成）の実行窓が重なると `Unique constraint failed on the fields: (name)` で非決定的にテストが失敗する。根本原因は「code はファイル固有なのに name だけ使い回されている非対称」。

### 調査で確定した実スコープ

Issue の「予備軍」を全数調査した結果（ユーザー確認済み）:

- schema 上、重複名に関係する unique 制約は **`products.name` のみ**。Customer / DeliveryLocation / Department / Employee / Role の name は unique ではなく、`"Bの変更"` の重複（別テーブル間）は衝突不能 → **対象外**
- `"テスト商品"` `"セット商品"` の重複はインメモリのドメイン/スキーマテストまたは `ItemName`（非unique列）であり DB に書き込まない → **対象外**
- products テーブルへ INSERT する全41テストファイルの商品名を機械抽出した結果、**ファイル横断で重複するのは以下の6名×12ファイルのみ**（すべて pricing、各ペアは Common系/Customer系 で同名を共用）:

| 重複名 | ファイル（code） |
|---|---|
| 登録コマンドテスト商品 | RegisterCommon（CSPCMD10）/ RegisterCustomer（CUSPCMD10） |
| 編集コマンドテスト商品 | EditCommon（CSPCMD20）/ EditCustomer（CUSPCMD20） |
| 適用終了コマンドテスト商品 | EndDateCommon（CSPCMD30）/ EndDateCustomer（CUSPCMD30） |
| 単価改定コマンドテスト商品 | ReviseCommon（CSPCMD31）/ ReviseCustomer（CUSPCMD50）※Issue確認済みの実衝突 |
| 削除コマンドテスト商品 | DeleteCommon（CSPCMD40）/ DeleteCustomer（CUSPCMD40） |
| 編集読みモデルテスト商品 | PrismaCommonSellingPriceEditQueryService（CSPEDT01）/ PrismaCostPriceEditQueryService（CPEDT01） |

コマンドテスト10ファイルは `src/server/subdomains/pricing/application/commands/__tests__/`、QueryService テスト2ファイルは `src/server/subdomains/pricing/infrastructure/queries/__tests__/` 配下。

## 設計判断

### 対応スコープ（Issue 未決事項）
- A. 確認済み1件のみ / B. 文字列重複の全解消（約30ファイル） / C. DB衝突が物理的に起こりうる12ファイルのみ
- **採用: C**（ユーザー確認済み）。インメモリテストの同名は実害ゼロで、触ると無用な差分になる。Issue の意図（実衝突リスクの全排除）は C で満たす。

### ユニーク化の方式（Issue 未決事項）
- A. 意味のある接尾辞（"…商品（共通）" / "…商品（得意先）"）
- B. ファイル固有の `TEST_PRODUCT_CODE` 定数を name に埋め込む（テンプレートリテラル）
- **採用: B**（ユーザー確認済み）。例: `` new ProductName(`単価改定コマンドテスト商品${TEST_PRODUCT_CODE}`) `` → `"単価改定コマンドテスト商品CSPCMD31"`。code のファイル固有性に name が構造的に連動し、将来コピペで新ファイルを作る際も code を変えれば name が自動で一意化される（再発の構造的防止）。ProductName は VarChar(100) 制約に対し十分短い。

### cleanup 戦略（Issue 未決事項）
- **既存の code ベース cleanup を維持**（ユーザー確認済み）。name がファイル固有になれば衝突自体が消滅するため追加の掃除戦略は不要。name ベース掃除は並列実行下で他ファイルの正当な行を消す相互破壊になるため不採用（Issue 記載のとおり）。

### ADR 起票
- 不要と考える（テストフィクスチャの命名規約であり、アーキテクチャ判断ではない）。起票要否はユーザー判断。

## ステップ

### Step 1: 計画ファイルの保存
- 対象ファイル: `docs/claude-plans/issue-517/unique-product-names-in-tests.md`（新規）
- 作業内容:
  - 本計画を保存
- コミットメッセージ: `docs: #517 テストProductNameユニーク化の実装計画`

### Step 2: pricing コマンドテスト10ファイルの ProductName をファイル固有化
- 対象ファイル: `src/server/subdomains/pricing/application/commands/__tests__/{Register,Edit,EndDate,Revise,Delete}{Common,Customer}SellingPricePeriodCommand.test.ts`（10ファイル）
- 作業内容:
  - 各ファイルの `new ProductName("○○コマンドテスト商品")` を `` new ProductName(`○○コマンドテスト商品${TEST_PRODUCT_CODE}`) `` に変更（各ファイル1箇所、計10箇所）
  - name への他参照（アサーション等）は無いことを確認済み。cleanup・code 定数は変更しない
- コミットメッセージ: `fix: #517 pricingコマンドテストの商品名をTEST_PRODUCT_CODE連動でファイル固有化`

### Step 3: QueryService テスト2ファイルの ProductName をファイル固有化
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCommonSellingPriceEditQueryService.test.ts`
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCostPriceEditQueryService.test.ts`
- 作業内容:
  - こちらは name をアサーションでも参照している（`expect(dto!.productName).toBe("編集読みモデルテスト商品")` が各ファイル2箇所）ため、`` const TEST_PRODUCT_NAME = `編集読みモデルテスト商品${TEST_PRODUCT_CODE}` `` を定数として導入し、生成箇所（`new ProductName(TEST_PRODUCT_NAME)`）とアサーション2箇所で共用する
- コミットメッセージ: `fix: #517 編集読みモデルテストの商品名をTEST_PRODUCT_CODE連動でファイル固有化`

## 検証

1. **Issue の再現手順そのままの反証**: 確認済み衝突ペアを並列実行して安定することを確認（Issue では3回連続失敗した手順）
   ```bash
   pnpm vitest run src/server/subdomains/pricing/application/commands/__tests__/ReviseCommonSellingPricePeriodCommand.test.ts src/server/subdomains/pricing/application/commands/__tests__/ReviseCustomerSellingPricePeriodCommand.test.ts
   ```
   を3回以上繰り返し、全回グリーンであること
2. **修正した12ファイル全体の並列実行**: 6ペアすべてを一括で `pnpm vitest run` し、グリーンであること
3. **フルテスト**: `pnpm test` がグリーンであること（共有 dev DB のため他ワークツリーのタイミング起因ノイズには注意）
4. 修正後の全テストファイルで、products へ INSERT する name にファイル横断重複が無いことを抽出スクリプト（grep + uniq）で再確認

## 対象外（明示）

- インメモリテストの `"テスト商品"` `"セット商品"` 等の文字列重複（DB 非接触・衝突不能）
- 非 unique 列に対する `"Bの変更"` 重複（Customer / Department / Employee / Role / DeliveryLocation の name）
- cleanup 戦略の変更、テストヘルパー/ファクトリの新設
