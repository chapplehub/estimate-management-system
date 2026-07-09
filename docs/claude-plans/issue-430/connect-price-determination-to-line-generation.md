# Issue #430: 見積明細生成への価格決定接続と単価固定化 — 実装計画

## 概要

明細生成（商品選択・セット展開）時に価格決定（#428 `ResolveSellingPriceQuery`）で見積単価を確定・固定し、単価の手入力を全撤去する（ADR-0064）。C1（新規作成）・C3（バリ追加）・C4（内容編集）の保存時にサーバーが権威解決し、FE は商品選択時に表示用解決アクションで読み取り専用表示する。金額調整は掛率・明細値引・全体値引のみに限定される。

実装は `/tdd`（red-green-refactor）で進める。各ステップは「テスト先行 → 実装 → リファクタ」を1単位とし、意味のあるまとまりでコミットする。

**コンテキスト管理**: Step 2 完了後・Step 5 完了後・Step 8 完了後の3箇所で `/compact` を実行する（各ステップのコミット直後＝クリーンな作業ツリーで行うこと）。**compact 直後の最初の行動は、本計画ファイルと ADR-20260709-5ea の再 Read に固定する**。実装済みヘルパーの公開 API は実コードを再 Read して確認する。

**スコープ外（グリルセッションで確定した線引き）**:
- 再解決契機（複製先生成・改訂先生成・見積年月日/宛先変更。永続前後とも）→ #431
- 一斉再解決前の確認 UI → #432
- 固定単価とマスタ現在値の乖離警告 → #593（本セッションで起票済み）
- `ReviseForCustomerCommand` の単価コピー・`DuplicateEstimateCommand` の 0 円クリアは現状維持（#431 で再解決化）

**許容する中間状態**: C1/C3 フォームで明細追加後に見積年月日・宛先・提出区分を変えた場合、表示中の単価は古いまま残る（保存時の権威解決が最終値で行われるためデータの正しさは成立。表示追従は #431/#432 が埋める）。複製先の 0 円明細も #431 まで残る。

## 設計判断

いずれもグリルセッション（2026-07-09）で合意済み。

### C4 全置換モデル下での既存行単価の扱い
- A. 保存時に全行を毎回再解決する
- B. ペイロードに `itemId`（optional）を追加し、既存行（itemId 一致かつ productId 不変）は永続値を保全、新規行・商品変更行のみ解決する
- 採用: B（**ADR-20260709-5ea 起票・コミット済み**。A は C4 保存が裏口の再解決契機になり CONTEXT.md「見積単価」の固定セマンティクスと ADR-0064 の契機限定に反する。itemId は単価保全の突合キーのみで永続化 identity には使わない。偽造/不一致 ID は新規行扱い＝安全側なので検証不要）

### 解決ロジックの配置
- A. C1/C3/C4 各コマンドに個別実装
- B. estimate の application/shared に共通ヘルパーを置き、コマンドファクトリで pricing の `resolveSellingPriceQueryFactory()` を注入
- 採用: B（`variationContentInput.ts` の C3/C4 共有前例に倣う。ドメインは解決済み `Money` を受け取るだけで pricing を import しない＝ADR-20260626-p3w の消費側マッピング責務をアプリ層に置く。商品ID単位でデデュープし `Promise.all` で並列解決）

### FE の単価表示と解決タイミング
- A. 商品選択時に表示用解決 Server Action を呼び読み取り専用表示（保存時はサーバーが権威解決）
- B. 保存まで単価非表示
- 採用: A（行金額のライブ計算を維持し早期フィードバック。`_shared/tax-rate-actions.ts` の「表示はライブ解決・確定は submit 時に再確定」前例を踏襲。ペイロードから `unitPrice` を削除しクライアント値は一切受け取らない）

### 解決不能商品の選択時 UI
- A. 行を追加せずその場でエラー表示（セットは1構成でも不能なら展開ごと拒否）
- B. エラー行として追加し保存ブロック
- 採用: A（ADR-0064「解決不能なら操作拒否・0円明細を作らない」をフォーム内にも適用。保存時の `BusinessRuleViolationError` は選択後にマスタが変わった稀ケースの安全網として既存フォームエラー経路で表示）

### 撤去範囲（ADR-0064「鎖全体を一括」）
- 撤去: `EstimateItem.changeUnitPrice` / `EstimateVariation.changeItemUnitPrice` / `Estimate.changeItemUnitPrice` / `ItemPriceAdjustment.unitPrice`（`adjustPricing`）/ `AdjustRevisedVariationCommand` の単価入力 / C1/C3/C4 入力・zod スキーマの `unitPrice` / FE 単価入力フィールド
- 存続: `EstimateItem.create`・`EstimateFactory` の `unitPrice: Money`（解決済み値の受け口。再構成経路でも必要）、`Money`・金額再計算ロジック
- データ移行: 不要（既存見積の単価は確定値としてそのまま残る。スキーマ変更なし）

## ステップ

### Step 1: 単体テスト用の販売単価シナリオ生成ヘルパー
- 対象ファイル: pricing のテストサポート（既存の Factory＋Mapper＋seed client パターンに倣った新規ヘルパー）
- 作業内容:
  - 共通販売単価・得意先別・納品先別の期間行をテストが自前生成できるヘルパーを整備（seed-unit は正準マスタのみの方針を維持）
  - 以降のステップのコマンドテストが「販売単価マスタ行が前提」になるための土台
- コミットメッセージ: `test: 単体テスト用の販売単価シナリオ生成ヘルパーを追加 (#430)`

### Step 2: 価格解決共有ヘルパー（application/shared）を TDD で実装
- 対象ファイル: `src/server/subdomains/estimate/application/shared/`（新規: 例 `resolveLinePrices.ts`）
- 作業内容:
  - Red: 明細ノード群＋宛先コンテキスト（`SubmissionType`＋宛先ID＋見積年月日）→ `SellingPriceResolutionTarget` へのマッピング、商品IDデデュープ・並列解決、`SellingUnitPrice`→`Money` 変換、既存明細突合（itemId 一致かつ productId 不変→永続値保全）、解決不能時の `BusinessRuleViolationError` 伝播、のテストを先行
  - Green: ヘルパー実装。`ResolveSellingPriceQuery` はコンストラクタ引数で受ける（テストではモック/実 DB どちらも可能な形）
- コミットメッセージ: `feat: 明細価格解決の共有ヘルパーを application/shared に追加 (#430)`

> **📦 /compact ポイント①**（基盤完了 → コマンド接続へ）: コミット後に `/compact`。再開時は本計画と Step 2 で作ったヘルパーの公開シグネチャ（実コード）を再 Read してから Step 3 に着手する。

### Step 3: C1 CreateEstimateCommand への接続
- 対象ファイル: `CreateEstimateCommand.ts`、`src/app/(features)/estimates/new/schema.ts`、`new/actions.ts`、estimate のコマンドファクトリ
- 作業内容:
  - Red: 「入力に単価を含まず、解決値で明細が生成される」「解決不能なら見積が作られず拒否」のコマンドテストを先行（Step 1 のヘルパーで販売単価を用意）
  - Green: 入力型・zod から `unitPrice` を除去し、ヘルパー解決を接続。ファクトリで `resolveSellingPriceQueryFactory()` を注入
- コミットメッセージ: `feat: C1見積作成の明細単価を価格決定で確定する (#430)`

### Step 4: C3/C4 コマンドへの接続と C4 既存行保全
- 対象ファイル: `AddVariationCommand.ts`、`UpdateVariationCommand.ts`、`application/shared/variationContentInput.ts`、`variationSchema.ts`
- 作業内容:
  - Red: C3「解決値で明細生成」、C4「既存行（itemId 一致・productId 不変）はマスタ改定後も単価保持」「商品変更行・新規行は再解決」「不一致/偽造 itemId は新規行扱い」のテストを先行（ADR-20260709-5ea）
  - Green: `lineSchema` から `unitPrice` 除去・`itemId`（optional）追加、`variationContentInput` の変換をヘルパー解決に置換
- コミットメッセージ: `feat: C3/C4の明細単価を価格決定で確定しC4既存行は永続値を保全する (#430)`

### Step 5: 単価手入力のドメイン・コマンド一括撤去
- 対象ファイル: `EstimateItem.ts`、`EstimateVariation.ts`、`Estimate.ts`、`AdjustRevisedVariationCommand.ts`
- 作業内容:
  - `changeUnitPrice` 委譲鎖3メソッド・`ItemPriceAdjustment.unitPrice`・`AdjustRevisedVariationCommand` の単価入力を一括撤去（委譲元・委譲先の消し残しを作らない・ADR-0064）
  - 撤去メソッドのテストを削除、改訂先調整のテストを「掛率・明細値引・全体値引・メモのみ」へ改修
- コミットメッセージ: `feat!: 見積単価の手入力経路をドメイン・コマンドから撤去する (#430)`

### Step 6: 表示用解決 Server Action
- 対象ファイル: `src/app/(features)/estimates/_shared/selling-price-actions.ts`（新規）
- 作業内容:
  - Red: バッチ入力 `{estimateDate, addressee, addresseeId, productIds[]}` → 商品ごとの `unitPrice | null`（解決不能は throw せず null）のテストを先行
  - Green: `tax-rate-actions.ts` 前例に倣い実装（`verifySession`・pricing ファクトリ直呼び）
- コミットメッセージ: `feat: 販売単価の表示用ライブ解決Server Actionを追加 (#430)`

### Step 7: FE 編集テーブルの単価読み取り専用化と選択時解決（C1/C3/C4 共有部品）
- 対象ファイル: `LineEditTable.tsx`、`useVariationLineEditor.ts`、`variationLines.ts`、`variationContentMapping.ts`、`ProductSuggestDialog.tsx` 周辺、各フォームの `__tests__`
- 作業内容:
  - 単価 `<input>` を読み取り専用表示へ差し替え、商品選択・セット展開時に Step 6 のアクションで解決値を取得
  - 解決不能（null）なら行を追加せずエラー表示（セットは不能な構成商品名を列挙し展開拒否）
  - `WorkingLine` は表示用に `unitPrice` を保持しつつ、ペイロード（`toNodePayload`）には `itemId` のみ載せる
  - フォームテスト・zod スキーマテストを改修
- コミットメッセージ: `feat: 明細編集テーブルの単価を読み取り専用化し商品選択時に価格決定を表示する (#430)`

### Step 8: FE 改訂先調整フォームから単価入力を除去
- 対象ファイル: `VariationAdjustForm` とその周辺・テスト
- 作業内容:
  - 改訂先調整画面の単価入力を除去し読み取り専用表示へ（編集可能は掛率・明細値引・全体値引・メモのみ）
- コミットメッセージ: `feat: 改訂先調整フォームの単価入力を撤去し掛率・値引のみに限定する (#430)`

### Step 9: E2E 改修と解決不能ケースの追加
- 対象ファイル: 見積作成・編集系の `*.e2e.ts`、e2e seed（販売単価フィクスチャ）
- 作業内容:
  - 単価入力ステップを撤去し「商品選択 → seed の販売単価から自動確定された単価・金額」のアサーションへ書き換え
  - 見積スペックで使う商品に today 相対の適用期間で共通販売単価を紐づけ（ADR-20260629-3x5。#556 系 seed の確認・補充）
  - 解決不能ケース（販売単価のない商品 → エラーで追加拒否）を1本追加
  - ローカルでは変更に関係するスペックのみ実行（全体は CI）
- コミットメッセージ: `test: 見積E2Eを単価自動確定前提に改修し解決不能ケースを追加 (#430)`

### Step 10: playwright MCP による実機確認（コミットなし）
- 対象: dev server ＋ playwright MCP（`/verify-frontend` の手順）
- 作業内容:
  - 商品選択 → 単価が自動表示・読み取り専用であること（C1/C3/C4）
  - セット展開 → 構成明細それぞれに解決値が入ること
  - 販売単価のない商品を選択 → エラー表示され行が追加されないこと
  - C4 で数量のみ変更して保存 → 既存行の単価が保持されること
  - 改訂先調整画面に単価入力が無く、掛率・値引のみ編集できること
  - 計画からの逸脱があれば `docs/claude-plans/issue-430/deviations.md` に記録
