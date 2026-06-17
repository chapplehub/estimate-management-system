# Issue #363: VariationCreateForm / VariationEditForm のフォーム共通化 — 実装計画

## 概要

`VariationCreateForm`（C3 新規追加／複製プリフィル）と `VariationEditForm`（C4 内容編集）は、作業コピーパイプライン（nodes＝通常明細／セット群 union の client state・ADR-0047/0050）・共有部品・6ハンドラ群がほぼ同一実装で重複している。明細編集ロジックを単一実装へ集約し、両フォームを薄いラッパに置き換える。あわせて3フォーム（上記2つ＋ `EstimateHeaderForm`）に重複する定数（`productSearchFields` / `inputClass`）も共通化する。

スキーマ層（`variationContentFields` ＝ version/overallDiscount/memo×2/nodes）はすでに共通化済みで、Edit は `variationId` を、Create は `submissionType` を足すだけの差分。重複しているのは React 層のみ。

完了条件: 明細編集ロジックが単一実装に集約され Create/Edit 双方で再利用／C3・C4 の既存挙動不変／既存 E2E（estimates-variation-create / estimates-variation-edit / estimates-set-group-edit）緑／`pnpm lint` `pnpm test` 通過。

## 設計判断

### 抽出境界（最重要・他判断を支配）
- A. フック＋共有ボディ部品（state/ハンドラはフック、共通JSXはボディ部品、useServerForm と分岐 hidden は薄いラッパに残す）
- B. 単一コンポーネント＋mode 判別 prop
- C. フックのみ抽出（JSX 重複は残す）
- **採用: A**（理由: conform の `fields` 型はスキーマ依存。useServerForm を各ラッパに残し、スキーマ差をラッパ内に閉じ込められる。issue の「薄いラッパ」要件とも整合）

### ボディ部品への conform 注入方式
- A. 個別 `FieldMetadata` を明示渡し（nodes/overallDiscount/customerMemo/internalMemo）
- B. `fields` オブジェクトを共通型で丸ごと渡す
- C. ボディは conform 非依存にしメモ等はラッパに残す（メモブロックが再重複）
- **採用: A**（理由: スキーマ差に依存せず `FieldMetadata<...>` 単位で型が閉じ、最も型安全。`form` 丸ごとも渡さない）

### totals（previewVariationTotals）の算出位置
- A. フックが taxRate/taxRoundingType も受け totals まで導出して返す
- B. ボディが editor＋taxRate から導出
- C. ラッパが導出して props 渡し
- **採用: A**（理由: 「バリ明細編集器の状態と導出ビュー」を単一フックに凝集。ボディは導出ゼロの純表示になりラッパの薄さが一貫）

### `<form>` シェル・送信ボタン・エラーバナー・分岐ヘッダの配置
- A. ボディは内側共通領域のみ。`<form>`/getFormProps/form.errors/version hidden/分岐 hidden/送信ボタンは各ラッパに残す
- B. ボディが `<form>` 丸ごと所有＋header スロット注入
- C. ボタン/エラーはボディ・`<form>` タグはラッパ
- **採用: A**（理由: `form` メタデータは `FormMetadata<Schema>` 依存。ラッパに留めれば具体スキーマ型で getFormProps が型安全。fields でスキーマ結合を避けた判断と一貫。エラーバナー/ボタンの軽微な重複は許容、必要なら後で `<FormActions>` 化）

### 抽出3資産の配置
- A. 責務別に分散（hook→`[estimateNumber]/`、body→`components/`、productSearchFields→`_shared/`）
- B. variation 専用サブモジュールに集約
- C. 全部 `_shared/` に集約
- **採用: A**（理由: フックは詳細ページ固有ゆえ横断 `_hooks/` ではなく `variationLines.ts` と同居。ボディは `LineEditTable` の親プレゼンテーション層ゆえ `components/`。`productSearchFields` は選択系の凝集先 `_shared/`）

### `inputClass` の disabled バリアント
- A. 2定数（`inputClass` base ＋ `inputClassDisabled` ＝ base + `disabled:bg-gray-100`）
- B. disabled を引数に取るユーティリティ関数
- C. base 単一 ＋ Header 側でインライン追記
- **採用: A**（理由: 完了条件「既存挙動不変」＝統一ではなく差の保存が正解。各サイトに現状クラスを割当て直すだけで回帰ゼロ。静的クラスゆえ関数は過剰。置き場 `_shared/formStyles.ts`）

### テスト戦略
- A. 新規フックテストなし・既存資産（variationLines.test.ts ＋ 3 E2E）に依拠
- B. renderHook でフルテスト（server action mock）
- C. 同期ハンドラのみ renderHook
- **採用: A**（理由: 純関数群は既にテスト済み・同期ハンドラはその薄い委譲・非同期商品選択は3 E2E が網羅。スコープをリファクタに限定）

### 外部契約
- `VariationCreateForm` / `VariationEditForm` の Props は不変に保つ → `VariationPanel` 無改修（判断不要・既存挙動不変の構造的保証）

## ステップ

### Step 1: 共通定数の抽出（productSearchFields / inputClass）
- 対象ファイル:
  - 新規 `src/app/(features)/estimates/_shared/formStyles.ts`（`inputClass` / `inputClassDisabled`）
  - 新規 or 追記 `src/app/(features)/estimates/_shared/productSearch.ts`（`productSearchFields`）※ `selectionColumns` への追記でも可
  - `EstimateHeaderForm.tsx`（inputClass×9 → `inputClassDisabled`、productSearchFields を import 参照へ）
  - `VariationCreateForm.tsx` / `VariationEditForm.tsx`（ローカル定数削除し import 参照へ）
- 作業内容:
  - `inputClass`(base) と `inputClassDisabled`(=base+`disabled:bg-gray-100`) を `_shared/formStyles.ts` に定義
  - `productSearchFields` を `_shared` へ移設、3ファイルから import
  - 各サイトに現状クラスを温存割当て（Header=Disabled、バリメモ=base）
- コミットメッセージ: `refactor: フォーム共通定数（productSearchFields / inputClass）を_sharedへ抽出`
  - ボディ: inputClass は disabled バリアントを別定数（inputClassDisabled）で保存。理由: EstimateHeaderForm のみ disabled:bg-gray-100 を持ち、単純共有は当該スタイルの握り潰し回帰になるため。

### Step 2: useVariationLineEditor フックの抽出
- 対象ファイル: 新規 `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts`
- 作業内容:
  - 入力: `{ initialNodes: WorkingNode[]; initialOverallDiscount: number; taxRate: number; taxRoundingType: string }`
  - 所有 state: nodes / overallDiscount / activeRowId / productModalOpen / suggestState
  - 公開: 上記 state ＋ `changeLine` `deleteNode` `reorderTopLevel` `reorderInGroup` `handleProductSelect` `confirmSuggestions` ＋ setProductModalOpen / setActiveRowId 等 ＋ 導出 `totals`
  - DTO 非依存（VariationDTO / VariationCreateInitialValues を import しない）
- コミットメッセージ: `refactor: バリ明細編集の作業state・ハンドラ・totals導出をuseVariationLineEditorへ抽出`
  - ボディ: 初期値は解決済みプリミティブで注入しフックをDTO非依存に。理由: Create(initialValues)/Edit(VariationDTO)の供給元差をラッパ側に閉じ込め、フックの再利用性を保つため。

### Step 3: VariationLineEditor ボディ部品の抽出
- 対象ファイル: 新規 `src/app/(features)/estimates/[estimateNumber]/components/VariationLineEditor.tsx`
- 作業内容:
  - props: `editor`（フック戻り値）＋個別 `FieldMetadata`（nodesField / overallDiscountField / customerMemoField / internalMemoField）＋ `isPending`
  - 描画: 明細header＋追加ボタン・LineEditTable＋errors・全体値引・メモ×2・プレビュー・SelectionModal・ProductSuggestDialog（内側共通領域のみ）
  - `form` 丸ごと・`<form>` タグ・送信ボタンは含めない
- コミットメッセージ: `refactor: 明細編集の共通JSXをVariationLineEditor部品へ抽出（個別FieldMetadata注入）`
  - ボディ: conform は fields 丸ごとでなく個別 FieldMetadata で注入。理由: Create/Editのスキーマ差（submissionType/variationId）をボディに漏らさず型を閉じるため。

### Step 4: Create/Edit を薄いラッパに置き換え
- 対象ファイル: `VariationCreateForm.tsx` / `VariationEditForm.tsx`
- 作業内容:
  - 各ラッパ: useServerForm（自スキーマ）＋ initial state 解決（Create=`initialValues?.nodes ?? []` / Edit=`fromVariationLines(variation.lines)`）＋ useVariationLineEditor 呼び出し
  - `<form>` シェル・form.errors バナー・version hidden・分岐 hidden（Create=SubmissionTypeField / Edit=variationId）・送信/キャンセルボタン・`<VariationLineEditor>` を構成
  - 外部 Props 不変を確認（VariationPanel 無改修）
- コミットメッセージ: `refactor: VariationCreate/EditFormを共通土台の薄いラッパへ置換`

### Step 5: 緑化確認と逸脱記録
- 対象ファイル: （必要なら）`docs/claude-plans/issue-363/deviations.md`
- 作業内容:
  - `pnpm lint` / `pnpm test` / `pnpm e2e`（create / edit / set-group-edit）を緑確認
  - 計画と異なる対応があれば deviations.md に記録
- コミットメッセージ: （挙動変更なしのため原則不要。逸脱記録のみ生じた場合）`docs: issue-363 実装逸脱を記録`
