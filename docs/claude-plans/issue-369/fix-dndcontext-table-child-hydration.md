# Issue #369: 見積編集画面でバリエーション複製時に DndContext が `<table>` 直下に入り hydration エラーが2件出る — 実装計画

## 概要

`LineEditTable`（明細編集テーブル・D&D あり）が `<DndContext>` を `<table>` の**直接の子**として描画しているため、`DndContext` がアクセシビリティ用に出力する `<div id="DndDescribedBy-*" style="display:none">`（`HiddenText`）が `<table>` の直接の子になり、HTML 構造違反 → Next.js の hydration エラーが2件発生する。

- エラー1: `In HTML, <div> cannot be a child of <table>.`
- エラー2: `<table> cannot contain a nested <div>.`

バリエーション2を選択中に「複製」を押すと、複製フォーム（`VariationCreateForm kind="duplicate"` → `VariationLineEditor` → `LineEditTable`）が描画される経路でこの構造が表に出る。複製処理自体は成功しており、純粋に DOM 構造／hydration の不具合。

**修正**: `DndContext` / `SortableContext`（トップレベル）を `<table>` の**外側**へ移動し、`<table>` の直接の子を `<thead>` / `<tbody>` のみにする。dnd-kit は DOM ツリー構造に依存せず動作するため、ラッパーをテーブル外へ出しても並べ替え機能は維持される。

Playwright で再現確認済み（`N9905001` → バリエーション2 → 複製で Dev Tools の Issue バッジが 1→3 に増加、増分2件がエラー1/2と一致）。

## 設計判断

### DndContext / SortableContext の配置先
- A. `<table>` の外側（`overflow-x-auto` ラッパー直下）に移動し、その内側に `<table>` を置く
- B. `<DndContext>` を `<tbody>` として描画させる（`asChild` 的手法）等で table 直下の構造を保つ
- 推奨: **A**。dnd-kit はコンテキストプロバイダであり描画位置に制約がないため、テーブル外へ出すのが最も素直で副作用がない。並べ替え対象の各行（`<tr>`）の `useSortable` は変更不要で、機能はそのまま維持される。

### トップレベル `SortableContext` の `items` と `<tbody>` の関係
- 現状: `DndContext > SortableContext > tbody > (tr...)`
- 変更後: `DndContext > SortableContext > table > thead + tbody > (tr...)`
- 判断不要（既存の入れ子 `SortableContext`（セット群構成行用・`SetGroupRows` 内）は `<tbody>` 内の `<tr>` 群をラップしているだけで table 直下ではないため、構造違反ではない＝変更不要）。

### テスト方式（TDD）
- jsdom 上で `LineEditTable` を render し、`<table>` の直接の子に `<div>` が存在しないことをアサート（`table` の `:scope > div` が無いこと）。
- 修正前は `HiddenText` の `<div>` が table 直下に出るため Red、修正後 Green になる。
- 既存 `components/LineTable.test.tsx` と同じ流儀（`@testing-library/react` の `render` + DOM 直接検査）。`WorkingNode`（`WorkingLine`）のテスト用ビルダを新規に用意する。

## ステップ

### Step 1: Red — `<table>` 直下に `<div>` を持たないことを検証するテストを追加
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/components/LineEditTable.test.tsx`（新規）
- 作業内容:
  - `WorkingLine` / `WorkingNode` のテスト用ビルダを定義（`variationLines.ts` の型に準拠）
  - `LineEditTable` を最小 props（`nodes` に通常明細1件、各ハンドラは `vi.fn()`／no-op）で render
  - 「`<table>` の直接の子は `<thead>`/`<tbody>` のみで、`<div>` を持たない」ことをアサート
    - 例: `expect(container.querySelector("table > div")).toBeNull()`
  - 念のためセット群（`setGroup` + 構成行）を含むケースも追加し、構造が崩れないことを確認
  - この時点ではテストは**失敗（Red）**することを確認
- コミットメッセージ: `test: LineEditTable の table 直下に div が無いことを検証（#369 Red）`

### Step 2: Green — DndContext / SortableContext を `<table>` の外側へ移動
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/components/LineEditTable.tsx`
- 作業内容:
  - `return` 構造を `<div className="overflow-x-auto border rounded"> > <DndContext> > <SortableContext> > <table>（thead+tbody）` の順に組み替える
  - `<table>` の直接の子が `<thead>` と `<tbody>` のみになるよう修正
  - 既存の各行 `useSortable`（`EditRow` / `GroupHeaderRow`）・`handleDragEnd`・センサー類は変更しない
  - Step 1 のテストが**通る（Green）**ことを確認
- コミットメッセージ: `fix: LineEditTable の DndContext を table 外へ移動し hydration エラーを解消 (#369)`

### Step 3: 画面での回帰確認（Playwright）
- 対象ファイル: なし（手動確認）
- 作業内容:
  - `N9905001` → バリエーション2選択 → 複製で、コンソールに `<div> cannot be a child of <table>` / `<table> cannot contain a nested <div>` が出ないこと（Dev Tools Issue バッジが増えないこと）を確認
  - 明細行の D&D 並べ替えが従来通り機能することを確認
  - 既存テスト・lint をパスすること（`pnpm test` / `pnpm lint`）
- コミットメッセージ: （コード変更が無ければコミット不要。確認のみ）
