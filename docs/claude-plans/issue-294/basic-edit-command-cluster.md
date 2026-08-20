# Issue #294: アプリ層コマンド C2 UpdateEstimate / C3 AddVariation / C4 UpdateVariation（既存見積の基本編集クラスタ） — 実装計画

## 概要

既存 Estimate に対する「更新 + 再計算/税率チェック」機構を共有する基本編集系コマンド3つをまとめて実装する。

- **C2 `UpdateEstimateCommand`**: estimateId + ヘッダ項目を受け取り更新
- **C3 `AddVariationCommand`**: estimateId に新バリエーション（内容つき）を追加
- **C4 `UpdateVariationCommand`**: variationId + メモ/明細/全体値引を全置換更新

C1（#293/#298 `CreateEstimateCommand`）で確定したパターン（constructor DI / 素の関数 factory / 実 Prisma 統合テスト＋会計年度分離 / 戻り値は `kind` 判別共用体）を踏襲する。`/grill-me` で全設計枝を確定済み。

## 設計判断

### §4.8 受注作成後は編集不可
- A. 先送り（ガード未実装・記録のみ）
- B. このイシューで Estimate↔Order リンクを追加して本物のガードにする
- C. `orderExists: boolean` をコマンド入力で受ける
- **採用: A**。`Estimate` 集約に Order 参照が無く、スキーマも逆リレーションを別イシューに明示的に先送り済み。今強制するとフラグ捏造かスコープ膨張になる（C5 を除外した理由と同型）。`deviations.md`＋TODO に「Estimate↔Order リンク（将来イシュー）にブロック」と記録。

### 税率不一致時の挙動（§8.6 / §8.7）
- A. throw せず Result を返す（不一致なら save しない）
- B. save した上で結果に警告を添える
- C. save 後にチェックしてロールバック
- **採用: A**。方針「予測可能な業務分岐 = Result／想定外 = throw」。§8.7「保存時＝その場で修正」は不整合の確定保存を避ける意図。永続化前にチェックすれば DB を汚さない。`TaxRateConsistencyCheckDomainService` は事実返し（ADR-0011）なので、コマンドが mismatch を Result に変換する。

### 税率チェックの適用範囲
- A. C2/C3/C4 すべてで実行
- B. C2 のみ（日付を変えるのは C2 だけ）
- **採用: A**。§8.6 は「保存時＝すべての保存」を要求し、TaxRate マスタのタイムライン変化で C3/C4 保存時にも不一致が起こり得る。イシューが3コマンドを束ねた理由（チェック/再計算機構の共有）に最も忠実。

### 共通「税率チェック→保存」機構の形
- A. 素の共有アプリ層関数 ＋ 統一 Result 型
- B. 抽象ベースコマンドクラス（テンプレートメソッド）
- C. 成功 kind をコマンド別（`"updated"/"added"`）にする
- **採用: A**。C1 が無継承・関数合成の流儀。`checkTaxRateThenSave(estimate, deps)` を共有し、戻り値は全コマンド統一 `TaxCheckedSaveResult = { kind:"saved"; estimate } | { kind:"taxRateMismatch"; estimateDateRate; deadlineRate }`。型増殖を抑え §8.6/§8.7 を1箇所に集約。

### 並行更新（lost update）
- A. このイシューでは扱わない（last-write-wins・記録のみ）
- B. version 列＋楽観ロックを導入
- C. `updatedAt` 条件付き更新で簡易ロック
- **採用: A**。version 列が無く既存 Update コマンドも未対応。横断対応として**別イシュー #301** を起票済み。`deviations.md` に lost-update を既知制約として記録。

### C2 更新可能ヘッダ項目
- **採用**: 既存 `change*` がある `estimateDate / deadline / submissionType / customerId / deliveryLocationId / departmentId` ＋ 税率系 `taxRate / taxRoundingType` の8項目。`estimateType`（採番接頭辞 N/R/A と1:1で番号と矛盾）・`createdBy`（監査項目）は更新不可。

### C2 入力 taxRate と TaxRate マスタの関係
- A. 入力 taxRate を信頼。マスタ同期・追加検証なし
- B. consistent 時にマスタ解決値へ自動同期
- C. 「保存値≠マスタ」を検証エラーにする
- **採用: A**。サービス契約は「2日付のマスタ税率比較」のみで「保存値＝マスタ」は要求しない。C1 が入力信頼なので揃える。over-reach を避ける。

### C3 バリエーション番号採番（§A.2）
- アルゴリズム: A.`max(既存)+1`（歯抜け保持） / B.`count+1`
- 配置: A.ドメイン（ルートに採番メソッド） / B.アプリ層で算出
- **採用: アルゴリズム=max+1（歯抜け後の衝突回避）、配置=ドメイン**。バリエーション番号は集約内完結（ポート不要）で「一意性＋連番」は集約不変条件。空配列なら 1 始まり。

### C3 入力（空 vs 内容つき）
- A. 内容つき（番号なし `VariationContentDescriptor`、C4 と共用、空配列許容）
- B. 空バリエーションのみ追加
- C. items 必須
- **採用: A**。C1/C4 と入力パターンを揃え、`VariationContentDescriptor`（items + customerMemo + internalMemo + overallDiscount）を C3/C4 で共用。

### C4 明細更新セマンティクス
- A. 宣言的フルセット置換（Path 1）
- B. 差分操作入力（granular ops）
- C. itemId 突合更新（reconciliation）
- **採用: A**。クエリ層がスコープ外で安定 itemId を供給できないため自己完結する full-replace が最適。識別子は保持せず remove/insert で同期（インフラ差分 upsert と整合）。実装は新規 `EstimateVariation.replaceContent(content, tax)`＝内容一括差替え＋**最後に1回だけ recalc**（O(N)、addItem 連打の O(N²) を回避）。ルートに `updateVariation(variationId, content)` を新設して委譲。

### C4 §3.4 無効状態は編集不可
- 返し方: A.`BusinessRuleViolationError` throw / B.Result
- 配置: A.`EstimateVariation.assertEditable()` / B.アプリ層
- **採用: throw ＋ `EstimateVariation.assertEditable()`**。救済は「無効→有効」遷移（C5・別操作）であり同一リクエストの入力修正で解決しないため Result ではなく業務ルール違反。`_status` を持つエンティティに同居させ `replaceContent` 先頭で呼ぶ（このイシューで内容変更経路は C4 のみ＝スコープ内で完全充足）。

### granular ミューテータの位置づけ
- **採用: 温存**。`addItem/removeItem/changeItem*/changeOverallDiscount` は (b) サーバ権威の編集ごと永続化（autosave／共同編集）の将来用に残す。本イシューでは未使用。削除は別判断（スコープ外）。`deviations.md` に記録。

### インフラ（永続化）
- **判断不要**。`PrismaEstimateRepository.save()` は既存検知→トランザクション差分 upsert で更新対応済み。full-replace（新 ID）とも整合。追加実装なし。

## ステップ

### Step 1: ドメイン — §3.4 編集ガードと内容一括差替え
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
- 作業内容:
  - `assertEditable()` を追加（INACTIVE なら `BusinessRuleViolationError`、§3.4）
  - `replaceContent({ items, customerMemo, internalMemo, overallDiscount }, tax)` を追加：先頭で `assertEditable()` → 明細を一括差替え（identity 非保持） → memo/全体値引をセット → 最後に1回だけ `recalculate(tax)`
  - 単体テスト（無効時 throw / 全置換後の再計算が1回 / revisedDeliveryPrice 同梱の再現）
- コミットメッセージ: `feat: EstimateVariationに§3.4編集ガードと内容一括差替え(replaceContent)を追加`

### Step 2: ドメイン — ルートのバリエーション採番・追加・更新委譲
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/Estimate.ts`（必要に応じ `EstimateFactory.ts` の item/variation 構築を再利用）
- 作業内容:
  - `appendVariation(content)`：`max(既存番号)+1`（空なら1）で採番し、内容つきバリエーションを構築して追加（重複チェックは既存 `addVariation` 経路を流用）
  - `updateVariation(variationId, content)`：対象 variation を解決し `replaceContent` へ委譲
  - 単体テスト（採番 max+1 / 歯抜け後の衝突回避 / 更新委譲）
- コミットメッセージ: `feat: Estimate集約にバリエーション採番付き追加(appendVariation)と内容更新(updateVariation)を追加`

### Step 3: アプリ層 — 共有型と共通「税率チェック→保存」機構
- 対象ファイル: `src/server/subdomains/estimate/application/shared/`（新規: `checkTaxRateThenSave.ts`, `TaxCheckedSaveResult` / `VariationContentDescriptor`）
- 作業内容:
  - `TaxCheckedSaveResult`（`saved` | `taxRateMismatch`）と `VariationContentDescriptor`（番号なし内容、C3/C4 共用）を定義
  - `checkTaxRateThenSave(estimate, { taxCheckService, repository })`：§8.7 チェック → mismatch なら未保存 Result → consistent なら `save` して `{ kind:"saved" }`
  - 単体テスト（consistent=save される / mismatch=save されない）
- コミットメッセージ: `feat: 税率チェック→保存の共通機構checkTaxRateThenSaveと共有型を追加`

### Step 4: C2 UpdateEstimateCommand
- 対象ファイル: `application/commands/UpdateEstimateCommand.ts` ＋ `factories/updateEstimateCommandFactory.ts` ＋ `__tests__/UpdateEstimateCommand.test.ts`
- 作業内容:
  - 入力（primitive、8項目ヘッダ）→ `findById`（無ければ `NotFoundError`）→ VO 変換 → 既存 `change*` / `changeTaxRate` / `changeTaxRoundingType` 適用 → `checkTaxRateThenSave`
  - factory で `PrismaEstimateRepository` ＋ `TaxRateConsistencyCheckDomainService(PrismaTaxRateRepository)` を配線
  - 統合テスト（更新の往復 / estimateType 非更新 / 税率不一致 Result＝未保存）。mismatch テストは TaxRate マスタに2つの `effectiveFrom` 行を仕込み estimateDate/deadline が境界を跨ぐ
- コミットメッセージ: `feat: アプリ層コマンド C2 UpdateEstimate を実装する`

### Step 5: C3 AddVariationCommand
- 対象ファイル: `application/commands/AddVariationCommand.ts` ＋ factory ＋ test
- 作業内容:
  - 入力（estimateId + 番号なし内容）→ `findById` → VO 変換 → `appendVariation` → `checkTaxRateThenSave`
  - 統合テスト（採番 max+1 / 内容つき追加 / 空配列追加 / 税率不一致 Result）
- コミットメッセージ: `feat: アプリ層コマンド C3 AddVariation を実装する`

### Step 6: C4 UpdateVariationCommand
- 対象ファイル: `application/commands/UpdateVariationCommand.ts` ＋ factory ＋ test
- 作業内容:
  - 入力（variationId + 番号なし内容）→ `findById`（variation を含む集約）→ VO 変換 → `updateVariation`（§3.4 ガード経由）→ `checkTaxRateThenSave`
  - 統合テスト（全置換更新の往復 / 無効バリエーション編集で throw / 全体値引・メモ更新 / 税率不一致 Result）
- コミットメッセージ: `feat: アプリ層コマンド C4 UpdateVariation を実装する`

### Step 7: deviations 記録
- 対象ファイル: `docs/claude-plans/issue-294/deviations.md`
- 作業内容:
  - (a) §4.8 ガード先送り（Estimate↔Order リンク待ち）
  - (b) granular per-item ミューテータ未使用・将来 (b) サーバ権威編集用に温存
  - (c) 楽観ロック未対応＝lost-update 既知制約、横断対応は #301
- コミットメッセージ: `docs: issue-294 の計画逸脱・既知制約を記録`
