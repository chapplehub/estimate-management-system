# Issue #390: 改訂先バリエーションの部分編集（単価・掛率・値引・メモ）を可能にする — 実装計画

## 概要

得意先改訂で生成した改訂先バリエーション（得意先宛・`revisedFrom` あり）について、**単価・掛率・明細値引・全体値引・メモ（バリ単位＋明細単位）を編集可能**にする。**商品・数量・改訂価格（`revisedDeliveryPrice` スナップショット）・行構成（追加/削除）は変更不可**。

#359 時点では改訂先は「内容を編集」ボタンが出ず一切編集できなかった。本 issue で、改訂先の編集可能集合（価格系＋メモ）だけを更新する専用経路（ドメイン `adjustPricing` ＋アプリ `AdjustRevisedVariationCommand` ＋専用フォーム）を縦スライスで実装する。あわせて要件と矛盾していた「数量調整可」を**数量固定**へ訂正する（ADR-0060・CONTEXT.md 反映済み）。

TDD（RED→GREEN→REFACTOR）で、ドメイン→アプリ→プレゼン→E2E の順に縦スライスする。各 Step の単位でコミットする。

## 設計判断

会話（grill-with-docs）で確定済み。詳細根拠は ADR-0060 と各コミットボディに残す。

### 数量の編集可否
- A. ドメインに数量固定ガード新設（二重防御）／ B. UI 抑止のみ
- **決定: A**。`deliveryPrice = 改訂元 finalAmount`（行金額凍結）ゆえ、数量可変だと粗利（§8.4）が別物同士の引き算になり崩れる。型上正しい入力で粗利を壊すため操作を入口で閉じる（ADR-0060）。

### 数量ガードの表現
- A. 数量専用ガード `assertQuantityImmutable` 新設／ B. 既存 `assertLineStructureMutable` 流用
- **決定: A**。固定の根拠が異なる（行構成固定＝1:1 行対応保全、数量固定＝粗利スナップショット保全）。名前付きガードを分けテスト・メッセージの意図を明示。

### 調整コマンドの形
- X. 価格系＋メモを1コマンド統合／ Y. 価格は新コマンド・メモは既存 `UpdateVariationMemosCommand` 流用
- **決定: X（`AdjustRevisedVariationCommand`）**。改訂先の編集可能集合は要件で一体。メモ専用経路（ADR-0059）は改訂*元*の凍結貫通という固有の意味を負うため流用しない。価格変更で税額が動くので `checkTaxRateThenSave`（C4 と同じ・§8.6/8.7）を通す。

### 価格適用のドメイン実装
- P. 既存粒度別メソッド再利用（per-call 再計算）／ Q. 専用バッチ `adjustPricing`（再計算1回）
- **決定: Q**。ルートの粒度別メソッド（`changeItemUnitPrice` 等）は現状 production 利用者ゼロで、再利用しても per-call 再計算 O(N²) を継承するだけ。`recalculate` は最終状態からの純導出で冪等のため、item setter 適用後に末尾1回で正。`adjustPricing` は改訂先専用にしない（数量・構成を触らないので一般の編集可能バリにも安全）。

### 調整フォームのテーブル
- 1. `LineTable` を priceEdit 拡張／ 2. `LineEditTable`（C4 編集テーブル）流用
- **決定: 1**。`LineEditTable` は行削除・D&D 並べ替え（`onRemoveNode`/`onReorderNodes`）がテーブル本体に組込まれ、改訂先が構造的に禁止する操作そのもの。骨抜き改造は C4 回帰リスク。構造操作を持たない `LineTable` への純加算が改訂先（行構成固定・数量固定）の性質と一致。粗利計算は純関数 `previewLineAmount` を再利用。

### 粗利フィードバック
- **決定: あり**。明細粗利列＝`改訂価格 − 得意先行金額`（`previewLineAmount` 再利用）＋合計粗利、逆ザヤは赤字強調。確定はドメイン（±1円近似と明示）。

### DTO 表現
- **判断不要（変更なし）**。`revisionRole`（#388）と `revisedDeliveryPrice`（既存 LineDTO）で足りる。

### 孤児ミューテータの撤去
- **決定: #390 には含めない（別 issue #394・#390 マージ依存）**。#390 後に production 利用者ゼロになるルート/バリの粒度別価格ミューテータ＋冗長テストの撤去。`changeItemQuantity`（数量ガードの置き場）・`EstimateItem` setter（`adjustPricing` が使用）・メモ系は除外。起票済み: https://github.com/chapplehub/estimate-management-system/issues/394

## ステップ

### Step 1: 改訂先の数量固定ガード（ドメイン）
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`、`__tests__/EstimateVariation.test.ts`、`__tests__/Estimate.test.ts`
- 作業内容（TDD）:
  - RED: 「改訂先（`revisedFrom !== null`）で `changeItemQuantity` は `BusinessRuleViolationError`」「通常バリでは従来どおり数量変更が通る」テストを追加
  - GREEN: `assertQuantityImmutable()`（`_revisedFrom !== null` で拒否・粗利スナップショット保全のメッセージ）を新設し `changeItemQuantity` 先頭で呼ぶ
  - `assertLineStructureMutable` のコメントを「数量も固定（→数量固定ガード参照）」に整合させる
- コミットメッセージ: `feat: 改訂先バリエーションの数量変更をドメインで固定する`（ボディ: ADR-0060 要旨＝deliveryPrice が行金額スナップショットゆえ数量固定が粗利の前提）

### Step 2: 価格バッチ調整メソッド `adjustPricing`（ドメイン）
- 対象ファイル: `EstimateVariation.ts`、`Estimate.ts`、各 `__tests__`
- 作業内容（TDD）:
  - RED: `EstimateVariation.adjustPricing(itemAdjustments, overallDiscount, tax)` が各明細の単価・掛率・明細値引と全体値引を適用し、集計が正しく**再計算は1回**であることを検証（呼び出し回数 or finalTotal 整合）。`assertEditable`（無効弾き）も固定
  - RED: `Estimate.adjustVariationPricing(vId, adjustments)` が `editableVariationOrThrow` 経由で、凍結改訂元は拒否・改訂先は通る・数量は不変であることを検証
  - GREEN: item setter（`changeUnitPrice`/`changeDiscountRate`/`changeItemDiscount`）を適用→`_overallDiscount` セット→末尾 `recalculate` 1回。ルートは委譲＋`touch`
- コミットメッセージ: `feat: 改訂先の価格バッチ調整メソッド adjustPricing を追加する`（ボディ: 粒度別メソッド再利用でなくバッチ＋単一再計算を選んだ理由＝利用者ゼロ・O(N²)回避・冪等な純導出）

### Step 3: `AdjustRevisedVariationCommand`（アプリ層）
- 対象ファイル: `application/commands/AdjustRevisedVariationCommand.ts`（新規）、`application/factories/adjustRevisedVariationCommandFactory.ts`（新規）、`factories/index.ts`、`__tests__`
- 作業内容（TDD）:
  - RED: 価格系＋メモを適用し `TaxCheckedSaveResult` を返す／税率不一致で `taxRateMismatch`／見積不在で `NotFoundEntityError`／メモは金額に影響しないこと
  - GREEN: load → `adjustVariationPricing` → `changeVariationMemos` ＋明細 `changeItemMemos` ループ → `checkTaxRateThenSave`。入力型 `AdjustRevisedVariationInput`（estimateId/variationId/version/overallDiscount/customerMemo?/internalMemo?/items[{itemId,unitPrice,discountRate,itemDiscount,customerMemo?,internalMemo?}]）。数量は入力に持たない
- コミットメッセージ: `feat: 改訂先の部分編集コマンド AdjustRevisedVariationCommand を追加する`（ボディ: メモ専用経路 ADR-0059 と別に税チェック保存を通す理由＝価格変更で税額が動くため）

### Step 4: 編集ゲート `isVariationAdjustable`（プレゼン）
- 対象ファイル: `[estimateNumber]/variationEditable.ts`、`variationEditable.test.ts`
- 作業内容（TDD）:
  - RED: `REVISION_TARGET && ACTIVE` で true、それ以外（NONE/SOURCE/INACTIVE な TARGET）で false
  - GREEN: `isVariationAdjustable` を追加。3 revisionRole の排他分割を JSDoc で明示
- コミットメッセージ: `feat: 改訂先の調整ボタン表示ゲート isVariationAdjustable を追加する`

### Step 5: `LineTable` の priceEdit 拡張＋改訂価格/粗利列（プレゼン）
- 対象ファイル: `components/LineTable.tsx`、`components/LineTable.test.tsx`
- 作業内容（TDD）:
  - RED: priceEdit 時、単価・掛率・明細値引・メモが編集セル、商品・数量・単位は read-only。改訂価格列と粗利列（`改訂価格 − previewLineAmount`）を表示。逆ザヤは赤字
  - GREEN: `priceEdit?: boolean` ＋ `onChangePrice(itemId, patch)` を追加。編集セルは `previewLineAmount` と `cellInputClass` 相当を流用。`memoEdit` と併用可能に
- コミットメッセージ: `feat: LineTable に改訂先価格調整モード（priceEdit・改訂価格/粗利列）を追加する`

### Step 6: `VariationAdjustForm` ＋ schema ＋ action ＋ Panel 配線（プレゼン）
- 対象ファイル: `VariationAdjustForm.tsx`（新規）、`variationAdjustSchema.ts`（新規）、`actions.ts`、`VariationPanel.tsx`、`VariationPanel.test.tsx`
- 作業内容（TDD）:
  - RED: Panel が TARGET で「価格を調整」を出し他の編集ボタンは出さない／モード `edit-adjust` で `VariationAdjustForm` を表示。フォームは明細調整を単一 hidden へ JSON 化して往復（ADR-0050）、合計粗利を表示
  - GREEN: `VariationAdjustForm`（`VariationMemoEditForm` と同型・itemId キー作業 state、`LineTable priceEdit`＋下部に全体値引・バリメモ）。`variationAdjustSchema`（version/variationId/overallDiscount/customerMemo?/internalMemo?/items JSON）。`updateVariationAdjustment` action（factory 呼出・`TaxCheckedSaveResult` 分岐）。Panel に `edit-adjust` モードとボタン追加
- コミットメッセージ: `feat: 改訂先の価格調整フォームと画面配線を追加する`

### Step 7: E2E（C7 拡張）
- 対象ファイル: `estimates/estimates-revise-for-customer.e2e.ts`（拡張）
- 作業内容:
  - 改訂先で「価格を調整」→ 単価/掛率/明細値引/全体値引/メモを編集 → 粗利がライブ反映 → 保存 → DTO 反映を検証
  - 数量・商品が read-only であること、行追加削除 UI が無いことを検証
  - `pnpm e2e` で estimate 系全緑を確認
- コミットメッセージ: `test: 改訂先の部分編集 E2E を追加する`
