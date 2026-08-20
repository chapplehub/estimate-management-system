# Issue #587: App Router のエラー境界（error.tsx / global-error.tsx）を導入する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

App Router にエラー境界を導入し、未処理例外が Next.js デフォルトの 500 画面として露出しないようにする。境界は**最小セット 3 枚**に絞る: ルート `global-error.tsx`（最終防波堤）、`(features)/error.tsx`（通常運用の 500 系 UX。Header 維持＋再試行）、`(features)/not-found.tsx`（既存 `notFound()` 23 箇所を一貫 UI 化）。例外ログは単一の `reportError` シームに隔離し、中身は現状 `console.error`＋`digest` に留める（実監視接続はスコープ外）。設計判断の全体は ADR-20260721-ef0 に恒久化済み。

## 設計判断

`/grill-with-docs` で全論点合意済み。詳細は [ADR-20260721-ef0](../../adr/20260721-ef0-error-boundary-minimal-set-coverage-tradeoff.md) を正とする。要点のみ再掲（本計画で新たな判断は追加しない）。

### 配置粒度・役割分担
- `global-error.tsx`（root）＋ `(features)/error.tsx` ＋ `(features)/not-found.tsx` の 3 枚のみ。機能セグメント細分化はしない。
- auth 配下の例外・`(features)/layout.tsx` 自体の例外・任意 URL のグローバル 404 は、意図的に Next デフォルトに落として割り切る（root `error.tsx` / root `not-found.tsx` は置かない）。

### 共通化
- features 側は薄い共通 `ErrorFallback`（shadcn Card/Button）。`global-error` は重い UI 依存を持たず自己完結（`globals.css` の Tailwind クラスのみで自前描画）。理由: 最終防波堤が共有部品の共倒れで死なないため。

### ロギング接続点
- 単一 `reportError` シームを定義。中身は現状 `console.error`＋`digest`。将来この 1 関数だけを差し替える（Sentry 等の実接続はスコープ外）。

### 表示粒度
- 固定汎用メッセージ＋`digest` を「参照 ID」として表示。`error.message` / stack は UI 非表示。env 分岐なし（本番サニタイズは Next 既定に委ねる）。

### notFound() との境界
- `error.tsx`（想定外例外）と `not-found.tsx`（意図的 404）は直交。`notFound()` は最も近い `not-found.tsx` のみが捕捉し `error.tsx` は捕捉しない。

### テスト方針
- 「捕まえた後に何を描くか」（`ErrorFallback`・`not-found`・`reportError`）のみ検証。「捕まえること」（Next 規約）と E2E・発火配線検証はしない。`global-error` は自前 `<html><body>` で RTL フル render が扱いにくいためテスト省略。

## ステップ

各ステップは関連テストが緑になる単位で区切る（pre-commit の `vitest related` を通す）。

### Step 1: reportError シームを定義する
- [x] **完了**
- 対象ファイル:
  - `src/app/_lib/report-error.ts`（新規）
  - `src/app/_lib/__tests__/report-error.test.ts`（新規）
- テスト戦略: TDD（純関数で期待振る舞いを実装前に言い切れる。`console.error` を spy し、error・`digest`・context を渡して呼ばれることを検証）
- 作業内容:
  - `reportError(error: unknown, context: string)` を実装。`console.error` に context・error・`digest`（あれば）を渡す
  - 将来の監視接続点であることを JSDoc に明記（シームの意図）
- コミットメッセージ: `feat: 例外ログの単一接続点となる reportError シームを定義する (#587)`

### Step 2: ErrorFallback 共通コンポーネントを実装する
- [x] **完了**
- 対象ファイル:
  - `src/app/_components/shared/ErrorFallback.tsx`（新規）
  - `src/app/_components/shared/ErrorFallback.test.tsx`（新規）
- テスト戦略: 実装後テスト（Presentation コンポーネント。RTL unit で検証。ADR に従い E2E はしない）
- 作業内容:
  - props: `reset: () => void`、`digest?: string`。shadcn `Card`/`Button` で構成
  - 固定汎用メッセージ、`digest` がある時のみ「参照 ID: {digest}」を控えめに表示、再試行ボタン（`reset` 呼び出し）、トップへ導線
  - RTL テスト: 文言表示 / digest の条件表示（有無両方）/ ボタン押下で `reset` が呼ばれる / トップリンクの存在
- コミットメッセージ: `feat: エラー表示の共通コンポーネント ErrorFallback を追加する (#587)`

### Step 3: (features)/error.tsx を配置する
- [x] **完了**
- 対象ファイル:
  - `src/app/(features)/error.tsx`（新規）
- テスト戦略: テスト不要（境界の配線は Next 規約が保証。描画内容は Step 2 の ErrorFallback テストで担保済み）
- 作業内容:
  - `"use client"`。props の `error`（`Error & { digest?: string }`）と `reset` を受ける
  - `useEffect` で `reportError(error, "features-boundary")` を呼ぶ
  - `ErrorFallback` に `reset` と `error.digest` を渡して描画（Header は layout 側に残る）
- コミットメッセージ: `feat: (features) 配下のエラー境界 error.tsx を配置する (#587)`

### Step 4: (features)/not-found.tsx を配置する
- [x] **完了**
- 対象ファイル:
  - `src/app/(features)/not-found.tsx`（新規）
  - `src/app/(features)/not-found.test.tsx`（新規、RTL で中身のみ検証）
- テスト戦略: 実装後テスト（静的コンポーネント。RTL unit で文言・戻り導線を検証。`notFound()` 由来のため props 無し・`use client` 不要）
- 作業内容:
  - 「見つかりませんでした」旨の固定メッセージと一覧/トップへの戻り導線を描画（Header は layout 側に残る）
  - `error.tsx` と直交する意図（意図的 404）をコメントで明示
  - RTL テスト: 文言表示・戻りリンクの存在
- コミットメッセージ: `feat: (features) 配下の 404 境界 not-found.tsx を配置する (#587)`

### Step 5: global-error.tsx を配置する
- [x] **完了**
- 対象ファイル:
  - `src/app/global-error.tsx`（新規）
- テスト戦略: テスト不要（自前 `<html><body>` を描き RTL フル render が扱いにくいため ADR でテスト省略を決定。中身は依存の無い自己完結 markup）
- 作業内容:
  - `"use client"`。自前で `<html lang="ja"><body>` を描く（ルート layout を差し替えるため）
  - 重い UI 依存（shadcn/フォント/共通 ErrorFallback）を持たず、`globals.css` の Tailwind クラスのみで素朴に描画
  - `useEffect` で `reportError(error, "global-error")` を呼ぶ。固定メッセージ＋`reset()` 再試行＋（あれば）参照 ID
- コミットメッセージ: `feat: ルート layout 例外の最終防波堤 global-error.tsx を配置する (#587)`
