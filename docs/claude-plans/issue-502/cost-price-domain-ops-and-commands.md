# Issue #502: 原価 ドメイン保守操作とCRUD・単価改定コマンド（BE write系） — 実装計画

## 概要

原価（`CostPrice`）集約にドメイン保守操作（`editPeriod` / `endDatePeriod` / `deletePeriod` / `currentValidPeriod`、`addPeriod` への referenceDate ガード）を追加し、保守用の5コマンド（登録・編集・適用終了・単価改定・削除）+ `loadCostPriceOrThrow` 共有ヘルパ + command factories 5本を実装する。

方針は ADR-20260627-a5c（原価は共通売単価と完全同型）に基づく、**共通売単価の現行完成形の機械移植**。模倣元は `CommonSellingPrice` 一式（#466 で出た修正2件 — 適用終了の短縮のみ許可・日付形式検証の前倒し、および `15498af` の expectedVersion 未指定→ValidationError — を含む現在のコード）とする。

- 実装方式: `/tdd`（red-green-refactor）。各ステップで模倣元のテストファイルをミラーした失敗テストを先に書き、実装で green にする
- FE・Server Actions・E2E は後続 issue のスコープ（本 issue は BE write系のみ）
- 用語: この操作群の正準語は「単価改定」（「改訂」「原価改定」は使わない）。CONTEXT.md 更新済み

## 設計判断

### 既存テストの `addPeriod` 移行方式
- A. 共通売単価の前例通り、全呼び出しに「開始日と同日の referenceDate」を第3引数として機械追加する
- B. 過去行のセットアップを `reconstruct` + repository 直 insert に書き換える
- 採用: A。`insert` は集約を受けるため結局 `addPeriod` で組み立てる必要があり B に実益がない。テストスタイルの同型維持を優先
- 影響範囲（調査済み）: テスト7ファイル・約38箇所のみ。seed は生 Prisma + raw SQL、Mapper は `reconstruct` 経由のため**無影響**

### expectedVersion 未指定時のエラー型
- 既存集約への期間追加で未指定なら `ValidationError` で早期拒否（`RegisterCommonSellingPricePeriodCommand` の `15498af` 修正済み形をそのまま移植）。`?? 0` フォールバックは version 1始まりと永久不一致で必ず ConflictError になるため禁止。判断不要（前例踏襲）

### 単価改定切り出し保険の発動基準
- 発動基準は「**設計逸脱の発生**」のみ（原価固有の非同型な業務ルールが1つでも見つかった時点で、単価改定 + `currentValidPeriod` を別 issue へ切り出し基礎4コマンドで PR を出す）
- 作業量・テストの長さでは発動しない（機械的移植の量は失敗リスクにならない）
- 逸脱時は `docs/claude-plans/issue-502/deviations.md` に記録

### セット商品への登録ガード
- 本 issue では**入れない**（模倣元と完全同型を維持）。集約は Product カテゴリを知り得ず、ガードは app 層の追加設計＝設計逸脱になるため
- 要否の判断は #515（4集約横断の question issue）へ先送り。セット商品は見積側で価格付き末端行にならないため、仮に登録されても時点解決で参照されず実害はない

### 用語の正準化
- 原価の切り替え操作にも正準語「単価改定」を使う（CONTEXT.md の「単価改定」定義を販売単価・原価明示に更新済み。_Avoid_ に「原価改定」を追加済み）
- クラス名は前例通り `ReviseCostPricePeriodCommand`（英語正準語 Price Revision と一致）

## ステップ

各ステップは red（模倣元テストのミラーを先に書き失敗確認）→ green（実装）→ refactor の順で進める。

### Step 1: `addPeriod` への referenceDate ガード追加 + 既存テスト移行
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CostPrice.ts`
  - `src/server/subdomains/pricing/domain/entities/__tests__/CostPrice.test.ts`
  - 既存テスト6ファイル（`PrismaCostPriceRepository.test.ts` / `PrismaCostPriceListQueryService.test.ts` / `PrismaCostPriceEditQueryService.test.ts` / `PrismaCostPriceQueryService.test.ts` / `ResolveCostPriceQuery.test.ts` / `CostPriceMapper.test.ts` は要確認）
- 作業内容:
  - red: 過去開始日の `addPeriod` が `BusinessRuleViolationError` になるテストを `CommonSellingPrice.test.ts` からミラー
  - green: `addPeriod(period, price, referenceDate)` へシグネチャ変更、内部ガード `isFuture` / `assertStartNotPast` / `assertNoOverlap`（excludeRow 対応）を追加
  - 既存テスト約38箇所へ「開始日と同日の referenceDate」を機械追加
- コミットメッセージ: `feat: 原価集約のaddPeriodに参照日ガードを追加（過去開始の禁止・ADR-20260627-86b）`

### Step 2: `CostPricePeriod` のミューテータ + 集約のドメイン保守操作
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CostPricePeriod.ts`（`_period` / `_price` の readonly 解除、`changeTo` / `endDateOn` 追加）
  - `src/server/subdomains/pricing/domain/entities/CostPrice.ts`（`editPeriod` / `endDatePeriod` / `deletePeriod` / `currentValidPeriod` / `requireRow` 追加）
  - `src/server/subdomains/pricing/domain/entities/__tests__/CostPrice.test.ts`
- 作業内容:
  - red: `CommonSellingPrice.test.ts` の該当ケースをミラー（将来行のみ編集可・現在有効行のみ適用終了可・短縮のみ許可・終了日は今日より後・endDate 形式検証の前倒し・未来開始行のみ削除可、を最初から含める）
  - green: `CommonSellingPrice` の各メソッドを移植（ENTITY_NAME は「原価」）
- コミットメッセージ: `feat: 原価集約にドメイン保守操作を追加（editPeriod/endDatePeriod/deletePeriod/currentValidPeriod）`

### Step 3: `loadCostPriceOrThrow` + 登録コマンド
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/loadCostPriceOrThrow.ts`
  - `src/server/subdomains/pricing/application/commands/RegisterCostPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/__tests__/RegisterCostPricePeriodCommand.test.ts`
- 作業内容:
  - red: `RegisterCommonSellingPricePeriodCommand.test.ts` をミラー（新規 insert / 既存へ追加 update / expectedVersion 未指定→ValidationError / 楽観ロック競合→ConflictError）。実 Prisma リポジトリの統合テスト形式（Product セットアップ + cleanup）
  - green: 模倣元コマンドを移植（単価 VO は `CostUnitPrice.fromMoney(Money.fromDecimalString(...))`）
- コミットメッセージ: `feat: 原価の期間登録コマンド（insert/update分岐・expectedVersion未指定はValidationError）`

### Step 4: 編集・適用終了・削除コマンド
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/EditCostPricePeriodCommand.ts` + テスト
  - `src/server/subdomains/pricing/application/commands/EndDateCostPricePeriodCommand.ts` + テスト
  - `src/server/subdomains/pricing/application/commands/DeleteCostPricePeriodCommand.ts` + テスト
- 作業内容:
  - red→green を1コマンドずつ。模倣元の Edit / EndDate / Delete コマンドとテストをミラー
- コミットメッセージ: `feat: 原価の期間編集・適用終了・削除コマンド`

### Step 5: 単価改定コマンド
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/ReviseCostPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/__tests__/ReviseCostPricePeriodCommand.test.ts`
- 作業内容:
  - red: `ReviseCommonSellingPricePeriodCommand.test.ts` をミラー（現在有効行なし→BusinessRuleViolationError / 適用終了→追加の順序 / 接触境界の連続成立）
  - green: 「現在有効行の適用終了（終了日＝改定日）+ 改定日開始の新規期間追加」の合成を移植
  - ※ 保険の切り出し点はこのステップ（設計逸脱が出た場合ここを別 issue 化し Step 1〜4 で PR）
- コミットメッセージ: `feat: 原価の単価改定コマンド（適用終了+新規期間追加の合成・単一集約1セーブ）`

### Step 6: command factories
- 対象ファイル:
  - `src/server/subdomains/pricing/application/factories/registerCostPricePeriodCommandFactory.ts` ほか5本
- 作業内容:
  - 前例通りの素朴な DI ラッパ（`PrismaCostPriceRepository` を注入）。テスト対象外（前例に factories のテストなし）
- コミットメッセージ: `feat: 原価保守コマンドの factories 5本`
