# Issue #335: 見積詳細画面 S7 無効化/有効化（C5） — 実装計画

## 概要

バリエーションの無効化/有効化（C5）を実装する。`ActivateVariationCommand` / `DeactivateVariationCommand`（ADR-0018）とトグル UI を新設し、申請ガード（進行ロック）はアプリ層の空の拡張点として置く。

- **前提**: ドメイン層は実装済み（`EstimateVariation.activate()/deactivate()`、`Estimate.activateVariation()/deactivateVariation()`、`VariationStatus`）。S2 でタブのグレーアウト・取消線・全無効警告・状態インジケータも実装済み。
- **正味の新規**: アプリ層 2 コマンド ＋ server action ＋ トグル UI 部品 ＋ 進行ロックの空拡張点。取消線等の表示は S2 既存に乗るだけ（再実装しない）。
- **実装方式**: `/tdd`（red→green→refactor）。各ステップはテスト先行で着手し、ステップ単位でコミットする。
- **ガード設計の根拠は ADR-0061 に記録済み**（CONTEXT.md「進行ロック」も追加済み・コミット `e0d75e7`）。

## 設計判断

すべてグリルで確定済み。要点と根拠を以下に記録する（詳細は ADR-0061）。

### 申請ガードの正体＝進行ロック（表示ステータス由来の単一述語）
- 無効化ガードと将来の編集ガードは同じ述語 `isCommitted(v) = 表示ステータス ∈ {申請中, 承認済, 承認不要, 受注作成済, 受注確定済, 受注取消済}` を問う。自由集合は {作成中, 差戻, 取下}。
- 受注取消済もロックに含める（一度でも承認・受注到達したバリは隠せない監査一貫性を、可逆性より優先）。
- メモは進行ロックを貫通（ADR-0059 の拡張）。有効化はガードなし。
- 採用根拠: 無効化専用 no-op（自由集合の二重定義リスク）より述語共有が優位。

### 拡張点の配置と形
- 配置: ドメイン不変条件ではなく**アプリ層**（判定材料が Estimate 集約の外＝申請・免除・受注、ADR-0053/0058。表示ステータスを QueryService で引く ADR-0056 型）。
- 形: **案 X**＝`DeactivateVariationCommand` 内の private no-op メソッド。`estimate.deactivateVariation()` 直前に置き、接続先（`EstimateApplicationStatusQueryService` 仮）・契約をコメント明示。
  - 不採用: 案 Y（ポート interface 先出し）。no-op のための投機的抽象で ADR-0052 の方針（ポートより引数）と不整合。

### コマンドの形
- ADR-0018 に従い `Activate` / `Deactivate` を分離。入力 `{ estimateId, variationId, expectedVersion }`、戻り値 `Estimate`。
- 金額・税額を動かさないため `checkTaxRateThenSave` を通さない素の version 付き保存（`ActivateProductCommand` / `UpdateVariationMemosCommand` 同型）。
- 冪等 no-op（既状態でもエラーにしない）。並行競合はルート version の `ConflictError`（ADR-0039）で防御し、特別扱いしない。
- 全無効ガードは入れない（CONTEXT「全バリ無効も正規の状態」、代表バリ選択は ADR-0051 が全無効時規則を持つ）。

### UI
- 操作行（⑤）に自己完結部品 `VariationStatusToggle` を追加。`ProductStatusForms` 踏襲（form+button・`version` hidden 往復・色＝無効化:黄/有効化:緑・インラインエラー）。
- 確認ダイアログなし（可逆操作。Product 前例どおり）。全バリに無条件表示（凍結・改訂先も状態と直交）。server action は detail パスを revalidate。

### 用語
- バリエーション無効化操作に新規正準用語は追加しない（対象語で「商品の無効化／バリの無効化」と曖昧さは解消。状態は「バリエーション状態」、ロックは「進行ロック」がカバー）。

## ステップ

### Step 1: アプリ層コマンド（Activate / Deactivate）を TDD で実装
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/ActivateVariationCommand.ts`（新規）
  - `src/server/subdomains/estimate/application/commands/DeactivateVariationCommand.ts`（新規）
  - 各 `__tests__/*.test.ts`（新規）
  - 不足時のみ `EstimateVariation` / `Estimate` の状態遷移テスト補完
- 作業内容（red→green）:
  - Red: テスト先行。正常系（status 反転＋ルート version +1）、古い `expectedVersion` → `ConflictError`、`DeactivateVariationCommand` の進行ロック拡張点が現状 no-op であること（後日接続時に書き換わる足場）
  - Green: 2 コマンド実装。入力 `{ estimateId, variationId, expectedVersion }`、戻り値 `Estimate`、素の version 付き保存
  - `DeactivateVariationCommand` に private async `assertDeactivatable(estimateId, variationId)` を no-op で配置（ADR-0061・案 X、接続先と契約をコメント明示）
- コミットメッセージ: `feat: バリエーション有効化/無効化コマンドを追加（進行ロックの空拡張点を含む）`

### Step 2: server action を配線
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/actions.ts`（既存に追記）
- 作業内容:
  - `activateVariation` / `deactivateVariation` server action（FormData→コマンド実行→`revalidatePath`）。既存 action のエラー整形・楽観ロック往復パターンを踏襲
  - リダイレクト理由は ADR-0018 に従い ACTIVATED / DEACTIVATED を既存 toast 機構に合わせて定義（detail 画面の既存方式に準拠）
- コミットメッセージ: `feat: バリエーション有効化/無効化の server action を配線`

### Step 3: トグル UI 部品を操作行に追加
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/VariationStatusToggle.tsx`（新規）
  - `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`（操作行⑤に組み込み）
- 作業内容:
  - `ProductStatusForms` 踏襲の form+button 部品（`version` hidden・色・`useActionState` インラインエラー）
  - 全バリに無条件表示（ACTIVE→無効化／INACTIVE→有効化）、確認ダイアログなし
  - 取消線・グレーアウト・全無効警告・状態インジケータは S2 既存をそのまま利用（変更しない）
- コミットメッセージ: `feat: 見積詳細にバリエーション有効化/無効化トグルを追加`

### Step 4: E2E を 1 本追加
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/*.e2e.ts`（`create-e2e-test`／ADR-0012・0017・0020 準拠）
- 作業内容:
  - 有効バリを無効化 →「○ 無効」インジケータ＋タブ取消線を確認 → 再有効化で戻る
  - 全バリ無効化時の警告表示を同シナリオで確認
- コミットメッセージ: `test: バリエーション有効化/無効化の E2E を追加`
