# Issue #500: 原価 一覧・編集読みモデル（List/Edit QueryService・BE read系） — 実装計画

## 概要

原価（CostPrice）保守画面向けの読みモデルを、共通売単価の対応実装（#429 / #466 / #473）の完全ミラーとして実装する。

- `CostPriceListQueryService` IF + `CostPriceListItemDTO`（application/queries）
- `CostPriceEditQueryService` IF + `CostPriceEditDTO`（application/queries、version 付き・行の時点状態）
- `PrismaCostPriceListQueryService` / `PrismaCostPriceEditQueryService`（infrastructure/queries）+ 統合テスト
- `pricingQueryFactory` へ `costPriceListQueryFactory` / `costPriceEditQueryFactory` を追加

write 側（ドメイン保守操作＋コマンド）はスコープ外（後続 issue）。

実装規約は模倣元を踏襲する:

- `$queryRaw` + `::text` 10進文字列（Decimal は float64 を通さない）
- 参照日はアプリ層注入・`CURRENT_DATE` 不使用（ADR-20260627-86b）
- 適用期間は半開区間 `[)`、境界展開は共有フラグメント `applicablePeriodBounds` を使用

## 設計判断

（/grill-with-docs セッションで合意済み）

### 一覧 DTO の項目構成

- A. 共通売単価の完全ミラー（追加項目なし）
- B. 原価特有の項目（例: 共通販売単価併記による粗利可視化）を追加
- 採用: A。ADR-20260627-a5c が同型を規定。粗利可視化は保守画面でなく分析の関心であり、ADR-0069（FE 直 type-import）により後から列を足すコストは小さい。

DTO 形:

```
CostPriceListItemDTO:
  productId / productCode / productName / isActive
  currentCostPrice: string | null
  priceStatus: CostPricePriceStatus  // "active" | "lapsed" | "unset"
```

検索条件も同構成: code 部分一致（大小無視）・name 部分一致（大小無視）・priceStatus フィルタ。ページングなし、productCode 昇順。母集合は全商品で、原価集約なし商品は `unset` として一覧に現れる（unset フィルタで絞り込み可能）。

### 編集読みモデルの形

- A. `050c9b4`（#473 Step2 手直し）適用後の最終形を最初から実装
- B. 当初形（productId キー・identity なし）から始めて後追い修正
- 採用: A。手直しの動機（FE の code→id 解決と商品名二重取得の廃止、route `[productCd]` から BE の 1 読みモデルで引く）は原価でもそのまま成立する。

DTO 形:

```
find({ productCode, referenceDate }): Promise<CostPriceEditDTO | null>

CostPriceEditDTO:
  productId / productCode / productName / isActive   // identity 同梱
  version: number | null                             // null = 新規登録モード
  periods: { periodId, start, end, costPrice, status }[]
                       // status: CostPricePeriodStatus = "future" | "active" | "expired"
```

null 判定規則: 商品自体が不在なら `null`（FE は `notFound()`）。商品は在るが原価集約が無ければ identity + `version: null` + 空 periods（新規登録モード）。

### status 型の共有 vs 複製

- A. 集約ごとに複製（`CostPricePriceStatus` / `CostPricePeriodStatus` を原価側 dto に新設）
- B. pricing サブドメイン共有型（`PriceStatus` / `PeriodStatus`）に昇格
- 採用: A。FE 直 import（ADR-0069）の契約を 2 画面で 1 型に結合しない。ADR-20260627-a5c も集約をジェネリック化でなく複製として実装しており方針を揃える。得意先別・納品先別の保守画面が揃った時点で共有化を再判断。
- 命名は機械的ミラー（`{集約名}PriceStatus` / `{集約名}PeriodStatus`）。`CostPricePriceStatus` の語の重なりは不格好だが、模倣元とのパターン対称性（並置 diff での逸脱検知・grep 可能性）を優先する。

### 統合テストの観点

- A. 模倣元の観点セットを完全移植（追加・削減なし）
- B. 原価固有の観点を追加 / 一部削減
- 採用: A。原価で新たに増えた分岐は存在しない（値カラム名の差のみ）。コードが複製なのでテストも複製とし、将来の片側修正時に観点 diff で検知できるようにする（テストの対称性が事実上の契約テスト）。

### CONTEXT.md / ADR

- 用語「未設定 (Unset)」を CONTEXT.md に追加済み（失効との区別＝改定 vs 新規登録のアクション差）。
- 新規 ADR は不要: 同型実装の根拠は ADR-20260627-a5c が既に担っている。

## ステップ

TDD（/tdd）前提。統合テスト（Prisma 実装のテスト）を red として先に書き、実装で green にする。IF/DTO はテストがコンパイルできる最小限を各サイクルの冒頭で用意する。

### Step 1: 一覧読みモデルの契約（DTO + IF）

- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/dto/CostPriceListItemDTO.ts`（新規）
  - `src/server/subdomains/pricing/application/queries/CostPriceListQueryService.ts`（新規）
- 作業内容:
  - `CostPricePriceStatus` 型（`"active" | "lapsed" | "unset"`）と `CostPriceListItemDTO` を定義
  - `list(input: { referenceDate: string; code?: string; name?: string; priceStatus?: CostPricePriceStatus }): Promise<CostPriceListItemDTO[]>` の IF を定義
  - 模倣元: `CommonSellingPriceListItemDTO.ts` / `CommonSellingPriceListQueryService.ts`
- コミットメッセージ: `feat: 原価一覧読みモデルの契約（CostPriceListQueryService IF + DTO）`

### Step 2: PrismaCostPriceListQueryService（red → green）

- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCostPriceListQueryService.test.ts`（新規・先行）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCostPriceListQueryService.ts`（新規）
- 作業内容:
  - 【red】統合テストを先に書く。観点は模倣元 `PrismaCommonSellingPriceListQueryService.test.ts` の完全移植:
    1. 現在有効行あり → `currentCostPrice` 値 + `active`
    2. 期間行なし → null + `unset`
    3. 将来行のみ → null + `lapsed`
    4. 失効行のみ → null + `lapsed`
    5. 検索: code 部分一致（大小無視）/ name 部分一致（大小無視）/ `priceStatus=unset` 絞り込み
  - 【green】`$queryRaw` 1 本（派生テーブルに現在有効行を LEFT JOIN、外側 WHERE で絞り込み、CASE で三状態算出、`cost_price::text`、`ORDER BY "productCode"`）で実装
- コミットメッセージ: `feat: 原価一覧QueryServiceのPrisma実装と統合テスト`

### Step 3: 編集読みモデルの契約（DTO + IF）

- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/dto/CostPriceEditDTO.ts`（新規）
  - `src/server/subdomains/pricing/application/queries/CostPriceEditQueryService.ts`（新規）
- 作業内容:
  - `CostPricePeriodStatus` 型（`"future" | "active" | "expired"`）、`CostPriceEditPeriodDTO`、`CostPriceEditDTO`（identity 同梱・`version: number | null`）を定義
  - `find(input: { productCode: string; referenceDate: string }): Promise<CostPriceEditDTO | null>` の IF を定義
  - 模倣元: `CommonSellingPriceEditDTO.ts` / `CommonSellingPriceEditQueryService.ts`（`050c9b4` 適用後）
- コミットメッセージ: `feat: 原価編集読みモデルの契約（CostPriceEditQueryService IF + DTO）`

### Step 4: PrismaCostPriceEditQueryService（red → green）

- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCostPriceEditQueryService.test.ts`（新規・先行）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCostPriceEditQueryService.ts`（新規）
- 作業内容:
  - 【red】統合テストを先に書く。観点は模倣元 `PrismaCommonSellingPriceEditQueryService.test.ts` の完全移植:
    1. identity・version・期間行配列 + 各行の時点状態（future/active/expired）
    2. 商品あり集約なし → 新規登録モード（`version: null` + 空 periods）
    3. 商品不在 → null
    4. update 後の version 反映
  - 【green】3 ステップ実装（product findUnique → costPrice version 取得 → `$queryRaw` で期間行 + CASE 時点状態、`ORDER BY lower(applicable_period)`、`applicablePeriodBounds` 使用）
- コミットメッセージ: `feat: 原価編集QueryServiceのPrisma実装と統合テスト`

### Step 5: pricingQueryFactory への登録

- 対象ファイル:
  - `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts`（変更）
- 作業内容:
  - `costPriceListQueryFactory(): CostPriceListQueryService` / `costPriceEditQueryFactory(): CostPriceEditQueryService` を追加（Prisma 実装を直接 new して IF 型で返す既存パターン）
  - 仕上げに lint / 全テストを通す
- コミットメッセージ: `feat: pricingQueryFactoryに原価List/Edit QueryFactoryを追加`
