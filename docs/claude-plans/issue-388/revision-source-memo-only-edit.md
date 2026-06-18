# Issue #388: 改訂元バリエーションを得意先改訂後はメモのみ編集可にする — 実装計画

## 概要

得意先改訂後、改訂元（凍結された納品先宛バリエーション）をメモ以外編集不可のまま、メモ（バリ単位の顧客/社内＋各明細単位の顧客/社内）だけ編集できるようにする。あわせて per-variation の改訂役割を `VariationDTO.revisionRole` として read 側に表面化し、presentation が脆い `containsRevisedLine` 導出をやめて凍結を正しく判定できるようにする（改訂元に出ていた無効な「内容を編集」ボタンを解消）。

実装は `/tdd`（red-green-refactor）で進め、各コミットは単体でビルド可能に保つ（#359 deviations の教訓）。最終強制はドメイン、UI 抑止はその外側の写し（二重防御）を維持する。

## 設計判断

設計はグリル（/grill-with-docs）で確定済み。主要判断は **ADR-0059**（ユーザー承認済・コミット `103aa75`）と CONTEXT.md「凍結」鋭利化に記録済み。以下は計画への要約（再判断不要）。

### 凍結状態の DTO 表現
- A. `revisionRole: "NONE" | "REVISION_SOURCE" | "REVISION_TARGET"`（単一 enum）/ B. `isFrozen` boolean のみ / C. 編集可否 descriptor
- 採用: **A**。read model はドメイン言語（改訂役割）を話し、編集可否の写像は presentation が持つ。3状態相互排他で enum が正直。#390（改訂先）と同一フィールドで賄える。値は改訂接頭辞で複製系譜（Source/Copied）との衝突を回避。

### メモのみ更新のドメイン／アプリ経路
- A. 専用 `UpdateVariationMemosCommand` ＋ ルート `findVariationOrThrow` 経由メソッド / B. C4 拡張 / C. ADR-0049 流 no-op
- 採用: **A**（ADR-0059）。凍結ガード・再計算（ADR-0028 非該当）・税率チェックをいずれも通さず version 付き保存（ADR-0039）。

### ルートメソッド粒度
- a. 対象別ペア2本 / b. 完全粒度4本 / c. 単一バッチ
- 採用: **a**。`changeVariationMemos(vId, customer, internal)` ＋ `changeItemMemos(vId, itemId, customer, internal)`。フォーム submit 単位と一致。

### UI 形態・明細メモ編集面
- 専用メモ編集フォーム（新 PanelMode `edit-memo`・`revisionRole==="REVISION_SOURCE"` で「メモを編集」ボタン）。明細・数量・価格は read-only。
- 明細メモは **(面a) インライン**: 軽量 `LineTable` にメモ列を追加（read-only＋edit 両モード）。#388 が memo 列追加を内包し、別件の「LineTable がメモ未表示」バグも副産物として解消（順a）。

### フォームのシリアライズ
- ADR-0050 踏襲。`itemMemos` を itemId キーのフラット JSON hidden field、バリメモはスカラー。メモは optional（空→`Memo.empty()`・ADR-0034）。

### presentation の置換範囲
- `containsRevisedLine` 全廃。`isVariationEditable(v)=v.revisionRole==="NONE" && v.status==="ACTIVE"`、`isVariationDuplicatable(v)=v.revisionRole!=="REVISION_TARGET"`、`isVariationRevisableForCustomer` は不変。

### スコープ外（本計画に含めない）
- セット群自身のメモ編集（明細単位メモ＝`EstimateItem` に限定）。
- 改訂先（REVISION_TARGET）の粒度別編集 → #390。

## ステップ

### Step 1: ドメイン — 改訂元のメモのみ更新経路（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/Estimate.test.ts`（および必要なら `EstimateVariation.test.ts`）
- 作業内容:
  - RED: 「凍結された改訂元でも `changeVariationMemos`/`changeItemMemos` は成功」「凍結中の非メモ操作（例: `changeItemUnitPrice`）は従来どおり `BusinessRuleViolationError`」をテストで先に固定。
  - GREEN: ルート `Estimate` に `changeVariationMemos(variationId, customerMemo, internalMemo)` と `changeItemMemos(variationId, itemId, customerMemo, internalMemo)` を追加。`editableVariationOrThrow`（凍結拒否）ではなく `findVariationOrThrow` 経由で既存エンティティ設定子（`changeCustomerMemo`/`changeInternalMemo`）へ委譲。金額に効かないため再計算は呼ばない。
  - testing-backend スキルの規約に沿う。
- コミットメッセージ: `feat: 改訂元のメモのみ更新ドメイン経路を追加 (#388)`
  - ボディに「凍結ガードを findVariationOrThrow で迂回（ADR-0059）。メモは金額不変ゆえ再計算しない」旨を記載。

### Step 2: アプリケーション — UpdateVariationMemosCommand（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/UpdateVariationMemosCommand.ts`（新規）
  - `src/server/subdomains/estimate/application/commands/__tests__/UpdateVariationMemosCommand.test.ts`（新規）
- 作業内容:
  - RED: 「load → バリメモ＋明細メモを適用 → version 付き保存」「見積不在は `NotFoundEntityError`」「凍結改訂元でも成功」をテスト。
  - GREEN: 入力 `{ estimateId, variationId, version, customerMemo?, internalMemo?, itemMemos: [{ itemId, customerMemo?, internalMemo? }] }`。Step 1 のルートメソッドを呼び、税率整合チェック（`checkTaxRateThenSave`）は通さず素の version 付き保存（ADR-0039）。空文字→`Memo.empty()` 変換は入力境界で吸収。
- コミットメッセージ: `feat: メモのみ更新コマンド UpdateVariationMemosCommand を追加 (#388)`
  - ボディに「税率チェック非経由の理由（メモは税額に影響せず ADR-0049 の凍結再計算なし前提と整合）」を記載。

### Step 3: クエリ／DTO — revisionRole の表面化（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/dto/EstimateDetailDTO.ts`
  - `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService.ts`
  - `src/server/subdomains/estimate/infrastructure/queries/__tests__/PrismaEstimateQueryService.test.ts`（既存に追記、なければ repository/query テストに準ずる）
- 作業内容:
  - `VariationDTO` に `revisionRole: "NONE" | "REVISION_SOURCE" | "REVISION_TARGET"` を追加（候補②の rationale を JSDoc に ADR-0044/0059 参照付きで記載）。
  - クエリサービスで導出: 全バリの `revisionTarget.sourceVariationId` 集合を作り、各バリにつき TARGET＝`revisionTarget != null`、SOURCE＝集合が自分の id を含む、それ以外 NONE。既存 include で追加クエリ不要。
  - RED/GREEN: 改訂前/改訂元/改訂先の3ケースで `revisionRole` を検証。
  - 本ステップは additive（`containsRevisedLine` はまだ `revisedDeliveryPrice` を見るため presentation は壊れない）。
- コミットメッセージ: `feat: VariationDTO に revisionRole を追加し改訂役割を read 側で導出 (#388)`
  - ボディに「ADR-0044 の凍結導出を read model に写像」旨を記載。

### Step 4: presentation 述語 — containsRevisedLine 全廃（TDD）
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/variationEditable.ts`
  - `src/app/(features)/estimates/[estimateNumber]/variationEditable.test.ts`
- 作業内容:
  - RED: `revisionRole` ベースの期待値を先に固定（REVISION_SOURCE は `isVariationEditable=false`、NONE&&ACTIVE で true、REVISION_TARGET は editable=false かつ duplicatable=false 等）。
  - GREEN: `containsRevisedLine` を削除し、`isVariationEditable=revisionRole==="NONE" && status==="ACTIVE"`、`isVariationDuplicatable=revisionRole!=="REVISION_TARGET"` に置換。`isVariationRevisableForCustomer` は不変。
  - この時点で改訂元の「内容を編集」ボタンが消える（本バグの中核修正）。
- コミットメッセージ: `fix: 編集可否判定を revisionRole 化し改訂元の無効な全編集ボタンを解消 (#388)`

### Step 5: presentation — LineTable にメモ列を追加（read-only＋edit）
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/components/LineTable.tsx`
- 作業内容:
  - メモセル列を追加し、`memoEdit?: boolean` ＋ `onChangeMemo?(itemId, patch)` で出し分け: 既定は read-only テキスト（=メモ表示バグ修正）、edit モードは顧客/社内 textarea 2本（`LineEditTable` のメモセル markup／`memoInputClass`・rows=2・aria-label 規約を流用）。
  - 通常明細・構成明細にメモ入力を出す。セット群ヘッダ自身のメモは対象外。
- コミットメッセージ: `feat: 明細テーブルにメモ列を追加し read-only/編集モードを出し分ける (#388)`
  - ボディに「read-only 分岐は別件のメモ未表示バグ解消を兼ねる」旨を記載。

### Step 6: presentation — メモ編集フォーム・スキーマ・Server Action・配線
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/variationMemoSchema.ts`（新規）
  - `src/app/(features)/estimates/[estimateNumber]/VariationMemoEditForm.tsx`（新規）
  - `src/app/(features)/estimates/[estimateNumber]/actions.ts`（メモ更新 Server Action 追加・コマンド DI 配線）
  - `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`（PanelMode に `edit-memo` 追加・「メモを編集」ボタンを `revisionRole==="REVISION_SOURCE"` で表示）
- 作業内容:
  - スキーマ: `version`/`variationId`/バリ `customerMemo`・`internalMemo`（スカラー）／ `itemMemos`（ADR-0050 JSON hidden・itemId キーのフラット配列、メモ optional）。
  - フォーム: read-only な `LineTable`（`memoEdit` 有効）＋バリメモ textarea。submit で `UpdateVariationMemosCommand` 用 Server Action を呼ぶ。作業状態はメモのみの軽量 state。
  - PanelMode `edit-memo` を追加。編集中タブ切替の破棄確認は既存パターン踏襲。改訂元では「内容を編集」は出ず「メモを編集」のみ。
- コミットメッセージ: `feat: 改訂元のメモのみ編集フォームと Server Action を配線 (#388)`

### Step 7: E2E — 改訂元のメモのみ編集（E2Ea）
- 対象ファイル:
  - `src/app/(features)/estimates/estimates-revise-for-customer.e2e.ts`（既存を拡張）
- 作業内容:
  - 既存 C7 専用シード `N9905006` を用い、得意先改訂実行後に「改訂元タブに『内容を編集』が出ず『メモを編集』が出る」「メモ編集フォームで明細・価格が read-only」「バリ単位＋明細単位メモを編集・保存→成功」を検証。凍結が初めて UI 観測可能になったギャップ（#359 deviations ⑤）を閉じる。
  - create-e2e-test スキルの規約（直列化・Prisma 直接利用禁止 ADR-0012/0020）に従う。
- コミットメッセージ: `test: 改訂元のメモのみ編集 E2E を追加 (#388)`
