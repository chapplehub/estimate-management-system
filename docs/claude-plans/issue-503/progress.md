# Issue #503 実装進捗

模倣元: 共通売単価 保守画面 `common-selling-prices/[productCd]`
消費BE: 読み `costPriceEditQueryFactory().find()`（#500）/ 書き 原価コマンド5本（#502）
コマンド入力型は共通売単価と完全同型（`start`/`end`/`price`/`referenceDate`/`expectedVersion`、revise は `revisionDate`/`price`）。スキーマも `price` のままで差異なし。

## PR1: 詳細＋期間CRUD（`feat/issue-503`）

- [x] **Step 1** period-rules を `(features)/_shared` へ昇格（TDD）
  - `_shared/period-rules.ts`（中立型 `PeriodStatus` + `authorityFor`）、`_shared/period-rules.test.ts`
  - 共通売単価 `_data/period-rules.{ts,test.ts}` 削除、`PeriodDetailPanel` の import 差し替え
  - commit `64f3c7c`
- [x] **Step 2** 原価 `schema.ts` / `actions.ts`（登録・編集・適用終了・削除の4 action、改定はPR2）
  - commit `39db5a4`
- [x] **Step 3** 詳細ページ＋期間CRUD コンポーネント
  - `page.tsx` / `PeriodDetailPanel.tsx` / `PeriodForm.tsx` / `PeriodDeleteConfirm.tsx`
  - PR1 版パネルは **単価改定・タイムラインを含まない縮小版**（PR2 で導線追加）
  - `pnpm lint` / `pnpm build` OK、`/cost-prices/[productCd]` ルート生成確認
  - dev server 実機確認: 一覧リンク生存、PRD001（active）で「適用終了」のみ表示、未設定 PRD015 の
    新規登録→将来行→削除の write 往復、コンソール Errors/Warnings 0
  - commit `4c13477`（progress.md は `9ea544d`）

### PR1 の逸脱 → deviations.md 逸脱1 に反映済み
- page.tsx は PR1 で `referenceDate` を panel へ渡さず query 用途のみに留めた（PR2 Step6 で復活）。

## PR2: 単価改定＋タイムライン（完了）

- [x] **Step 4** 単価改定フォーム
  - `schema.ts` に `revisePeriodSchema`、`actions.ts` に `revisePeriodAction`、`ReviseForm.tsx` 新規
  - `PeriodDetailPanel.tsx` に `revise` モードと改定導線を追加
  - commit `2289536`
- [x] **Step 5** timeline-layout を `(features)/_shared` へ昇格（TDD・中立構造型）
  - 中立構造型 `TimelinePeriod { periodId, start, end, status, price }`、status は昇格済み `PeriodStatus` 共有
  - `priceLabel` は price 引数化＋関数内 `formatYenFromDecimal`（deviations.md 判断記録）
  - 共通売単価 `_data/timeline-layout.{ts,test.ts}` 削除、`PeriodDetailPanel`/`PriceTimeline` の import・呼び出し差し替え
  - commit `bff47b2`
- [x] **Step 6** 原価タイムライン表示
  - `PriceTimeline.tsx` 新規、`PeriodDetailPanel.tsx` にトグル＋帯を組み込み、page から `referenceDate` を渡す
  - 実機確認: 改定（¥15,000→¥18,000 値上げ）合成成立、タイムライン2帯・今日マーカー・凡例、コンソール Errors 0
  - 検証後 dev DB は `pnpm db:seed` で復元済み
  - commit `ef73673`

## 全体検証
- `pnpm lint` / `pnpm build` / `npx tsc --noEmit` すべてクリーン
- `_shared/period-rules.test.ts`（3）・`_shared/timeline-layout.test.ts`（7）含むフロントテスト green

## メモ
- E2E は本 issue 範囲外（#504）
- 粗利率可視化はスコープ外（#522 に分離済み）
- Read ツールに表示バグ（末尾 ``` や内容捏造）があったため、原文照合は `cat` で実施した
