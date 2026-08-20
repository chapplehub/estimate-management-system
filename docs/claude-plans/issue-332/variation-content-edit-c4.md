# Issue #332: 見積詳細画面 S4 バリ内容編集・通常明細（C4） — 実装計画

## 概要

見積詳細画面の縦スライス S4。バリエーション内容（通常明細の追加・削除・インライン編集・D&D、全体値引、メモ）を C4（`UpdateVariationCommand` ＝内容の宣言的全置換 `replaceContent`）へ配線する。本体商品追加時に周辺商品（`ProductRelation`）を通常行として提案するサジェスト UX を含む。S2 閲覧画面の `VariationPanel` を編集可能なクライアントアイランド化し、S3 ヘッダー編集（C2）とは独立した編集トグルを持たせる。

C4 はセット群を表現できない（`VariationContent` に setGroups が無く `replaceContent` は `_items` のみ全置換）ため、S4 の編集対象は「セット群なし・非改訂・有効」バリに限定する。セット書き込みは S5 のスコープ。

- 設計方針: docs/design/estimate-detail/analysis/02_差分一覧と本実装方針.md §2(D6) / §3-6 / §4(S4)
- 行 UI 仕様: docs/design/estimate-detail/uploads/見積詳細画面_行コンポーネント改良指示書.md
- 新規 ADR: docs/adr/0050-serialize-dynamic-line-array-as-json-hidden-field.md

## 設計判断

会話（grill-with-docs）で合意済み。

### 1. 編集境界（セット群を含むバリの扱い）
- A. セット群なし・非改訂・有効バリのみ編集可。それ以外は編集 UI を抑止（採用）
- B. セット群を read-only 温存しつつ通常明細だけ編集（C4 拡張が必要＝S5 侵食）
- C. 全バリ編集可、保存時にセット群があれば弾く（後出しエラー）
- 採用理由: ドメイン3ガード（`assertEditable` 無効を弾く／`assertLineStructureMutable` 改訂先を弾く／`replaceContent` が `_items` のみ）と UI 編集可否を一致させる。最終強制はドメイン、UI 抑止は二重防御の外側（S3 のヘッダーロックと同型）。

### 2. 編集モードの UX 構造
- 編集トグルはヘッダー編集（C2）と独立、`VariationPanel` 内に持つ（C2/C4 は別コマンド・別保存単位）
- 編集スコープはアクティブなバリ1件のみ
- 編集中のタブ切替は破棄確認（未保存の作業コピーが消えるため）
- 保存成功で redirect→再マウントで閲覧へ戻る（S3 と同型）

### 3. 動的明細配列のシリアライズ（→ ADR-0050）
- A. conform field-array（idiomatic・プログレッシブエンハンスメント）
- B. 単一 JSON hidden field ＋ zod `transform(JSON.parse).pipe(...)`（採用）
- C. conform を捨てて全 state＋JSON hidden
- 採用理由: 明細はモーダル選択・インライン編集・D&D で本質的にクライアント state が真実。conform は送信トランスポート＋エラー表示の器として残す。sortOrder は配列順を真実とし submit 時に index から導出。

### 4. 新規行の作成フローとスナップショット
- 「明細追加」は商品選択モーダル必須（`product_id` は必須 FK）
- 商品名・単位は選択時スナップショットで固定表示（インライン編集不可、変更は再選択）
- 既定値: 数量1・掛率1.0・値引0・単価0（販売単価マスタ未確定＝要入力）・メモ空
- インライン編集可の列: 数量・単価・掛率・値引・顧客メモ・社内メモ

### 5. 削除と空バリ
- 削除確認ダイアログなし（保存までは作業コピー上の操作、キャンセルで戻る）
- 明細ゼロのバリ保存も許可（ドメインが空配列を明示的に許可・独自 UI ガードは足さない）

### 6. 周辺商品サジェスト（D6）
- 本体追加直後に提案ダイアログ（採用）／非モーダルのインライン帯（不採用）
- ダイアログのチェックは既定チェック済み（追加寄り）
- 提案元: `findById(本体).relatedProducts`（有効のみ）。挿入行は通常行扱い（親に金額集約しない）
- 細目: カスケードなし（1段のみ）／有効のみ／挿入行の数量＝relation の quantity・他は新規行既定
- 注: `ProductRelationDTO` は unit/isActive を持たないため、提案対象ごとに `findById(周辺)` で unit・isActive を引く（実装詳細）

### 7. D&D の実装手段
- A. dnd-kit を S4 で導入（採用）／B. ネイティブ HTML5 を S4 限定で使い導入を S5 へ先送り
- 採用理由: 指示書 §5 のセット対応 D&D（グループ移動・制約付きドロップ・ゴースト）は S5 で必要。S4 でフラット並び替えの土台を入れ S5 が拡張するのが無駄がない
- sortOrder は submit 時に配列 index から 1..N を導出
- 注: dnd-kit の React 19 対応版を install 時に確認

### 8. 編集中の金額表示
- A. クライアント簡易ライブプレビュー（採用）／B. 保存後にドメイン確定値を反映
- 採用理由: 数量・単価変更で金額が動くのは当然期待される。確定値はドメイン（ADR-0033/0028）が唯一の真実で、保存後 DTO で上書き。プレビューは概算（端数が最大1円ずれうる前提）

### 9. メモ全文編集ポップオーバー（§5 残課題）
- S4 は暫定のインライン Textarea rows=2 のみ実装。ポップオーバーの要否は未決の残課題として保留（S5 が必ず決める義務はない）

### 10. Server Action / 楽観ロック
- version は親見積（集約ルート）の version を hidden で往復（ADR-0039・DTO トップレベル）。競合は `handleCommandError` でフォームエラー化
- 骨格は S3 `updateEstimateHeader` と同型: parseWithZod → estimateNumber と form の variationId で対象特定（estimateId は DTO 解決）→ `checkTaxRateThenSave` の `TaxCheckedSaveResult` 処理 → `taxRateMismatch` はフォームエラーで編集維持 → 成功で revalidatePath＋redirect
- 改訂価格列は S4 編集対象（非改訂）では常に null＝「—」表示・編集不可

## ステップ

### Step 1: ADR-0050 を記録（完了済）
- 対象ファイル: docs/adr/0050-serialize-dynamic-line-array-as-json-hidden-field.md, docs/adr/INDEX.md
- 作業内容:
  - 動的明細配列の JSON hidden 往復方式を ADR 化（conform 慣行からの意図的逸脱を記録）
  - INDEX.md「アプリケーション（フロントエンド・認可）」へ追記
- コミットメッセージ: `docs: 動的明細配列の JSON hidden 往復方式を ADR-0050 として記録（#332）`

### Step 2: dnd-kit 依存追加
- 対象ファイル: package.json, pnpm-lock.yaml
- 作業内容:
  - `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/modifiers` を追加（React 19 対応版を確認）
- コミットメッセージ: `build: 通常行 D&D 基盤として dnd-kit を追加（#332）`

### Step 3: バリ内容編集の入力スキーマ（JSON transform）
- 対象ファイル: src/app/(features)/estimates/[estimateNumber]/variationSchema.ts（新規）
- 作業内容:
  - 明細1件の zod schema（productId・itemName・unit・quantity・unitPrice・discountRate・itemDiscount・memos）
  - 明細配列を `z.string().transform(JSON.parse).pipe(z.array(...))` で検証
  - version・variationId・overallDiscount・顧客/社内メモのスカラー項目
- コミットメッセージ: `feat: バリ内容編集フォームの入力スキーマ（JSON明細配列・ADR-0050）（#332）`

### Step 4: バリ内容更新の Server Action（C4 配線）
- 対象ファイル: src/app/(features)/estimates/[estimateNumber]/actions.ts
- 作業内容:
  - `updateVariationContent(estimateNumber, prevState, formData)` を追加
  - parseWithZod → DTO で estimateId 解決 → `VariationContentInput` へマップ → `updateVariationCommandFactory().execute`
  - `TaxCheckedSaveResult` 処理（taxRateMismatch→フォームエラー）・`handleCommandError`・成功で revalidatePath＋redirect
- コミットメッセージ: `feat: バリ内容更新の Server Action を C4 へ配線（#332）`

### Step 5: VariationPanel の編集モード化（独立トグル・作業コピー）
- 対象ファイル: src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx ほか
- 作業内容:
  - アクティブバリに対する閲覧⇄編集トグル（C2 と独立）
  - 編集中の明細・全体値引・メモを作業コピー state で保持
  - 編集中のタブ切替は破棄確認ダイアログ
- コミットメッセージ: `feat: バリ編集モード切替と作業コピー（独立トグル・タブ破棄確認）（#332）`

### Step 6: 明細インライン編集＋全体値引・メモ＋金額ライブプレビュー
- 対象ファイル: src/app/(features)/estimates/[estimateNumber]/components/LineTable.tsx（編集 variant）ほか
- 作業内容:
  - 数量・単価・掛率・値引・行メモ×2 のインライン入力（商品名・単位は固定表示）
  - 全体値引・バリ顧客/社内メモの編集 UI
  - 行金額・小計・合計のクライアント簡易ライブプレビュー（確定はドメイン）
- コミットメッセージ: `feat: 明細インライン編集・全体値引・メモと金額ライブプレビュー（#332）`

### Step 7: 行追加（商品選択→直下挿入）・削除・アクティブ行
- 対象ファイル: 上記編集コンポーネント群
- 作業内容:
  - 「明細追加」→ 商品選択モーダル → `findById` でスナップショット → アクティブ行直下に挿入（無ければ末尾）→ 新規行を自動アクティブ
  - 行削除（確認なし）／行アクティブ化（編集モードでも維持）
- コミットメッセージ: `feat: 通常明細の追加（直下挿入）・削除・行アクティブ化（#332）`

### Step 8: 周辺商品サジェストダイアログ
- 対象ファイル: サジェストダイアログ（新規）＋追加フロー結線
- 作業内容:
  - 本体追加直後に `findById(本体).relatedProducts`（有効のみ）を提案ダイアログ表示（既定チェック済み）
  - 選択分を通常行として本体直下に挿入（数量＝relation・他は新規行既定・カスケードなし）
- コミットメッセージ: `feat: 周辺商品サジェスト（本体追加で通常行として提案）（#332）`

### Step 9: 通常行の D&D 並び替え（dnd-kit）
- 対象ファイル: 編集テーブルコンポーネント
- 作業内容:
  - dnd-kit sortable でフラットな通常行の並び替え（ドラッグハンドルは編集時のみ）
  - sortOrder は submit 時に配列 index から導出
- コミットメッセージ: `feat: 通常行の D&D 並び替え（sortOrder は submit 時導出）（#332）`

### Step 10: E2E テスト
- 対象ファイル: src/app/(features)/estimates/estimates-variation-edit.e2e.ts（新規）
- 作業内容:
  - 通常明細の追加・インライン編集・削除・並び替え・全体値引・メモ保存・周辺サジェストの受け入れ条件を E2E 化（ADR-0012/0017/0020・create-e2e-test 準拠）
- コミットメッセージ: `test: バリ内容編集（S4）の E2E テスト（#332）`
