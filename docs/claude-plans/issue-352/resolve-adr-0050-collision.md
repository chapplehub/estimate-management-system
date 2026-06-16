# ADR-0050 番号衝突の解消（#352）

## Context

並行 worktree の独立採番ドリフトにより `docs/adr/` に **ADR-0050 が2ファイル**存在し、両方 committed されている。
そのため src・docs 中の "ADR-0050" 参照が文脈によって別 ADR を指す状態になっており、番号の一意性（ADR-0000 が掲げる「ADR-0003 と言えばプロジェクト全体で一意」原則）が崩れている。

衝突2ファイル（両者とも起票日 2026-06-15・採用）:

- `0050-serialize-dynamic-line-array-as-json-hidden-field.md`（#346/S4 由来）
- `0050-list-representative-variation-selection-as-read-model-concern.md`（#347/#344 由来）

**方針:** 参照が src 全体に広く散り #333 S5 にも継承される `serialize-dynamic-line-array` を **0050 に残す**。
参照が query/DTO 系に閉じている `list-representative-variation-selection` を、本 issue 用に確保済みの **0051** へリネームする（張り替えコスト最小）。

## 影響範囲（調査済み）

`list-representative`（→ 0051 へ張り替え）を指す ADR-0050 参照:

- ADR 本体: `docs/adr/0050-list-representative-variation-selection-as-read-model-concern.md`（L1 見出し）
- `docs/adr/INDEX.md` L85（「アプリケーション（クエリ・DTO）」節）
- src（コメントのみ・挙動変更なし）:
  - `infrastructure/queries/PrismaEstimateQueryService.ts`
  - `application/queries/EstimateQueryService.ts`
  - `application/queries/dto/EstimateSummaryDTO.ts`
  - `application/factories/estimateQueryFactory.ts`
  - `application/queries/dto/EstimateSearchCriteria.ts`
  - `application/queries/__tests__/SearchEstimatesQuery.test.ts`
- 計画docs: `docs/claude-plans/issue-344/search-estimates-query.md`（L7 / L11 / L62）

`serialize-dynamic-line-array`（→ **0050 のまま据え置き**・変更しない）を指す参照:

- `docs/adr/0050-serialize-dynamic-line-array-as-json-hidden-field.md`、`INDEX.md` L43、
  `app/(features)/estimates/[estimateNumber]/` 配下各ファイル、`docs/claude-plans/issue-332/variation-content-edit-c4.md`

## 実装ステップ（1ステップ = 1コミット）

### Step 1: ADR 本体のリネーム + 見出し更新
- `git mv docs/adr/0050-list-representative-variation-selection-as-read-model-concern.md docs/adr/0051-list-representative-variation-selection-as-read-model-concern.md`
- 新ファイル L1 見出し `# ADR-0050:` → `# ADR-0051:`、`最終更新日` を 2026-06-16 に更新

### Step 2: INDEX.md の重複エントリ解消
- L85 のリンクテキスト `[0050]` → `[0051]`、リンク先ファイル名を `0051-...md` へ更新（節「アプリケーション（クエリ・DTO）」はそのまま）
- L43（serialize 側）は変更しない

### Step 3: src 内コメント参照の張り替え（ADR-0050 → ADR-0051）
- 上記 src 6ファイルの `list-representative` 文脈の "ADR-0050" のみを "ADR-0051" へ置換
- `EstimateSummaryDTO.ts` の `ADR-0033 / ADR-0050` は 0050 部分のみ 0051 に（0033 は据え置き）

### Step 4: 計画docs の参照張り替え
- `docs/claude-plans/issue-344/search-estimates-query.md` L7/L11/L62 の "ADR-0050" → "ADR-0051"

### Step 5: 計画記録の永続化
- 本ファイルを保存・コミット

## 検証

- `grep -rn "ADR-0050" .`（node_modules 除く）の残存が **serialize-dynamic-line-array（S4）側のみ**を指すこと
- `grep -rn "ADR-0051" .` の参照がすべて list-representative ADR・新ファイルを指すこと
- `ls docs/adr/ | grep '^0050'` が1件のみ、`^0051` が1件のみ
- `INDEX.md` に 0050・0051 が各1回ずつ・番号重複なし
- `pnpm lint`

## 受け入れ条件との対応

- `docs/adr/` に同一インデックスの ADR ファイルが存在しない → Step 1
- INDEX.md に各 ADR が1回だけ・番号重複なし → Step 2
- リネームした ADR への参照が新旧で齟齬なく解決 → Step 3/4 + 検証 grep
- 再発防止運用の追記 → 本 issue ではスコープ外（ユーザー判断で見送り）
