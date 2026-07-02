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
  - dev server 実機確認: 一覧リンク生存、PRD001（active）で「適用終了」のみ表示、新規追加フォーム表示OK
  - **未コミット**（実機確認完了後にコミット予定）

### PR1 の逸脱メモ（要 deviations.md 反映）
- 計画 Step3 の page.tsx は `referenceDate` を panel へ渡す想定だったが、PR1 パネルはタイムライン非搭載で
  `referenceDate` を使わないため **panel へは渡さず query 用途のみに留めた**。PR2 Step6 で panel へ渡す形へ変更する。

## PR2: 単価改定＋タイムライン（未着手）

- [ ] **Step 4** 単価改定フォーム
  - `schema.ts` に `revisePeriodSchema` 追記、`actions.ts` に `revisePeriodAction` 追記
  - `ReviseForm.tsx` 新規、`PeriodDetailPanel.tsx` に改定モード（`revise`）と導線追加
- [ ] **Step 5** timeline-layout を `(features)/_shared` へ昇格（TDD・中立構造型）
  - 入力を `{ periodId, start, end, status, price }` の中立構造型化（`sellingPrice` 依存除去）
  - `priceLabel` 生成方針（price 引数化 or 呼び出し側整形）は実装時判断・逸脱あれば記録
  - 共通売単価 `_data/timeline-layout.{ts,test.ts}` 削除、`PriceTimeline.tsx` の import 差し替え
- [ ] **Step 6** 原価タイムライン表示
  - `PriceTimeline.tsx` 新規、`PeriodDetailPanel.tsx` にトグル＋帯を組み込み
  - 参照日は page 由来の同一基準日を使う（client で `new Date()` 再計算しない）

## メモ
- E2E は本 issue 範囲外（#504）
- 粗利率可視化はスコープ外（#522 に分離済み）
- Read ツールに表示バグ（末尾 ``` や内容捏造）があったため、原文照合は `cat` で実施した
