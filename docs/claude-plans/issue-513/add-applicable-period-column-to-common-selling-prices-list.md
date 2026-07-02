# Issue #513: 共通販売単価一覧に適用期間列を追加する（原価一覧 #501 と同型） — 実装計画

## Context

なぜこの変更をするか:

- 共通売単価一覧（`common-selling-prices/`）は現在「商品コード・商品名・現在有効単価」の3列のみで、**現在有効単価がいつからいつまで有効か**が一覧上で分からない。期間を確認するには詳細画面まで遷移が必要。
- 先行して同型実装された**原価一覧 #501**（`cost-prices/`）は既に「適用期間」列を持つ。同型ミラー方針（ADR-20260627-a5c 系）の一貫性を保つため、共通売単価一覧の列構成を原価一覧に揃える。
- 期間表示ヘルパー `formatPeriod` は #501 で `(features)/_shared/formatPeriod.ts` に新設済み。本 Issue はそれを import するだけ。

Issue の未決事項5点はオーナーコメント（2026-07-02）で全確定済み:

- 適用期間列は**現在有効行の期間のみ**表示。`lapsed`／`unset` は空欄（状態は単価列のバッジが伝える）。
- 終了日は保守画面と同じ**半開区間の排他上端を生値表示**、`end: null` は「無期限」。
- DTO に `currentPeriodStart` / `currentPeriodEnd`（`string | null`）を追加。`start=null`＝有効行なし、`start`あり・`end=null`＝無期限。SQL は有効行の `lower()`/`upper()` を SELECT に足すだけ。
- `formatPeriod` は #501 実装済みを import するだけ。
- ソート・検索対象にはしない（#501 と同型）。

E2E 検証範囲（本計画で確認済み）: **完全ミラー**。無期限ケース用に新シード商品 PRD826 を追加し、有界・無期限・失効空欄・未設定空欄の4ケースを検証する。

## 参考実装（#501・そっくりミラーする）

| 関心 | 原価側（参考・実装済み） | 共通売単価側（本 Issue で変更） |
|---|---|---|
| DTO | `CostPriceListItemDTO.ts`（`currentPeriodStart/End` あり） | `CommonSellingPriceListItemDTO.ts` |
| Query IF | `CostPriceListQueryService.ts`（適用期間のコメントあり） | `CommonSellingPriceListQueryService.ts` |
| SQL | `PrismaCostPriceListQueryService.ts`（`lower()/upper()` 2行） | `PrismaCommonSellingPriceListQueryService.ts` |
| ユニットテスト | `__tests__/PrismaCostPriceListQueryService.test.ts`（有界/無期限/空欄の検証あり） | `__tests__/PrismaCommonSellingPriceListQueryService.test.ts` |
| FE 列 | `cost-prices/_components/columns.tsx`（適用期間列あり） | `common-selling-prices/_components/columns.tsx` |
| シード | `seed-e2e.ts` PRD840(有界)/PRD841(無期限) | 既存 PRD820(有界) + **新規 PRD826(無期限)** |
| E2E | `cost-prices-list.e2e.ts`（適用期間列テストあり） | `common-selling-prices-list.e2e.ts` |

## 設計判断

### DTO の複製 vs 共有
- 型は集約ごとに複製（ADR-0069・FE 直 type-import のミラー禁止）。`CommonSellingPriceListItemDTO` に独自にフィールドを足す。純粋ヘルパー `formatPeriod` のみ `_shared` で共有。
- 判断不要（既存の同型ミラー方針を踏襲）。

### E2E 無期限ケースのシード
- A. 新シード商品 PRD826（現在有効・無期限）を追加し、有界・無期限の両方を E2E 検証（#501 と完全同型）
- B. 既存シードのみで有界のみ検証、無期限はユニットテスト任せ
- **採用: A**（ユーザー確認済み・完全ミラー）。既存 PRD820 の現在有効行は有界 `[today-30, today+30)` のため、無期限行を持つ商品が PRD82x 帯に無く新規追加が必要。

### 現在有効・無期限行の EXCLUDE 制約整合
- 既存 PRD820 は「失効/現在有効/将来（無期限）」の3期間で `[today+30, ∞)` を将来行が占有済み。PRD826 は**独立した新商品**として `[today-30, ∞)` の現在有効・無期限行を1件だけ持たせる（他商品の期間と干渉しない）。判断不要。

## ステップ

### Step 1: 読みモデル（BE）に適用期間フィールドを追加
- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO.ts`
  - `src/server/subdomains/pricing/application/queries/CommonSellingPriceListQueryService.ts`
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceListQueryService.ts`
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCommonSellingPriceListQueryService.test.ts`
- 作業内容:
  - DTO に `currentPeriodStart: string | null` / `currentPeriodEnd: string | null` を追加。#501 の `CostPriceListItemDTO` と同一の doc コメント（`null`＝有効行なし／`start`あり・`end` null＝無期限、半開区間の排他上端生値）を付す。
  - SQL の派生テーブル SELECT に `lower(per.applicable_period)::text AS "currentPeriodStart"` / `upper(per.applicable_period)::text AS "currentPeriodEnd"` の2行を追加（#501 の Prisma 実装と同型・`per` が LEFT JOIN されない行では NULL）。
  - Query IF のクラス doc に「有効行がある場合は適用期間（`currentPeriodStart`/`currentPeriodEnd`）も添える」旨を #501 と同文で追記（シグネチャは不変）。
  - ユニットテストに #501 と同型のケースを追加: ①現在有効・無期限 → `currentPeriodStart`=開始日・`currentPeriodEnd`=null、②現在有効・有界 → 半開区間の生値（排他上端）、③unset/lapsed の各行で `currentPeriodStart`/`currentPeriodEnd`=null を追加検証。
- コミットメッセージ: `feat: 共通売単価一覧読みモデルに適用期間フィールドを追加（#513）`

### Step 2: 一覧（FE）に適用期間列を追加
- 対象ファイル:
  - `src/app/(features)/common-selling-prices/_components/columns.tsx`
- 作業内容:
  - `formatPeriod` を `../../_shared/formatPeriod` から import。
  - `currentSellingPrice` 列の後に `accessorKey: "currentPeriodStart"` / `header: "適用期間"` の列を #501 の `cost-prices/_components/columns.tsx` と同一ロジックで追加（`currentPeriodStart == null` なら `null` を返し空欄、それ以外は `formatPeriod(currentPeriodStart, currentPeriodEnd)` を `tabular-nums` で表示）。
- コミットメッセージ: `feat: 共通売単価一覧に適用期間列を追加（#513）`

### Step 3: E2E シードと一覧 E2E を追加
- 対象ファイル:
  - `prisma/seed-e2e.ts`
  - `src/app/(features)/common-selling-prices/common-selling-prices-list.e2e.ts`
- 作業内容:
  - `seed-e2e.ts` の PRODUCTS に PRD826（`CSP_現在有効無期限テスト商品`・`costPrice: null`）を追加。`seedCommonSellingPrices` に PRD826 の CSP 集約 + 現在有効・無期限行 `insertPeriod(prd826, 2500, jstRelativeDate(-30), null)` を追加（既存 PRD82x 帯には手を触れない）。
  - `common-selling-prices-list.e2e.ts` に #501 の `cost-prices-list.e2e.ts` と同型の `jstRelativeDate` ヘルパーと「適用期間列に現在有効行の期間（有界・無期限）を表示し失効/未設定は空欄」テストを追加。検証: 有界=PRD820（`{-30} 〜 {+30}`）／無期限=PRD826（`{-30} 〜 無期限`）／失効=PRD823（空欄）／未設定=PRD821（空欄）。ファイル冒頭 doc コメントも PRD826 追加と適用期間列に合わせて更新。
- コミットメッセージ: `test: 共通売単価一覧の適用期間列 E2E とシード（PRD826）を追加（#513）`

## 検証

- **ユニットテスト**: `pnpm test src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCommonSellingPriceListQueryService.test.ts`（有界・無期限・空欄の各アサーションが緑）。
- **型・lint**: `pnpm lint`（DTO 追加フィールドの型整合、`columns.tsx` の import）。
- **E2E**: `pnpm e2e`（シード再投入込み）。適用期間列テストで PRD820=有界・PRD826=無期限・PRD823/PRD821=空欄が緑。既存の「未設定のみ」絞り込みテスト（PRD82x 帯）が PRD826 追加後も緑のまま（PRD826 は active のため unset 絞り込みから除外され既存アサーションを壊さない）。
- **目視（任意）**: dev server で `/common-selling-prices?code=PRD820`（有界期間表示）と `?code=PRD826`（無期限表示）を確認。

## メモ

- 保守画面（`[productCd]/`）や `page.tsx`・ダッシュボード導線は変更不要（列追加は一覧の columns と読みモデルに閉じる）。
- deviations 記録: 実装中に本計画と異なる対応をしたら `docs/claude-plans/issue-513/deviations.md` に記録する（CLAUDE.md ルール）。
