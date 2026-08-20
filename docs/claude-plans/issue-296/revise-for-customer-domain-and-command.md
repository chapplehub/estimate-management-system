# Issue #296: C7 ReviseForCustomer（得意先改訂・集約内）をドメイン+アプリ層で実装する — 実装計画

## 概要

同一見積（集約ルート Estimate）内で、納品先宛バリエーションを改訂元として得意先宛の新バリエーションを生成する C7（得意先改訂）を実装する。採番なし・集約内で完結する操作であり、C6 複製（集約またぎ）とはフローも実装形も異なる。

改訂元の**凍結**（§7.2）、改訂先の**行構成固定**、`deliveryPrice` スナップショット（§8.4）、改訂系譜 `EstimateVariationRevision` の生成を含む縦スライス。

**依存**: #320（提出区分を見積本体からバリエーション単位へ移動するモデル修正）の完了が前提。本計画は提出区分がバリエーションの保存属性になった世界を前提に書かれている。

**関連ドキュメント**（/grill-with-docs セッションで整備済み）:
- ADR-0044: 改訂系譜は集約の内側に置き、凍結は系譜からの導出状態とする
- CONTEXT.md「見積の改訂」「提出区分」セクション（用語: 得意先改訂・改訂元・改訂先・改訂系譜・凍結・行構成固定）
- 設計書 §7.2（誤記修正済み: 行追加削除不可は**得意先**バリエーション側）

## 設計判断

### 凍結の表現方法
- A. 系譜から導出（「自分を改訂元とする改訂系譜が同一集約内に存在 ⟺ 凍結」）
- B. `VariationStatus` に FROZEN を追加
- C. boolean 列 `isFrozen` を追加
- 採用: A（ADR-0044）。凍結は「改訂された」という事実の帰結であり状態ではない。スキーマ変更ゼロ・二重管理なし・解除APIも不要。Bは直交概念（有効/無効×凍結）を1軸に潰す歪み、Cは不整合状態が表現可能になる

### 改訂系譜のドメイン上の所属
- A. 集約の内側（`EstimateVariation` が出自 `revisedFrom` を保持）
- B. 集約外の兄弟成果物（C6 の `EstimateVariationCopy` / ADR-0040 と対称）
- 採用: A（ADR-0044）。複製系譜は2つの集約インスタンスにまたがるため集約外だが、改訂系譜は両端が同一集約インスタンス内。凍結ガード（不変条件）の根拠データは整合性境界の内側に置く

### ドメインAPIの形
- A. 集約ルートメソッド `Estimate.reviseForCustomer(sourceVariationId)`
- B. ドメインサービス（C6 の `EstimateDuplicationService` と同型）
- 採用: A。C7 は集約内で完結するためサービス分離の理由（集約またぎ）が存在しない。C3 `appendVariation` と同型

### 改訂先バリエーションの生成規則
- A. 明細・価格・値引・メモを全複写（調整の出発点として引き継ぐ）
- B. C6 と同じく単価クリア
- 採用: A。§7.2「金額: 120万→100万（調整）」のとおり、納品先価格を出発点に得意先卸値へ調整するフローのため

### deliveryPrice スナップショットの定義
- 改訂元明細の `finalAmount`（最終明細金額。掛率・値引適用後）を採用。見積書に印字される確定値であり「粗利 = 納品先価格 − 得意先価格」（§8.4）と整合する

### 行構成固定と C4 UpdateVariation の衝突
- A. 改訂先への C4 `replaceContent` をドメインエラーで禁止。調整は粒度別メソッド（`changeItemUnitPrice` 等・既存）で行う
- B. `replaceContent` を改訂先対応に拡張（明細対応付け＋スナップショット引き継ぎ）
- C. 改訂先専用の一括調整メソッドを新設
- 採用: A。全置換は構造上「全行削除＋全行追加」で行構成固定と原理的に矛盾し、`RevisedEstimateItemDetail` も黙って消失するため。調整用アプリ層コマンドはプレゼンテーション層実装時の将来issue

### 前提条件・ガードの確定値（ユーザー合意済み）
- 改訂元: 提出区分=納品先宛のみ・ACTIVE のみ。再改訂（1ソース→複数の得意先宛）は許可
- 凍結中の改訂元: メモ変更・ステータス変更（activate/deactivate）は許可。それ以外の編集・削除は拒否
- 改訂先の削除は許可（系譜がカスケードで消え、改訂元の凍結が自動的に解ける）
- 改訂が1件でも存在する見積は estimateDate / taxRate / taxRoundingType / customerId / deliveryLocationId 変更不可（deadline / departmentId は変更可）

## ステップ

### Step 1: 改訂系譜の保持と行構成固定ガード（ドメイン）
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`、同 `__tests__/`
- 作業内容:
  - `EstimateVariation` に出自 `revisedFrom: EstimateVariationId | null` を追加（create / reconstruct 対応）
  - `revisedFrom` を持つバリエーションの行構成固定ガード: `addItem` / `removeItem` / `replaceContent` を BusinessRuleViolationError で拒否（単価・掛率・値引・数量・メモの粒度別変更は許可のまま）
- コミットメッセージ: `feat: バリエーションに改訂出自を持たせ行構成固定ガードを追加する`

### Step 2: 凍結の導出と凍結ガード（ドメイン）
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/Estimate.ts`、`EstimateVariation.ts`、同 `__tests__/`
- 作業内容:
  - 集約ルートに凍結判定（いずれかのバリエーションの `revisedFrom` が自分を指す ⟺ 凍結）を実装
  - 凍結中の改訂元への `updateVariation`（C4）・明細操作（`addItem` / `removeItem` / `changeItem*` / `changeOverallDiscount`）・`removeVariation` を拒否
  - メモ変更・`activateVariation` / `deactivateVariation` は凍結中も許可（直交概念）
- コミットメッセージ: `feat: 改訂元バリエーションの凍結を系譜から導出しガードする（ADR-0044）`

### Step 3: reviseForCustomer 本体（ドメイン）
- 対象ファイル: `Estimate.ts`、`RevisedEstimateItemDetail.ts`（必要なら）、同 `__tests__/`
- 作業内容:
  - `Estimate.reviseForCustomer(sourceVariationId): EstimateVariation` を実装
  - 前提条件: 改訂元が納品先宛・ACTIVE であること（違反は BusinessRuleViolationError）。再改訂は許可
  - 生成規則: 明細・価格・値引・メモ全複写、提出区分=得意先、番号 max+1（§A.2）、ACTIVE、明細ごとに `RevisedEstimateItemDetail.create(改訂元明細.finalAmount)` を付与、`revisedFrom` = 改訂元ID
- コミットメッセージ: `feat: 集約内の得意先改訂 reviseForCustomer をドメインに実装する`

### Step 4: 改訂後の見積本体変更不可ガード（ドメイン）
- 対象ファイル: `Estimate.ts`、同 `__tests__/`
- 作業内容:
  - 改訂系譜が1件でも存在する見積で `changeEstimateDate` / `changeTaxRate` / `changeTaxRoundingType` / `changeCustomer` / `changeDeliveryLocation` を拒否（`changeDeadline` / `changeDepartment` は許可のまま）
- コミットメッセージ: `feat: 改訂が存在する見積の日付・税率・取引先変更を禁止する`

### Step 5: 改訂系譜の永続化（インフラ）
- 対象ファイル: `infrastructure/mappers/EstimateMapper.ts`、`infrastructure/prisma/PrismaEstimateRepository.ts`、同テスト
- 作業内容:
  - 読み込み: `revisionTarget` リレーションを include し `EstimateVariation.revisedFrom` へ写像
  - 保存: `update`（差分upsert・ADR-0032）の延長で、`revisedFrom` を持つ新規バリエーションに対応する `EstimateVariationRevision` 行を挿入（`revisedDetail` の永続化は対応済みのため変更不要）
- コミットメッセージ: `feat: 改訂系譜を集約保存の差分upsertで永続化する`

### Step 6: ReviseForCustomerCommand + factory（アプリ層）
- 対象ファイル: `application/commands/ReviseForCustomerCommand.ts`、`application/factories/reviseForCustomerCommandFactory.ts`、`factories/index.ts`、同テスト
- 作業内容:
  - 入力 `{ estimateId, sourceVariationId, version }`（version は楽観ロックトークン・ADR-0039。C3 と同じ理由で追加型でも必須）
  - 流れ: `findById` →不在は NotFoundEntityError → `estimate.reviseForCustomer()` → `checkTaxRateThenSave`（§8.6/§8.7）→ `TaxCheckedSaveResult` を返す
  - factory は `addVariationCommandFactory` と同型
- コミットメッセージ: `feat: C7 ReviseForCustomerコマンドとfactoryを実装する`

## スコープ外（将来issue）

- 凍結バリエーションのメモ編集・改訂先の価格調整のアプリ層コマンド（プレゼンテーション層実装時に追加）
- 申請系の「提出区分=得意先のみ申請・受注作成可」制約（§7.2 ステップ3・着手順序の申請ユースケース）
