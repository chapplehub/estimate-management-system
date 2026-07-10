# Issue #431: 複製先・改訂先生成時の単価再解決 — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。

## 概要

見積複製先（C6）・得意先改訂先（C7）の生成時に、生成先の条件で明細単価を価格決定（`ResolveSellingPriceQuery`）により解決する。現状は複製＝`Money.zero()` クリア、改訂＝改訂元単価の全複写であり、不変則「単価＝f(宛先, 商品, 見積年月日)」が破れている。

- 複製: 複製先の見積年月日（ユーザ指定）・宛先（複製元から継承）・各バリエーションの提出区分で解決
- 改訂: 改訂先の提出区分（得意先宛）・見積の見積年月日で解決
- いずれも掛率・値引・`deliveryPrice` スナップショットは複製/改訂元から保持し、単価のみ解決
- 1明細でも解決不能なら操作を拒否（書き込み前に throw、暫定値・0円明細を作らない）

前提: 見積年月日・宛先は作成時確定の不変属性（ADR-20260710-q7t）のため、再解決契機はこの生成時2契機のみ。当初スコープの「年月日・宛先変更時の一斉再解決」は消滅（#596 が不変属性化を実装）。

実装は `/tdd`（red-green-refactor）で進める。各 Step は「テストを先に書く → 落ちることを確認 → 実装 → 通す」を単位とし、テスト規約は `testing-backend` スキルに従う。

## 設計判断

（2026-07-10 グリルセッションで確定済み。ADR-20260710-q7t・Issue #431 本文に記録）

### 解決済み単価のドメイン注入方式
- A. アプリ層で解決し、メソッド引数でドメインへ注入（採用）
- B. ドメインが単価なし記述子を返しアプリ層が後埋め
- 採用理由: ADR-0030（横断的コンテキストはメソッド引数）の既存パターンで、C1/C4 の「解決済み `Money` を含む記述子を渡す」構図と同型。B は改訂（集約メソッド内部で `EstimateItem` を生成）で成立せず方式が割れる
- 解決キー: 複製は `提出区分×商品ID`（バリエーションごとに提出区分が異なりうる）、改訂は `商品ID`（得意先宛固定）
- 単価マップの型はドメイン側で定義し（pricing を import しない）、アプリ層が構築する

### トランザクション境界・拒否時ロールバック
- 解決はアプリ層で集約に触れる前に完了する。解決不能の拒否は書き込み開始前の throw で成立し、新たなロールバック設計は不要

### 解決不能時のエラー提示
- A. 最初の1件で即拒否（既存 `PriceResolutionPolicy` の伝播）
- B. 全明細の解決を試み、解決不能な商品を**商品名で一括列挙**して1つの `BusinessRuleViolationError` で拒否（採用）
- 採用理由: 複製元が古く複数商品の販売単価が失効しているのが典型シナリオ。1件ずつの再試行を強いない。商品名は明細のスナップショット（ADR-0048）から取る。例外方針（ADR-0038）は変えない。C1/C3/C4 への波及はスコープ外

### 改訂の粗利スナップショット整合
- `deliveryPrice`（改訂元行金額の凍結・`RevisedEstimateItemDetail`）は維持。単価のみ得意先宛で解決、掛率・値引は改訂元から複写。§8.4 の粗利比較はむしろ正しく機能する

### バリエーション複製
- 再解決契機ではない。固定セマンティクス（CONTEXT「見積単価」）上「引き継ぎ」が正しい挙動。**コード変更なし**

### マップに商品が無い場合の防御
- アプリ層が全商品を解決してから渡すため通常起きないが、ドメイン側はマップ欠落時に `BusinessRuleViolationError` を throw する（黙って 0 円にしない）。既存パターン踏襲のため判断不要

## ステップ

### Step 1: 解決不能収集つき一括解決ヘルパ（アプリ層共有）
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/application/shared/resolveUnitPricesOrReject.ts`（新規・命名は実装時に調整可）
  - `src/server/subdomains/estimate/application/shared/__tests__/resolveUnitPricesOrReject.test.ts`（新規）
- 作業内容:
  - （red）テスト先行: 一意化した `(宛先, 商品ID, 商品名)` 群を解決し `キー → Money` のマップを返すこと／解決不能が混在したら**全件を商品名で列挙**した単一の `BusinessRuleViolationError` を throw すること／全件成功時は throw しないこと
  - （green）`SellingPriceResolver`（`resolveLinePrices.ts` の既存構造型）を受け、`Promise.allSettled` 相当で失敗を収集して実装
  - 既存 `resolveLinePrices` は変更しない（C1/C3/C4 の挙動を保つ）
- コミットメッセージ: `feat: 解決不能商品を一括列挙して拒否する単価一括解決ヘルパを追加`

### Step 2: 複製ドメイン — EstimateDuplicationService に解決済み単価を注入
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`
  - 同 `__tests__/EstimateDuplicationService.test.ts`
- 作業内容:
  - （red）テスト先行: `duplicate()` に解決済み単価マップ（`提出区分×商品ID` キー）を渡すと複製先明細（セット構成明細含む）の単価がマップ値になること／マップ欠落時に throw すること／掛率・率値引は従来どおり継承・固定値引クリアであること
  - （green）`duplicate()` のシグネチャに単価マップ（ドメイン定義型）を追加し、`toCopiedDescriptor` の `Money.zero()` をマップ参照に差し替え
- コミットメッセージ: `feat: 複製先明細の単価を解決済み単価マップから供給する（Money.zero を撤去）`

### Step 3: 複製アプリ層 — DuplicateEstimateCommand に価格決定を接続
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/DuplicateEstimateCommand.ts`
  - `src/server/subdomains/estimate/application/factories/duplicateEstimateCommandFactory.ts`
  - 同 `__tests__/DuplicateEstimateCommand.test.ts`
- 作業内容:
  - （red）テスト先行: 複製先の単価が「複製先の見積年月日・複製元の宛先・各バリの提出区分」で解決した値になること／解決不能商品がある場合に商品名を列挙した例外で拒否され**保存が呼ばれない**こと
  - （green）コンストラクタ・Factory に resolver（`SellingPriceResolver`）を注入。複製対象バリエーションの明細から `(提出区分, 商品ID, 商品名)` を収集し、Step 1 のヘルパで解決してマップを `EstimateDuplicationService.duplicate()` へ渡す
- コミットメッセージ: `feat: 見積複製先の生成に価格決定を接続し解決不能なら拒否する`

### Step 4: 改訂ドメイン — reviseForCustomer に解決済み単価引数を追加
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/Estimate.test.ts`
- 作業内容:
  - （red）テスト先行: `reviseForCustomer(sourceVariationId, resolvedPrices)` で改訂先明細の単価がマップ値（得意先宛解決）になること／`deliveryPrice` スナップショットは改訂元行金額のままであること／掛率・値引は改訂元から複写されること／マップ欠落時に throw すること
  - （green）引数に `商品ID → Money` のマップ（ドメイン定義型）を追加し、`item.unitPrice` の複写をマップ参照に差し替え。スナップショット生成（`RevisedEstimateItemDetail`）は変更しない
- コミットメッセージ: `feat: 改訂先明細の単価を改訂元複写から解決済み単価マップ供給に変更`

### Step 5: 改訂アプリ層 — ReviseForCustomerCommand に価格決定を接続
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/ReviseForCustomerCommand.ts`
  - 対応する Factory
  - 同 `__tests__/ReviseForCustomerCommand.test.ts`
- 作業内容:
  - （red）テスト先行: 改訂元バリエーションの商品が「得意先宛・見積の見積年月日」で解決されること／解決不能時は商品名列挙の例外で拒否され保存が呼ばれないこと
  - （green）resolver を注入し、改訂元明細の `(商品ID, 商品名)` を収集 → 得意先宛で解決 → `reviseForCustomer` へマップを渡す
- コミットメッセージ: `feat: 得意先改訂先の生成に価格決定を接続し解決不能なら拒否する`

### Step 6: UI 説明文と E2E 整合
- [ ] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/_shared/DuplicateEstimateModal.tsx`（説明文追記）
  - 改訂実行 UI（C7 の起点コンポーネント。実装時に特定）
  - 複製・改訂に関わる既存 E2E スペック（単価0や単価複写を前提にした断言があれば修正）
- 作業内容:
  - 複製モーダルの説明文に「明細単価は複製先の見積年月日・宛先で再解決される」旨を一言追加（確認ダイアログは作らない・#432 クローズ済み）
  - 改訂 UI にも同趣旨の一言を追加
  - 関連 E2E の期待値を再解決後の単価に合わせて修正（ローカルでは関連スペックのみ実行、全体は CI に任せる）
- コミットメッセージ: `feat: 複製・改訂UIに単価再解決の説明を追加しE2Eを追随`
