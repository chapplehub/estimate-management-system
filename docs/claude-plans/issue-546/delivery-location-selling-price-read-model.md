# Issue #546: 納品先別販売単価の読みモデル（一覧 / 編集 QueryService + DTO）— 実装計画

## 概要

親 #544 の分割のうち **BE 読み取り側**。納品先別販売単価の保守画面（FE は #547/#548）が消費する「読みモデル」を、得意先別 #506 とほぼ完全な同型で追加する。価格決定エンジン用の**時点解決 QueryService（既存）とは別物**で、本イシューは「一覧・保守画面に表示するための読み取りビュー」を担う。

現状、納品先別は書き込み側 #550・リポジトリ・時点解決 QueryService・factory 群までコミット済みだが、**保守画面向けの List/Edit QueryService と DTO が未実装**。これを埋めるのが本イシューのゴール。Issue が明示した4つの未決事項はユーザー確認済み（下記「設計判断」に反映）。

## 設計判断

### 一覧の対比列（未決#3）→ 決定: 共通のみ併記
- A. **共通単価のみ併記**（`currentCommonSellingPrice`）← 採用
- B. 得意先別 + 共通の両方併記
- C. 対比なし
- 理由: 納品先宛の価格解決連鎖は `PriceResolutionPolicy` で **`納品先別 ?? 共通`**。得意先別は連鎖に入らない（`SellingPriceResolutionTarget` の宛先分岐で排他）。得意先別 #506 と同型で、DTO が実連鎖と一致し意味論のズレが無い。

### 納品先セレクタの絞り込み（未決#2）→ 決定: 得意先→納品先の2段
- A. **得意先→納品先の2段**（既存 `searchDeliveryLocationsForSelection(customerId, ...)` 流用）← 採用
- B. 納品先の横断検索
- 理由: 見積フローと同じメンタルモデル。既存の選択アクション（2段）をそのまま流用でき、新規BEコード不要。

### 候補クエリの配置（未決#1）→ 決定: 既存クエリを流用（新規なし）
- A. **既存 `SearchDeliveryLocationsQuery` を流用**（`customerId` オプショナルで両モード対応済み）← 採用
- B. pricing 側に候補クエリを新設
- 理由: 納品先の検索は納品先サブドメインの責務（DDD）。`searchDeliveryLocationsForSelection` / `searchCustomersForSelection` が両段を既にカバー。**スコープ第4項「候補クエリ」は新規BEコード不要**（作らないことを明示決定 → deviations.md に記録）。

### priceStatus の導出位置（未決#4）→ 決定: SQL 内 CASE 式で導出
- 得意先別 #506（`PrismaCustomerSellingPriceListQueryService` の `CASE ... EXISTS`）と同型で SQL 内導出。判断不要（既存パターン踏襲）。

### 封筒/Edit DTO への親得意先 identity 同梱（新規の設計判断）
- 一覧封筒・Edit DTO に、納品先自身の identity に加え**親得意先の identity（customerCode / customerName）を同梱する**。
- 理由: 保守画面ヘッダは納品先だけでなく親得意先の文脈提示が自然。FE 側の code→id 二重取得を避ける（#473 の素描画方針）。`DeliveryLocationDTO` が既に customer リレーションをモデル化済み。得意先別 #506 からの唯一の実質的な形状差 → コミットボディに理由を記載。
- Edit DTO は3エンティティ（納品先・商品・親得意先）を載せるため、有効フラグは接頭辞命名（`deliveryLocationIsActive` / `productIsActive`）で自己記述性を確保する。

## ステップ

> 各ステップ = 1コミット。ミラー元は得意先別 #506 の対応ファイル（`Customer*` → `DeliveryLocation*`、identity キーを `customerCode` → `deliveryLocationCode`、期間テーブルを `customer_selling_price_periods` → `delivery_location_selling_price_periods`、JOIN 固定キーを `customer_id` → `delivery_location_id` に読み替え）。

### Step 1: 一覧 DTO
- 対象ファイル（新規）: `src/server/subdomains/pricing/application/queries/dto/DeliveryLocationSellingPriceListDTO.ts`
- ミラー元: `dto/CustomerSellingPriceListDTO.ts`
- 作業内容:
  - `DeliveryLocationSellingPricePriceStatus = "active" | "lapsed" | "none"`（型は集約ごとに独立複製・ADR-20260627-a5c）
  - `DeliveryLocationSellingPriceListItemDTO`: productId/Code/Name, isActive, currentSellingPrice, currentPeriodStart/End, `currentCommonSellingPrice`, priceStatus（得意先別と同一構造）
  - `DeliveryLocationSellingPriceListDTO`（封筒）: deliveryLocationId/Code/Name, deliveryLocationIsActive, **customerId/Code/Name（親得意先）**, items
- コミットメッセージ: `feat: 納品先別販売単価 一覧読みモデルDTO（封筒に親得意先identity同梱）`

### Step 2: 編集 DTO
- 対象ファイル（新規）: `src/server/subdomains/pricing/application/queries/dto/DeliveryLocationSellingPriceEditDTO.ts`
- ミラー元: `dto/CustomerSellingPriceEditDTO.ts`
- 作業内容:
  - `DeliveryLocationSellingPricePeriodStatus = "future" | "active" | "expired"`
  - `DeliveryLocationSellingPriceEditPeriodDTO`: periodId, start, end, sellingPrice, status
  - `DeliveryLocationSellingPriceEditDTO`: deliveryLocationId/Code/Name/IsActive, productId/Code/Name/IsActive, **customerId/Code/Name（親得意先）**, version（`number | null`）, periods
- コミットメッセージ: `feat: 納品先別販売単価 編集読みモデルDTO`

### Step 3: 一覧 QueryService IF
- 対象ファイル（新規）: `src/server/subdomains/pricing/application/queries/DeliveryLocationSellingPriceListQueryService.ts`
- ミラー元: `CustomerSellingPriceListQueryService.ts`
- 作業内容: `find({ deliveryLocationCode, referenceDate, code?, name?, priceStatus? }): Promise<DeliveryLocationSellingPriceListDTO | null>` を定義（納品先不在なら null）
- コミットメッセージ: `feat: 納品先別販売単価 一覧QueryServiceインターフェース`

### Step 4: 編集 QueryService IF
- 対象ファイル（新規）: `src/server/subdomains/pricing/application/queries/DeliveryLocationSellingPriceEditQueryService.ts`
- ミラー元: `CustomerSellingPriceEditQueryService.ts`
- 作業内容: `find({ deliveryLocationCode, productCode, referenceDate }): Promise<DeliveryLocationSellingPriceEditDTO | null>` を定義
- コミットメッセージ: `feat: 納品先別販売単価 編集QueryServiceインターフェース`

### Step 5: 一覧 QueryService Prisma 実装 + テスト
- 対象ファイル（新規）:
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaDeliveryLocationSellingPriceListQueryService.ts`
  - `.../infrastructure/queries/__tests__/PrismaDeliveryLocationSellingPriceListQueryService.test.ts`
- ミラー元: `PrismaCustomerSellingPriceListQueryService.ts` / 同 `.test.ts`
- 作業内容:
  - 納品先を `code`（グローバル一意）で引き（不在なら null）、親得意先を JOIN/select して封筒に同梱
  - 母集合 = 価格保守対象商品（`ProductCategory.priceableValues()`・セット除外）
  - `LEFT JOIN delivery_location_selling_price_periods dl ON dl.product_id = p.id AND dl.delivery_location_id = $固定 AND dl.applicable_period @> $参照日::date`
  - `LEFT JOIN common_selling_price_periods com`（共通並記・COALESCE しない）
  - priceStatus = SQL 内 CASE（`dl.id IS NOT NULL`→active／`EXISTS(delivery_location_id 相関)`→lapsed／else none）
  - 検索条件（code/name 部分一致・`containsPattern`・`ESCAPE`／priceStatus）は派生テーブル外側 WHERE
  - テスト: 得意先別リストのテスト（active/none/lapsed×2/共通並記×2/セット除外/他納品先の隔離/昇順/検索3種）を納品先文脈へ移植。シードは親得意先→納品先→単価の順（`PrismaDeliveryLocationSellingPriceQueryService.test.ts` のパターン踏襲）
- コミットメッセージ: `feat: 納品先別販売単価 一覧QueryServiceのPrisma実装 + 結合テスト`

### Step 6: 編集 QueryService Prisma 実装 + テスト
- 対象ファイル（新規）:
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaDeliveryLocationSellingPriceEditQueryService.ts`
  - `.../infrastructure/queries/__tests__/PrismaDeliveryLocationSellingPriceEditQueryService.test.ts`
- ミラー元: `PrismaCustomerSellingPriceEditQueryService.ts` / 同 `.test.ts`
- 作業内容:
  - 納品先（code・親得意先同梱）と商品（code）を引き、どちらか不在なら null
  - 親 `delivery_location_selling_prices` を複合キー（delivery_location_id, product_id）で `findFirst` して version 取得（上書きなしなら version=null＝新規登録モード・periods 空配列）
  - 期間行は `$queryRaw` で `applicablePeriodBounds` + `selling_price::text` + 時点状態 CASE（active/future/expired）、`lower(applicable_period)` 昇順
  - テスト: 不在→null／identity 同梱／version・periods／各時点状態を移植
- コミットメッセージ: `feat: 納品先別販売単価 編集QueryServiceのPrisma実装 + 結合テスト`

### Step 7: factory 登録
- 対象ファイル（編集）: `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts`
- ミラー元: `customerSellingPriceList/EditQueryFactory`
- 作業内容: `deliveryLocationSellingPriceListQueryFactory()` / `deliveryLocationSellingPriceEditQueryFactory()` を追加（Prisma 実装を直接返す既存規約）
- コミットメッセージ: `feat: 納品先別販売単価 読みモデルのfactory登録`

### Step 8: 逸脱記録
- 対象ファイル（新規）: `docs/claude-plans/issue-546/deviations.md`
- 作業内容: スコープ第4項「納品先セレクタ用の候補クエリ」を**新規実装せず既存 `SearchDeliveryLocationsQuery` 流用で満たした**旨（元計画=候補クエリ新設の余地／実際=既存流用／理由=納品先検索は納品先サブドメイン責務・既存で両段カバー）を記録。封筒/Edit DTO への親得意先 identity 同梱の判断も併記
- コミットメッセージ: `docs: issue-546 逸脱記録（候補クエリは既存流用・親得意先identity同梱）`

## 対象外（スコープ含まない）

- 書き込み系 → #545/#550（コミット済み）
- FE 一切（一覧画面 #548 / 管理画面 #547 が本読みモデルを消費）
- 候補クエリの新規実装（既存 `SearchDeliveryLocationsQuery` で充足）

## 検証

- `pnpm test src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaDeliveryLocationSellingPriceListQueryService.test.ts` および `...EditQueryService.test.ts`（結合テストは実 DB・ADR-0012。既存の納品先別/得意先別テストと同じ実行系）
- `pnpm lint`（型・境界チェック。QueryService 境界を VO が越えないこと）
- 全体 E2E はローカルで回さず CI に委ねる（feedback_no_full_e2e_locally）。本イシューは BE 読みモデルのみで FE 動線が無いため、実機確認は消費側 #547/#548 で行う
