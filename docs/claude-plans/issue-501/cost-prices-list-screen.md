# Issue #501: 原価 一覧画面（cost-prices）とダッシュボード導線 — 実装計画

## 概要

原価の一覧画面 `src/app/(features)/cost-prices/` とダッシュボード導線を、共通売単価一覧（#429 / #477 / #479）と同型で実装する。グリルセッションでの合意により、Issue 原文のスコープに加えて**適用期間列の追加**（#500 でマージ済みの一覧読みモデルの拡張を含む）と**一覧 E2E** を本 Issue に含める。共通売単価側への適用期間列の追加は #513 として起票済み（同型仕様をコメントで共有済み）。

実装は `/tdd`（red→green→refactor）で進める。各ステップは「テストを先に書いて red を確認 → 実装で green」の順に構成している。

## 設計判断

### 適用期間列の追加（Issue 未決事項の解決）

- A. 共通売単価と同構成の3列（期間列なし・追加コストゼロ）
- B. 適用期間列を追加（マージ済み読みモデル #500 の DTO・SQL・テストの拡張を伴う）
- 採用: B。ユーザー判断でスコープに含めることを決定。共通売単価側も同型で揃えるため #513 を起票

### 適用期間列に出す内容

- A. 現在有効行の期間のみ表示。lapsed / unset は空欄（状態は単価列のバッジが伝える）
- B. lapsed 行に直近期間（過去 or 将来）も表示
- 採用: A。列の意味が「現在有効原価の適用期間」と一義になり、読みモデル変更が有効行の `lower()` / `upper()` の SELECT 追加だけで済む。失効商品の期間の全貌は後続の保守画面（タイムライン）の責務

### 終了日の表示セマンティクス

- A. 保守画面（`PeriodDetailPanel`）と同じ半開区間の排他上端を生値表示。`null` は「無期限」
- B. 一覧のみ包含端（end − 1日）へ変換
- 採用: A。一覧→保守画面で同じ日付が見えることを優先。変換ロジックを一覧だけに持ち込まない

### DTO の期間フィールド表現

- `CostPriceListItemDTO` に `currentPeriodStart: string | null` / `currentPeriodEnd: string | null` を追加
- `start` が null ＝有効行なし（lapsed / unset）、`start` あり・`end` null ＝無期限、の2フィールドで多義を捌く（編集 DTO の `end: null`＝無期限の既存意味論と整合）

### formatYenFromDecimal の複製 vs 昇格

- A. `cost-prices/_components/` へ複製
- B. `(features)/_shared/formatYen.ts` へ昇格し、共通売単価側の import も差し替え
- 採用: B。集約非依存の表示用純関数であり、DTO の「集約ごとに複製」規約（ADR-20260627-a5c）の適用外。`(features)/_shared/error-handler.ts` の前例に従う。新設の `formatPeriod` も同所に配置（#513 が同じものを使うことが確定済み）

### 商品コード列のリンク

- A. 今回はリンクなし（後続の保守画面 Issue でリンク化）
- B. `/cost-prices/[productCd]` へ先行リンク（保守画面実装までデッドリンク）
- 採用: B。ユーザー判断でデッドリンク許容。コミットボディに判断理由を記載すること

### E2E のスコープ

- 一覧 E2E（`cost-prices-list.e2e.ts`）を本 Issue に含める。3状態（active / lapsed / unset）は時間依存の派生状態で、読みモデル SQL（`daterange @> 参照日`）の正しさはユニットテストでは検証できないため
- 原価用の today 相対シード帯（PRD84x・ADR-20260629-3x5 準拠）を新設する。既存 PRD82x 帯は「原価集約を作らない」前提で共通売単価 E2E が依存しているため**触れない**
- ダッシュボード導線は `dashboard.e2e.ts` へ遷移テストを追記（#479 の「共通販売単価管理に遷移できる」と同型）

### ダッシュボードカードの文言

- 完全同型: `title: "原価管理"` / `description: "原価の一覧表示・編集を行います。"`。編集（保守画面）は後続 Issue だが、デッドリンク許容の判断と整合させ文言修正の宿題を作らない

### 検索フォーム

- Issue 記載どおり商品コード・商品名・「未設定のみ」絞り込み（模倣元と同型）。DTO が対応する lapsed 絞り込みは露出しない。判断不要（Issue で確定済み）

## ステップ

### Step 1: 一覧読みモデルに現在有効期間を追加（unit TDD）

- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCostPriceListQueryService.test.ts`
  - `src/server/subdomains/pricing/application/queries/dto/CostPriceListItemDTO.ts`
  - `src/server/subdomains/pricing/application/queries/CostPriceListQueryService.ts`（doc コメント更新）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCostPriceListQueryService.ts`
- 作業内容:
  - 既存テストに `currentPeriodStart` / `currentPeriodEnd` の期待を追加（active＝有界・無期限、lapsed / unset＝両方 null）して red を確認
  - DTO にフィールド追加、SQL に有効行の `lower()` / `upper()` を SELECT 追加して green（母集合・JOIN 構造は変えない）
- コミットメッセージ: `feat: 原価一覧読みモデルに現在有効期間（currentPeriodStart/End）を追加`

### Step 2: formatYenFromDecimal を (features)/_shared へ昇格

- 対象ファイル:
  - `src/app/(features)/_shared/formatYen.ts`（移動先）
  - `src/app/(features)/_shared/formatYen.test.ts`（新規）
  - `src/app/(features)/common-selling-prices/_components/formatYen.ts`（削除）
  - `src/app/(features)/common-selling-prices/_components/columns.tsx`（import 差し替え）
- 作業内容:
  - 移動前に現挙動を固定するユニットテストを新設（`"1000.00"`→`¥1,000`、`"12.50"`→`¥12.5`、負数、桁区切り）
  - ファイルを `_shared` へ移動し、共通売単価側の import を差し替え。既存テスト（`pnpm test`）が通ることを確認
- コミットメッセージ: `refactor: formatYenFromDecimal を (features)/_shared へ昇格`

### Step 3: 適用期間表示ヘルパー formatPeriod を新設（unit TDD）

- 対象ファイル:
  - `src/app/(features)/_shared/formatPeriod.test.ts`（先に作成）
  - `src/app/(features)/_shared/formatPeriod.ts`
- 作業内容:
  - red: 有界期間（`"2026-01-01 〜 2026-12-31"`）・無期限（`"2026-01-01 〜 無期限"`）のテストを先に書く
  - green: 排他上端の生値表示・`end: null`＝無期限の純関数を実装（半開区間の変換はしない）
- コミットメッセージ: `feat: 適用期間表示ヘルパー formatPeriod を (features)/_shared に追加`

### Step 4: 原価 E2E 用の today 相対シード帯（PRD84x）を追加

- 対象ファイル: `prisma/seed-e2e.ts`
- 作業内容:
  - 原価3状態＋期間表示検証用の商品を新設: active・有界期間 / active・無期限 / lapsed（過去期間のみ）/ unset（原価集約なし）
  - ADR-20260629-3x5 に従い today 相対で期間を生成。既存 PRD82x 帯（原価集約なし前提）には手を触れない
  - `pnpm e2e:seed` で既存 E2E が壊れないことを確認
- コミットメッセージ: `test: 原価一覧E2E用のtoday相対シード帯（PRD84x）を追加`

### Step 5: 原価一覧画面の実装（E2E red → green）

- 対象ファイル:
  - `src/app/(features)/cost-prices/cost-prices-list.e2e.ts`（先に作成）
  - `src/app/(features)/cost-prices/page.tsx`
  - `src/app/(features)/cost-prices/_components/columns.tsx`
- 作業内容:
  - red: `common-selling-prices-list.e2e.ts` と同型の一覧 E2E（表示・コード検索・名前検索・3状態表示）＋適用期間列の検証（有界・無期限・lapsed/unset 空欄）を先に書く
  - green: `page.tsx`（SearchForm + DataTable、H1「原価」/ H2「原価一覧」、未設定絞り込み）と `columns.tsx`（商品コード＝`/cost-prices/[productCd]` へ先行リンク・商品名＋無効バッジ・現在有効原価＋未設定/失効中バッジ・適用期間）を実装
  - 列は BE DTO 素通し（ADR-0069・変換層を挟まない）。`formatYenFromDecimal` / `formatPeriod` は `_shared` から import
  - `pnpm e2e` で green を確認
- コミットメッセージ: `feat: 原価一覧画面（cost-prices）を追加`（ボディにデッドリンク先行の判断理由を記載）

### Step 6: ダッシュボード導線（E2E red → green）

- 対象ファイル:
  - `src/app/(features)/dashboard/dashboard.e2e.ts`（「原価管理に遷移できる」を追記）
  - `src/app/(features)/dashboard/page.tsx`
- 作業内容:
  - red: #479 同型の遷移テスト（カード表示→クリック→ `/cost-prices` ＋ H1 確認）を先に書く
  - green: カード（`href: "/cost-prices"` / `title: "原価管理"` / `description: "原価の一覧表示・編集を行います。"`）を追加
- コミットメッセージ: `feat: ダッシュボードに原価管理カードを追加`
