# Issue #633: read/query系 Server Action の未捕捉例外に対するエラーハンドリング方針を統一する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

read/query 系 Server Action（生データを返す系）の裸 await 箇所で非業務例外（DB 障害・ネットワーク断・想定外例外）が throw されると無言失敗する問題を、呼び出し層の共通ラッパー `callReadAction` で統一的に処理する。方針の全体は **ADR-20260723-h7r** に記録済み（本計画はその実装）。

- ラッパー: catch → `reportError(error, context)` 全件記録 → 固定 ID toast（重複 1 枚に統合）→ `undefined` 返却
- 呼び出し側: `undefined` なら操作中断・state 凍結（ダイアログは開いたまま・古い表示を維持）
- セッション切れは `verifySession` の redirect + reason toast で自己完結済みのため、ラッパーでの特別扱いは不要

## 設計判断

すべて /grill-with-docs セッションで確定し、ADR-20260723-h7r に記録済み。

### 方式の選択（issue の (a)/(b)/(c)）
- A. read 系も `ActionResult` エンベロープ化して戻り値分岐に統一
- B. 呼び出し層の共通ラッパー + toast + reportError
- C. 現状の裸 await を許容し明文化
- 採用: B（read 系には業務エラーが存在せず、エンベロープは情報量ゼロの分岐を増殖させる。error boundary はイベントハンドラ内 async 例外を捕捉できず境界案は不成立）

### 失敗時契約
- `Promise<T | undefined>` の sentinel 方式。`null` は業務値（税率未設定・商品の並行削除）と衝突するため `undefined` を使う
- context は呼び出す Server Action の**関数名リテラル**（例: `"getProductSuggestions"`）。動的組み立て禁止（grep 到達性優先）
- toast は固定文言「データの取得に失敗しました。時間をおいて再度お試しください。」+ `{ id: "read-action-failed" }` で重複統合
- `reportError` の接頭辞は `[error-boundary]` → `[report-error]` に一般化（境界以外からも呼ばれるため）

### 失敗時の呼び出し側挙動（統一ルール: 操作中断・state 凍結）
- `handleProductSelect`: 既存 null ガードに `undefined` も乗せ、1 件も追加しない
- `resolvePricesFor` 失敗: 選択操作全体を中断（ラッパー適用はヘルパー内部 1 箇所、161/230 共通）
- `requestSuggestions`: ダイアログを開かず終了。`selectionError` は触らない（toast と二重表示になるため）
- `confirmSuggestions`: 行を挿入せず、サジェストダイアログは開いたまま（再確定でリトライ可能）
- 税率解決（CreateEstimateForm / DuplicateEstimateModal）: 表示中の税率を維持。`null`（税率未設定）に落とさない
- `SelectionModal`: 検索結果を維持。requesting フラグは既存 finally が戻す

### テスト方針
- ラッパーは「捕まえた後に何をするか」（`undefined` 返却・reportError 呼び出し・toast 発火）のみ unit で検証
- 9 箇所の配線自体の E2E は足さない（ADR-20260721-ef0 の検証方針と同型）

## ステップ

### Step 1: ADR 起票
- [x] **完了**（コミット ff7417cd）
- 対象ファイル: `docs/adr/20260723-h7r-read-action-raw-return-client-wrapper-over-result-envelope.md`, `docs/adr/INDEX.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 方針決定を ADR として記録し INDEX に登録
- コミットメッセージ: `docs: read/query系Server Actionの非業務例外を呼び出し層ラッパーに集約するADRを追加 (#633)`

### Step 2: callReadAction 新設 + reportError 接頭辞一般化
- [ ] **完了**
- 対象ファイル: `src/app/_lib/callReadAction.ts`（新規）, `src/app/_lib/__tests__/callReadAction.test.ts`（新規）, `src/app/_lib/report-error.ts`, `src/app/_lib/__tests__/report-error.test.ts`（存在すれば接頭辞の期待値を更新）
- テスト戦略: TDD（純粋なクライアントユーティリティで、期待する振る舞い＝成功時の透過・失敗時の `undefined` / reportError / toast を実装前に言い切れる。sonner と reportError は vi.mock で spy する）
- 作業内容:
  - `callReadAction<T>(action: () => Promise<T>, context: string): Promise<T | undefined>` を実装
  - 失敗時: `reportError(error, context)` → `toast.error(固定文言, { id: "read-action-failed" })` → `undefined`
  - `report-error.ts` のログ接頭辞を `[error-boundary]` → `[report-error]` に変更
- コミットメッセージ: `feat: read/query系Server Action呼び出しの共通ラッパー callReadAction を追加 (#633)`

### Step 3: useVariationLineEditor の 5 呼び出しに適用
- [ ] **完了**
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts`
- テスト戦略: テスト不要（配線のみ。捕捉後の挙動は Step 2 の unit が担保し、既存の関連テストの green は pre-commit の vitest related が担保する。ADR の「配線はテストしない」方針）
- 作業内容:
  - `expandSetComponents` / `getProductLineSnapshot` / `getProductSuggestions` の呼び出しを `callReadAction` で包む（context は各関数名リテラル）
  - `resolvePricesFor` 内部の `resolveSellingPricesForDisplay` 呼び出しを包む（161/230 共通・context `"resolveSellingPricesForDisplay"`）
  - 失敗時挙動を統一ルールどおりに実装（`handleProductSelect` は 1 件も追加しない / `requestSuggestions` は `selectionError` を触らず終了 / `confirmSuggestions` はダイアログを開いたまま）
- コミットメッセージ: `fix: 明細編集の read系Server Action呼び出しを callReadAction で包み無言失敗を解消する (#633)`

### Step 4: 残り 3 コンポーネントに適用
- [ ] **完了**
- 対象ファイル: `src/app/(features)/estimates/new/CreateEstimateForm.tsx`, `src/app/(features)/estimates/[estimateNumber]/DuplicateEstimateModal.tsx`（実パスは適用時に確認）, `SelectionModal.tsx`
- テスト戦略: テスト不要（Step 3 と同じ理由）
- 作業内容:
  - `resolveEffectiveTaxRate` の 2 呼び出しを包む（失敗時は表示中の税率を維持、`null` に落とさない）
  - `SelectionModal` の `search*ForSelection` 呼び出しを包む（失敗時は検索結果を維持。context は渡された Action の関数名リテラルを親から受ける形にせず、まず `SelectionModal` 内の単一適用点で対応できるか実装時に確認し、リテラル制約を守れる最小の形を選ぶ）
  - `LineEditTable.tsx:307` の try-finally はそのまま（requesting フラグ復帰用。フィードバックはフック側の適用で解消される）
- コミットメッセージ: `fix: 税率解決と選択モーダル検索を callReadAction で包み無言失敗を解消する (#633)`
