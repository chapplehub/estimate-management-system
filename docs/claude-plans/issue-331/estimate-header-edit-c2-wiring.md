# Issue #331: 見積詳細画面 S3 見積ヘッダー編集（C2） — 実装計画

> 本計画は `/grill-with-docs` セッションで合意した内容の結晶化。
> 関連: 親 #326 / 依存 S2 #340 / 設計 `docs/design/estimate-detail/analysis/02_差分一覧と本実装方針.md` §4(S3)。
> 既決の記録: ADR-0049（冪等セッター）/ issue #341（S2 表示の TZ 依存・別スコープ）。

## 概要

見積詳細画面（②③ ヘッダー領域）に「閲覧 ⇄ 編集」のその場トグルを追加し、基本情報と修理情報を C2 へ配線する。

グリルで判明した重要事実: issue の前提「C2 実装済み・UI 配線が主」は不正確だった。
- C2 `UpdateEstimateCommand` は修理情報に未対応（集約ルートに編集入口なし）。
- C2 は全ヘッダーセッターを無条件に呼ぶため、改訂済み見積では `assertHeaderMutable` で必ず落ち、締切日・部署すら保存できない欠陥がある。

よって S3 は「UI 配線＋必要なバックエンド補修」として実装する。

## 設計判断

### 修理情報の編集経路（質問1）
- A. C2 を拡張し、集約ルートに編集メソッドを足す（採用）
- B. 修理編集を先送り / C. 専用コマンドを別途追加
- 採用理由: 修理詳細は Estimate 集約の一部。同一画面・同一保存・単一 version 往復で扱うのが自然で、2 コマンドの version 競合を避けられる。

### 改訂済み見積の編集を通す方式（質問2・ADR-0049）
- A. ドメインのセッターを「同値なら assert 前に no-op」化（採用）
- B. コマンド側で差分適用 / C. 改訂済みは編集ボタン無効化
- 採用理由: 同値設定は「変更」ではないので no-op が不変条件の意図に忠実。等価判定を VO/Date に置け、コマンドは単純なまま。副次効果で同値税率の無駄な全バリ再計算も消える。詳細は ADR-0049。

### 税率・端数の扱い（質問3・ユーザー決定）
- `taxRate` は **常に編集不可**（read-only 表示のみ。C2 入力からも削除）。
- `taxRoundingType`（端数）は **編集可**、かつ **閲覧モードにも表示**。
- 理由: 税率は master 由来で自由入力の意味が薄く、§8.7 チェックも typed 値でなく日付ベース。設計指示書 129 行「税率＝編集可」からの逸脱（deviations.md に記録）。

### 編集モードの実現方式（質問4）
- A. ヘッダー領域（②③）をクライアントアイランド化し `isEditing` でその場トグル（採用）
- B. 別ルート `/edit` / C. ページ全体クライアント化
- 採用理由: issue の「編集モード切替」に直結。④〜⑨（VariationPanel）は RSC のまま据え置ける。

### 改訂ロックの出し分け駆動データ（質問5-1）
- A. DTO に `hasRevision: boolean` を 1 つ追加（採用）。改訂済みは 見積日/得意先/納品先/端数 を disabled、締切日・部署のみ活性。最終強制はドメイン（二重防御）。

### 改訂済みでの修理情報編集（質問5-2）
- A. 修理情報は改訂後も編集可（採用）。価格に無関係なため `changeRepairDetail` 系は `assertHeaderMutable` を呼ばない。

### FK 選択 UX（質問6）
- 部署 = `<select>`（`GetActiveDepartmentsQuery` 全件・RSC 取得）。
- 得意先 / 納品先 / 修理対象機器 = `SelectionModal`（検索・単一選択）。
- 納品先は選択中の得意先で絞り込み。**得意先変更時は納品先をクリアして再選択**（集約をまたぐ整合は UI/アプリ層が担保）。

### 保存・エラーの表面化（質問7）
- 成功(`saved`)→ `revalidatePath` ＋ `redirect(?reason=ESTIMATE_UPDATED)`＋トースト（再描画で閲覧モードへ）。
- 税率不一致(`taxRateMismatch`)→ 例外でなく Result なので `submission.reply({formErrors})` で両税率提示し編集維持。
- 競合(ConflictError)・その他例外 → `handleCommandError` 経由でフォームエラー、編集維持。
- キャンセル → クライアントのみで `isEditing=false`（編集破棄）。

### フォーム構成と C2 入力（質問8）
- 単一フォーム（基本情報＋条件表示の修理情報）→ C2 1 回呼び出し。
- 修理編集は bulk ルートメソッド `changeRepairDetail` / `changeAfterRepairDetail`（子へ委譲・attach/detach なし・不在/型不一致で throw）。`afterServiceWarningAcknowledged` は対象外。
- C2 入力から `taxRate` 削除（`changeTaxRate` 呼び出しも除去）。

### 日付の JST 安全化（質問9）
- A. presentation/app 層に JST 固定ヘルパ対を新設（採用）。`toDateInputValue`（JST yyyy-mm-dd 整形）/ パースは `new Date("...T00:00:00+09:00")`。`z.coerce.date()` は使わない。
- 理由: UTC 解釈の day-shift が §8.7 の税 era 誤判定を生むため。

### スコープ外（質問10）
- §4.8 受注後編集不可 / §9 権限（作成者・同部署）/ 提出区分（ADR-0045 不変）/ estimateType（不変）/ 10万円超警告確認 / ④〜⑨ 明細・バリ操作。

## ステップ

### Step 1: ドメイン — ヘッダーセッターの同値 no-op 化（ADR-0049）
- 対象ファイル: `src/server/subdomains/estimate/domain/entities/Estimate.ts`、`__tests__/Estimate.test.ts`
- 作業内容:
  - 各ヘッダーセッター（`changeEstimateDate` / `changeDeadline` / `changeCustomer` / `changeDeliveryLocation` / `changeDepartment` / `changeTaxRate` / `changeTaxRoundingType`）に「新値＝現在値なら早期 return」を `assertHeaderMutable` より前に追加。等価は VO `equals` / Date `getTime`。
  - テスト: 改訂済みで締切日・部署のみ変更が通る／ロック項目を同値で呼ぶと no-op／異値で呼ぶと throw。
- コミットメッセージ: `feat: 見積ヘッダーセッターを同値no-op化し改訂凍結下の締切日・部署編集を成立（ADR-0049）`

### Step 2: ドメイン — 修理詳細の bulk 編集メソッド
- 対象ファイル: `Estimate.ts`、`__tests__/Estimate.test.ts`（必要なら `RepairEstimateDetail` / `AfterRepairEstimateDetail` の既存 change* を活用）
- 作業内容:
  - `changeRepairDetail({ targetProductId, faultDescription, scheduledRepairDate })` / `changeAfterRepairDetail({ targetProductId, faultDescription, actualRepairDate, emergencyReason })` を追加。既存 detail の change* へ委譲。detail 不在/型不一致は throw。`assertHeaderMutable` は呼ばない（改訂後も可）。
  - テスト: 委譲・ガード・改訂後も編集可。
- コミットメッセージ: `feat: 修理詳細の編集を集約ルートのbulkメソッドで提供する`

### Step 3: アプリ — C2 拡張（修理フィールド追加・taxRate 削除）
- 対象ファイル: `application/commands/UpdateEstimateCommand.ts`、`__tests__/UpdateEstimateCommand.test.ts`
- 作業内容:
  - `UpdateEstimateInput` に修理フィールド（repairDetail / afterRepairDetail を任意）を追加、`taxRate` を削除。`changeTaxRate` 呼び出しを除去。
  - estimateType に応じて `changeRepairDetail` / `changeAfterRepairDetail` を呼ぶ。
  - テスト: 修理更新の反映／改訂済みの締切日・部署更新（回帰）／taxRate 除去後も税率チェック機能／`taxRateMismatch` Result。
- コミットメッセージ: `feat: UpdateEstimate(C2)に修理情報編集を追加しtaxRateを入力から外す`

### Step 4: クエリ/DTO — taxRoundingType と hasRevision を追加
- 対象ファイル: `application/queries/dto/EstimateDetailDTO.ts`、`infrastructure/queries/PrismaEstimateQueryService.ts`、`application/queries/__tests__/GetEstimateDetailQuery.test.ts`
- 作業内容:
  - DTO に `taxRoundingType: string` と `hasRevision: boolean` を追加。`hasRevision` は「いずれかのバリエーションが `revisedFrom` を持つか」で導出。
  - テスト拡張。
- コミットメッセージ: `feat: 見積詳細DTOにtaxRoundingTypeとhasRevisionを追加`

### Step 5: プレゼン基盤 — JST 日付ヘルパ・リダイレクト理由・端数ラベル
- 対象ファイル: `src/app/(features)/estimates/_shared/`（date ヘルパ・labels.ts）、`src/shared/constants/redirect-reasons.ts`
- 作業内容:
  - `toDateInputValue` / `fromDateInputValue`（JST 固定）を新設。
  - `REDIRECT_REASON.ESTIMATE_UPDATED` ＋フラッシュ文言を追加。
  - `TAX_ROUNDING_TYPE_LABELS`（切捨/切上/四捨五入）を labels.ts に追加。
- コミットメッセージ: `feat: 見積編集用のJST日付ヘルパ・ESTIMATE_UPDATED理由・端数ラベルを追加`

### Step 6: プレゼン — ヘッダー編集アイランド・フォーム・Server Action
- 対象ファイル: `[estimateNumber]/EstimateHeaderSection.tsx`（新規・client island）、`EstimateHeaderForm.tsx`（新規）、`actions.ts`（新規）、`schema.ts`（新規）、`page.tsx`（島へ DTO・部署一覧を渡す／②③ を島に置換／閲覧に端数表示追加）
- 作業内容:
  - `isEditing` トグル。単一フォーム（conform + useServerForm）。基本情報＋条件表示の修理情報。
  - 部署 `<select>`、得意先/納品先/修理対象機器 `SelectionModal`、得意先変更で納品先クリア。
  - `taxRate` read-only 表示、`taxRoundingType` 編集（select/ラジオ）。改訂済みは見積日/得意先/納品先/端数 disabled。
  - Server Action: zod 検証 → JST パース → C2 実行 → 成功 redirect / `taxRateMismatch`・例外をフォームエラーへ。
  - 閲覧モードにも端数処理を表示。
- コミットメッセージ: `feat: 見積詳細ヘッダーの閲覧⇄編集トグルと基本情報・修理情報の編集を配線（C2）`

### Step 7: E2E ＋ seed
- 対象ファイル: `estimates-detail.e2e.ts`、seed（通常／改訂済み／REPAIR の見積を保証）
- 作業内容（ADR-0012/0017/0020 準拠・Prisma 直叩き禁止）:
  - ハッピーパス（締切日・部署＋端数）／修理情報編集／得意先変更→納品先リセット／改訂済みロック表示。
  - 税率不一致は E2E に含めない（ユニットのみ）。
- コミットメッセージ: `test: 見積ヘッダー編集のE2E（基本情報・修理情報・得意先変更・改訂ロック）`

### Step 8: 逸脱記録（作業完了時）
- 対象ファイル: `docs/claude-plans/issue-331/deviations.md`
- 作業内容: ①taxRate 編集不可化（設計指示書 129 行からの逸脱）②C2 が修理編集も担う（issue 前提の訂正）③改訂欠陥を冪等セッターで修正、の {元計画/実装/理由} を記録。
- コミットメッセージ: `docs: issue-331 実装の逸脱記録（taxRate編集不可・C2修理編集・冪等セッター）`
