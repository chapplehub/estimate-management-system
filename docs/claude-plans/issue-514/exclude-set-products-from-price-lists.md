# Issue #514: セット商品を価格一覧（原価・共通販売単価）から除外する — 実装計画

## 概要

原価一覧・共通販売単価一覧の母集合が `FROM products p`（全商品）のため、価格を持たないセット商品が常に `priceStatus='unset'`（未設定）として並んでしまう。これは CONTEXT.md「未設定＝新規登録を促すべき派生状態」と矛盾する意味破綻。

母集合を「全商品」から「**価格保守対象商品**（個別商品・消耗品）」へ再定義し、セット商品を両一覧から除外する。効きどころは読みモデル（2つの QueryService の生SQL）1点に集約され、ドメイン層に足すのは規則の言語化（`ProductCategory.canHavePrice()`）のみ。UI・DTO・書き込み系はすべて無変更。

用語集（CONTEXT.md）は本計画合意時のグリルセッションで反映済み:
- **セット商品**: 「常に0円」を削除し「それ自体は価格（単価・原価）を持たず、金額は構成商品から算出」へ改訂。_Avoid_ に「0円商品」を追加。
- **価格保守対象商品（Priceable Product）**: 新設。共通販売単価・原価を保守する対象＝個別商品・消耗品。両一覧の母集合はこれに一致。
- **未設定**: 「価格保守対象商品にのみ生じる」注記を追加。

## 設計判断

### 対象範囲
- 原価一覧・共通販売単価一覧の2画面のみ。
- 得意先別・納品先別販売単価は `resolve`（時点解決）専用で一覧クエリ・一覧画面を持たないため対象外（確認済み）。

### 問題のフレーミング
- A. 除外ルール（母集合は全商品のまま、表示時にSETを弾く）
- B. 母集合の再定義（母集合を「価格を持ちうる商品」に定義し直す）
- 選択: **B**。理由: 真の問題は「価格を持てない商品を母集合に入れていること」。母集合を正準語で言語化すれば2一覧が同一定義を共有でき、実装ドリフトを防げる。

### フィルタの書き方
- X. 除外形 `p.category <> 'SET'`
- Y. 許可リスト形 `p.category IN ('INDIVIDUAL','CONSUMABLE')`
- 選択: **Y**。理由: CONTEXT.md「価格保守対象商品＝個別・消耗品」の正準定義をそのまま表現でき、将来4つ目の区分が増えても明示するまで一覧に載らない（フェイルセーフ）。価格・金額を扱う画面では黙って混入するより明示強制が安全。

### 「価格保守対象の区分」定義の置き場所
- A. 各クエリにベタ書き＋コメント相互参照
- C. ドメインVO（`ProductCategory`）を単一の真実源に
- 選択: **C**。理由: 「どの区分が価格を持ちうるか」はドメインの事実で、`ProductCategory` には既に `canBeComponent()` 等の同種述語がある。規則を区分enumと同居させれば、将来の区分追加時に必ず `ProductCategory` を触るためドリフトしにくい。infra→domain 参照は許容（ProductMapper も import 済み）。

### VO追加の形と命名
- 単一源 `PRICEABLE_VALUES = ["INDIVIDUAL","CONSUMABLE"]` を1つ定義し、述語 `canHavePrice()` と値リスト `priceableValues()` の両方をそこから導出（二重定義のドリフトを排除）。
- 述語名は既存の `canHave*` ファミリー（`canHaveComponents` 等）に整合させ **`canHavePrice()`**。

### テスト範囲
- VO単体テスト＋両クエリ統合テスト（SET除外）を実施。
- E2E追加は見送り。理由: UIに独自ロジックが無く一覧はクエリ結果をそのまま描画するため、除外は統合テストで決定的に担保でき、E2E追加（seed帯へSET商品追加を伴う）の限界価値が小さい。既存E2Eは件数非依存（PRD84xコード指定）のため破綻しない。

### ADR
- 起こさない。可逆であり、CONTEXT.md の用語追加＋自己説明的なコードで文脈は足りる（3条件がすべては揃わない）。

## ステップ

TDD（red-green-refactor）で進める。各ステップは失敗するテストを先に書き、実装で緑にする。

### Step 1: ProductCategory VO に価格保守対象の述語・値リストを追加
- 対象ファイル:
  - `src/server/subdomains/product/domain/values/__tests__/ProductCategory.test.ts`（先にテスト＝red）
  - `src/server/subdomains/product/domain/values/ProductCategory.ts`（実装＝green）
- 作業内容:
  - 【red】`canHavePrice()` が INDIVIDUAL/CONSUMABLE→true・SET→false、`priceableValues()` が `["INDIVIDUAL","CONSUMABLE"]` を返すテストを追加。
  - 【green】単一源 `private static readonly PRICEABLE_VALUES = ["INDIVIDUAL","CONSUMABLE"] as const;` を追加し、`canHavePrice()`（メンバシップ判定）と `static priceableValues()` を導出。コメントで CONTEXT.md「価格保守対象商品」を参照。
- コミットメッセージ: `feat: 商品区分に価格保守対象の述語 canHavePrice/priceableValues を追加`

### Step 2: 原価一覧クエリの母集合をセット商品除外に絞る
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCostPriceListQueryService.test.ts`（先にテスト＝red）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCostPriceListQueryService.ts`（実装＝green）
- 作業内容:
  - 【red】`makeProduct` でSET区分商品を作り、`list()` の結果 `codes` に含まれないことを assert するテストを追加。
  - 【green】派生テーブルの `FROM products p` に `WHERE p.category IN (…)` を追加。値は `ProductCategory.priceableValues()` を `Prisma.join` で注入。
  - 【refactor】JSDoc の「母集合＝全商品」を「母集合＝価格保守対象商品（セット商品を除く）」へ修正。
- コミットメッセージ: `fix: 原価一覧の母集合からセット商品を除外（価格保守対象商品に限定）`

### Step 3: 共通販売単価一覧クエリの母集合をセット商品除外に絞る
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCommonSellingPriceListQueryService.test.ts`（先にテスト＝red）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceListQueryService.ts`（実装＝green）
- 作業内容:
  - 【red】Step 2 と同型のSET除外テストを追加。
  - 【green】同型ミラーとして `WHERE p.category IN (…)` を追加（`ProductCategory.priceableValues()` を注入）。
  - 【refactor】JSDoc の「母集合＝全商品」を修正。
- コミットメッセージ: `fix: 共通販売単価一覧の母集合からセット商品を除外（原価一覧と同型ミラー）`

### Step 4: 一覧E2Eの陳腐化コメントを修正
- 対象ファイル:
  - `src/app/(features)/cost-prices/cost-prices-list.e2e.ts`
  - `src/app/(features)/common-selling-prices/common-selling-prices-list.e2e.ts`
- 作業内容:
  - 冒頭コメントの「母集合は全商品」を「母集合は価格保守対象商品（セット商品を除く全商品）」へ修正（E2Eアサーション自体は追加しない）。
- コミットメッセージ: `docs: 価格一覧E2Eの母集合コメントを価格保守対象商品に修正`

### 補足
- CONTEXT.md の用語更新（セット商品改訂・価格保守対象商品新設・未設定注記）はグリルセッションで反映済み。コミット未実施のため、Step 1 と同じコミットに含めるか単独コミットにするかは実装時に判断（設計判断の記録として単独 `docs:` コミット推奨）。
