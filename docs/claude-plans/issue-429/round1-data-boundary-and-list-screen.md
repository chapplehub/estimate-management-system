# 共通売単価 保守画面 FE変換 — ラウンド1（データ境界＋一覧画面）

## Context

claude.ai design のプロトタイプ（`docs/design/common-selling-price-maintenance/`）を、本プロジェクト規約（Next.js App Router / React 19 / Tailwind / DDD）のコンポーネントへ変換する。BE基盤（#466）は未実装のため、`grill-with-docs` で **プレゼンテーション層先行（モック境界）** と合意済み。本ラウンドはその第1スライス＝**データ境界＋一覧画面（UC-1）**のみ。詳細・フォームは次ラウンド。

設計合意の全体は `docs/claude-plans/issue-429/fe-conversion-plan.md`（作成済み）に記録。用語正準＝`CONTEXT.md`「価格」節、ユースケース＝`docs/claude-plans/issue-429/use-cases.md`。

## 進め方（コミット単位）

ユーザ指示により **まず計画ファイルをコミット**してから実装に入る。

### コミット1: 計画ファイル
- `docs/claude-plans/issue-429/fe-conversion-plan.md`（作成済み・設計合意10項目とモック境界構造）
- type: `docs:`

### コミット2: データ境界（モック）
配置: `src/app/(features)/common-selling-prices/_data/`
- `types.ts`（**作成済み**）— 読みモデルDTO（`CommonSellingPriceListItem` / `PeriodDetail` / version付き `CommonSellingPriceDetail` / `PeriodState` / `ProductPriceStatus`）。#466の読みモデル仕様への逆フィードを兼ねる。
- `mock-store.ts` — インメモリ・ストア。プロトタイプのシード（PRD001〜015、`docs/.../共通売単価 保守画面.dc.html` の `seed()`）を流用。集約 `{ productCd, productName, version, periods[] }`。`REFERENCE_DATE='2026-06-27'` を1箇所に集約（参照日注入点）。読み取りのみ（ミューテータは次ラウンド）。
- `queries.ts` — 将来の QueryService と同形の async 関数 `fetchCommonSellingPriceList()` / `fetchCommonSellingPriceDetail(productCd)`。`import "server-only"`。プロトタイプの `classify`/`prodStatus` ロジックでDTOへ射影。#466完成時は**中身だけ** Factory→QueryService に差し替え。
- type: `feat:`

### コミット3: 一覧画面（UC-1）
配置: `src/app/(features)/common-selling-prices/`
- `page.tsx` — Server Component。`products/page.tsx` を範とする。`verifySession` → `searchParams` → `fetchCommonSellingPriceList(criteria)` → `DataTable`。`SearchForm`（`@/app/_components/shared/SearchForm`）＋ `DataTable`（同 shared）＋ `getStringParam`/`LIST_FETCH_LIMIT`（`@/app/_lib/searchParams`）を再利用。
- `_components/columns.tsx` — `ColumnDef`。列＝商品コード（詳細リンク `/common-selling-prices/[productCd]`）・商品名・現在有効単価（`active`は金額、`unset`/`lapsed`は `Badge` で「未設定」「失効中」表示）。`Badge` は `@/app/_components/shadcnui/badge`。
- 絞り込み: 商品コード（text・部分一致）・商品名（text・部分一致）・絞り込み（select「すべて/未設定のみ」）。SearchFormにcheckbox型が無いため未設定は select で表現（共有部品は改変しない）。
- App シェル（ヘッダー/フッター）は `(features)` ルートグループのレイアウトを継承（プロトタイプがヘッダー/フッターを省いていた箇所）。
- type: `feat:`

## 設計判断（fe-conversion-plan.md 抜粋）

- ルーティング: ページ分割 `/common-selling-prices`（一覧）＋ `/[productCd]`（明細・次ラウンド）。
- 書き込み: インメモリ・ストア（本ラウンドは読みのみ）。
- 楽観ロック: version 往復＋Action bump（DTOに version 同梱・次ラウンドで使用）。
- 状態別編集/削除（将来/現在有効/失効）・統一 `PeriodForm`・インラインパネルは**次ラウンド**。

## 検証

- `pnpm lint`（新規ファイルの規約適合）
- `pnpm test`（既存テストの非回帰。本ラウンドはFE表示のみで純粋関数のテスト追加は任意）
- 手動: `pnpm dev` → `/common-selling-prices` で一覧表示・コード/名検索・「未設定のみ」絞り込み・現在有効単価/未設定/失効中バッジ・詳細リンク（リンク先は次ラウンドで実装）を確認。
- DDD制約: 本ラウンドはFE層のみ。Domain層には触れない。

## スコープ外（次ラウンド）

詳細ページ（UC-2）、`PeriodForm`（UC-3/4/5）、適用終了の状態ロック、削除ガード、改訂ウィザード、timeline 表示、ストアのミューテータ＋Server Action。
