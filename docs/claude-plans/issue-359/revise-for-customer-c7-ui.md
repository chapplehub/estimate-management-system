# Issue #359: 見積詳細画面 得意先改訂（C7）の UI 配線 — 実装計画

> 本計画は `/grill-with-docs` セッション（2026-06-18）で合意した内容の結晶化。
> #359 はドメイン `Estimate.reviseForCustomer` ／ アプリ `ReviseForCustomerCommand` が
> 実装済み・ユニットテスト完備で、欠けているプレゼン層配線のみを対象とするスライス。
> 用語は CONTEXT.md「得意先改訂 / 改訂元 / 凍結 / 改訂先 / 改訂系譜 / 行構成固定」で既に網羅されており、
> 本セッションで新語・語義衝突・鋭利化すべき曖昧語は生じなかった（CONTEXT.md 変更不要）。

## 概要

見積詳細画面に得意先改訂（C7 `ReviseForCustomer`）の UI を実装し、既存コマンドへ配線する。
納品先宛バリエーションを改訂元として、同一見積内に得意先宛の改訂先バリエーションを生成する操作。

調査で確定した本質的前提:

- ドメイン `Estimate.reviseForCustomer(sourceVariationId)` は **内容入力を一切取らない**。改訂先の
  明細・メモ・全体値引は改訂元からの全複写でドメインが決定し、`finalAmount` を改訂後納品単価
  （`RevisedEstimateItemDetail`）としてスナップショットする（`Estimate.ts:209`）。
- したがって C3 バリエーション複製のような「プリフィルした作成フォームを開く」UX は不要。
  入力は `sourceVariationId + version` の 2 つだけで、UI は実質「ボタン → 確認モーダル → 純粋コマンド送信」。
- C7 の設計が C3/C6 より小さいのは、入力面積がコマンド署名で規定されるため（偶然ではなく
  ドメインがプレゼンを規定した結果）。スキーマ・写像・金額プレビューはいずれも不要。

## 設計判断

### 改訂元ボタンの適格条件
- A. 「納品先宛（DELIVERY_LOCATION）かつ 有効（ACTIVE）」のみ＝ドメイン2ガードの写し。再改訂を許す。
- B. A に加えて「既に改訂元になった（凍結済み）バリは除外」＝再改訂禁止。
- **採用: A**。理由:
  - 二重防御の原則。UI ゲートはドメインガード（`isDeliveryLocation() && isActive()`）の外側の写しであるべきで、
    ドメインに無い「2回目禁止」を UI だけで発明すると整合性ルールが乖離する。
  - スコープ最小。「凍結済みか」の UI 判定には DTO への per-variation 凍結フラグ追加が必要だが、
    現状 `VariationDTO` は持たない（系譜ラベルは S6 送り）。本 issue は配線のみのスライス。
  - 業務的に無害。改訂は改訂元を変更しないため、同一納品先ベースから複数の得意先向け提案を作るのは
    自然な操作。再改訂禁止が必要ならドメイン不変条件として実装すべき別関心事。

### 確認ダイアログの実装方式とエラー表示先
- A. `window.confirm`（既存タブ切替破棄と同方式）。
- B. `dialog.tsx`（shadcn Dialog）モーダル。
- **採用: B**。理由:
  - 不可逆性（改訂系譜生成＋改訂元凍結）に見合う説明責任。汎用 OK/Cancel では「凍結」を説明しきれない。
  - 税率不一致（§8.7）・楽観ロック競合（ADR-0039）の `formErrors` をモーダル内インラインに置ける。
    C7 には C4 のような常設編集フォームが無く、`window.confirm` 経路だとエラーの描画先が宙に浮く。
  - C6 がモーダル駆動コマンド（ADR-0057）にした前例にそろう。

### 確認モーダルの警告文
- A. issue 通り「改訂元の凍結」のみ告知。
- B. 凍結は常時告知し、**初回改訂時（`hasRevision === false`）のみ**「以後この見積の見積年月日・税率・
     税端数・得意先・納品先が変更不可になる」を追記。
- **採用: B**。理由:
  - 不可逆な結果の完全開示。最初の改訂はヘッダーロック（CONTEXT.md「得意先改訂」定義の本質的帰結）を
    発火させる。凍結だけ告げてロックを伏せるのは片手落ち。
  - 既存の top-level `hasRevision`（C2 の disabled 出し分け用）で「初回か」を正確に判定でき、2 回目以降は
    既にロック済みなので冗長な文言を出さない精密制御が可能。締切日・部署は改訂後も可変なので列挙から除く。

### 成功後フィードバック
- A. `ESTIMATE_UPDATED` 再利用（フラッシュ「更新しました」）。
- B. 専用 `REDIRECT_REASON.ESTIMATE_REVISED` ＋静的フラッシュ「得意先改訂しました」。タブ自動フォーカス無し。
- C. B に加えて改訂先タブを自動フォーカス。
- **採用: B**。理由:
  - 改訂は新バリを生む不可逆操作で「更新しました」では結果を取り違える。固有フィードバックが要る
    （C6 の `ESTIMATE_DUPLICATED` 前例にそろう）。
  - AC「改訂後、得意先宛の新バリが詳細画面に表示される」はタブ一覧出現で充足。自動フォーカスは未要求。
  - C は改訂先 variationId 導出（`TaxCheckedSaveResult.saved` は集約全体しか返さない）＋クエリ受け渡し＋
    `VariationPanel` の初期タブ上書きを伴い「配線のみ」を超える。望むなら別 polish/issue が素直。

### ADR の要否
- **新規 ADR は作らない**（ユーザー判断で確定）。理由:
  - 唯一の候補「改訂モーダル＝編集要素ゼロの純粋確認ゲート（C3 プリフィル／C6 ヘッダー入力と対照）」は、
    コマンド署名が内容を取らないことの直接の帰結で、その大元は ADR-0044（改訂系譜は集約内）/
    ADR-0045（提出区分不変）/ ADR-0046（改訂済みは粒度調整のみ）＋ CONTEXT.md（行構成固定・凍結）に記録済み。
    「再現困難＋驚き＋真のトレードオフ」を 3 つとも満たす新決定ではない。
  - モーダル駆動コマンドは ADR-0057（C6）が既出。C3 配線スライスも「新規 ADR 不要」と判断済みで、本スライスは
    さらに導出的。

### CONTEXT.md の要否
- **変更不要**。C7 の語彙（得意先改訂・改訂元・凍結・改訂先・改訂系譜・行構成固定）は既存定義で正確かつ網羅的。

### 実装方式（/tdd）
- 純粋モジュール（入力スキーマ）は co-located `*.test.ts` で behavior ごとに RED→GREEN（test+impl 同一コミット）。
  ただし C3/C6 と異なり写像・プレビューが無いため TDD 対象は実質スキーマのみで小さい。
- 配線層（Server Action・モーダル・Panel）はユニット不可（conform+FormData／プレゼン）のため実装先行。
  コアロジックはドメイン／アプリのユニットで検証済み・規約により E2E のみで配線を検証する（`actions.ts` に倣う）。
- E2E は配線後の統合受け入れ。bulk author せず 1 ケースずつ追加・実行する。
- `PanelMode` 判別共用体は body モード（閲覧／編集／新規追加／複製）用なので触らない。確認モーダルは body を
  置換しないオーバーレイのため、モーダル開閉は `PanelMode` と直交した別 state で管理する。

## ステップ

> **TDD 構成**: 純粋ロジック（入力スキーマ）のユニットを実装スライスへ畳み込み（RED→GREEN）、E2E のみ
> 配線後の受け入れに残す（C3/#334 計画を踏襲）。各 Step の `[ ]` は実装方式。

### Step 1: 得意先改訂の入力スキーマ ［ユニットTDD: RED→GREEN］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/reviseForCustomerSchema.ts`（新設）／`reviseForCustomerSchema.test.ts`
- 作業内容（behavior ごとに RED→GREEN、test+impl 同一コミット）:
  - `reviseForCustomerSchema` を定義（`version: number` ＋ `sourceVariationId: string`）。
  - behavior: ①有効入力（tracer）②`version` 数値強制 ③`sourceVariationId` 必須（回帰ガード）。
  - 内容フィールドは無い（ドメインが全複写で決定）ため明細系の検証は持たせない。
- コミットメッセージ: `feat: 得意先改訂（C7）の入力スキーマを追加する`

### Step 2: Server Action（C7 配線）［実装先行］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/actions.ts`
- 作業内容:
  - `reviseForCustomer` を追加。C2/C4 同型（`verifySession` → `parseWithZod`(`reviseForCustomerSchema`) →
    DTO で `estimateId` 解決 → `ReviseForCustomerInput`{estimateId, sourceVariationId, version} →
    `reviseForCustomerCommandFactory().execute()`）。
  - 税率不一致（§8.7・`taxRateMismatch`）は `taxRateMismatchFormErrors` でモーダル維持、競合・その他例外は
    `handleCommandError` 経由でフォームエラー化。成功で `revalidatePath`＋`redirect(ESTIMATE_REVISED)`。
  - テストなし（規約・コアは Step1＋ドメイン/アプリのユニットで検証済み）。
- コミットメッセージ: `feat: 得意先改訂の Server Action（C7配線）を追加する`

### Step 3: リダイレクト理由とフラッシュ ［実装先行］
- 対象ファイル: `src/server/shared/constants/redirect-reasons.ts`、`flash-message-handler.tsx`（フラッシュ文言の所在）
- 作業内容:
  - `REDIRECT_REASON.ESTIMATE_REVISED = "estimate_revised"` を追加。
  - フラッシュハンドラに静的メッセージ「得意先改訂しました」（SUCCESS）を追記。
- コミットメッセージ: `feat: 得意先改訂成功のリダイレクト理由とフラッシュを追加する`

### Step 4: 適格ゲート ［実装先行］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/variationEditable.ts`
- 作業内容:
  - `isVariationRevisableForCustomer(v)` を追加。条件は `submissionType==="DELIVERY_LOCATION"` かつ
    `status==="ACTIVE"`（ドメイン `reviseForCustomer` の 2 ガードの写し・再改訂許可で凍結判定は持たない）。
- コミットメッセージ: `feat: 得意先改訂の改訂元適格ゲートを追加する`

### Step 5: 確認モーダル ［実装先行］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/ReviseForCustomerDialog.tsx`（新設）
- 作業内容:
  - `dialog.tsx` ベースのモーダルに `useActionState` フォームを内包。隠しフィールドは `version`（prop）＋
    `sourceVariationId`（active バリの `variationId`）。
  - 警告文: 凍結は常時告知。`hasRevision === false` のときのみヘッダーロック告知を追記（締切日・部署は除外）。
  - `formErrors`（税率不一致・競合）をモーダル内インライン描画。送信中は二重送信抑止。
- コミットメッセージ: `feat: 得意先改訂の確認モーダルを実装する`

### Step 6: VariationPanel 配線 ［実装先行］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`、詳細ページ（`hasRevision` の引き回し元）
- 作業内容:
  - 操作行(⑤) にゲート付き「得意先改訂」ボタン（`isVariationRevisableForCustomer(active)` のときのみ表示）。
  - ボタン押下で確認モーダルを開く（`PanelMode` と直交した別 state）。`hasRevision` を page → `VariationPanel`
    → モーダルへ prop で通す。
- コミットメッセージ: `feat: 見積詳細画面に得意先改訂の操作を配線する`

### Step 7: E2E 統合受け入れ（1 ケースずつ追加・実行）［統合受け入れ］
- 対象ファイル: `estimates-revise-for-customer.e2e.ts`（新設）
- 作業内容（bulk author せず 1 ケース追加→`pnpm e2e`→次、を反復）:
  - ①納品先宛・ACTIVE バリの操作行にのみ「得意先改訂」ボタンが出る（得意先宛・無効では非表示）。
  - ②ボタン → 確認モーダル → 実行で、同一見積内に得意先宛の改訂先バリが出現し、改訂元が凍結される
    （改訂元タブに「内容を編集」が出ない＝凍結を UI 観測）。
  - ③初回改訂後、ヘッダー編集（C2）の見積年月日・税率・税端数・得意先・納品先が disabled になる
    （ヘッダーロックを UI 観測）。
  - 系譜・凍結の DB アサートはしない（ADR-0012: テストで Prisma 直接利用禁止）。ドメイン保証は
    ユニットテスト済みとして扱い、E2E は UI 観測可能な結果のみ検証する。
- コミットメッセージ: `test: 得意先改訂（C7）の E2E を追加する`

### Step 8: ドキュメント整合
- 対象ファイル: `docs/business/estimate/ユースケース一覧(見積).md`、（逸脱があれば）`docs/claude-plans/issue-359/deviations.md`
- 作業内容:
  - ユースケース一覧の C7 行の入力粒度を `estimateId + sourceVariationId + version` に更新し、UI が純粋確認
    ゲート（内容入力なし）である旨を注記する。
- コミットメッセージ: `docs: 得意先改訂（C7）のユースケースを反映する`
