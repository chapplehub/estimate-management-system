# Issue #334: 見積詳細画面 S6 バリエーション複製・新規追加（C3） — 実装計画

> 本計画は `/grill-with-docs` セッション（2026-06-16）で合意した内容の結晶化。
> #334 本文は S5 実装前に作成されたため前提が現状とズレており、S1〜S5 の実装を調査したうえで S6 のゴールを再設計した。
> 用語は CONTEXT.md に反映済み（「複製」を上位概念化し見積複製/バリエーション複製に分割）。

## 概要

見積詳細画面に、バリエーションの **新規追加**（提出区分を選んで空のバリを追加）と **バリエーション複製**（既存バリの内容を引き継いで集約内に新バリを追加）の UI を実装し、既存の C3 `AddVariation` コマンドへ配線する。

- #334 本文のスコープ（C3/C6/C7）を **C3 のみ**に絞り込んだ。C7（得意先改訂）・C6（見積複製）は別スライス（別 issue）へ分割する。
- 調査で判明した前提（#334 本文との差分）:
  - C3 `AddVariationCommand`・ドメイン `Estimate.appendVariation(content, submissionType)` は **実装済み・ユニットテスト完備**。本文の「C3/C6/C7 は実装済み・UI 配線が主」は **C3 については正確**で、S3(#331) のような BE 補修は不要。
  - 欠けているのは **プレゼン層配線のみ**。`actions.ts` には C2(`updateEstimateHeader`)/C4(`updateVariationContent`) しかなく、C3 用 Server Action と `VariationPanel` の複製/追加ボタンが皆無。これが本スライスの主作業。
  - S4/S5 の C4 編集パイプライン（`fromVariationLines` → nodes → JSON hidden(ADR-0050) → `toVariationContentInputFromNodes`）が複製プリフィルにそのまま再利用できる。

## 設計判断

### スコープ分割（S6 を C3 のみに限定）
- C3（新規追加・複製プリフィル）のみを S6 で実装する。
- C7（得意先改訂）は **別スライス（別 issue）** へ分離（集約内・詳細画面内完結で S6 と同規模・独立着手可）。
- C6（見積複製）は **#351（C1 新規作成画面）に依存させ先送り**し、別 issue 化する（ADR-0042 の「見積のみ複製はプレゼン層のヘッダ引き継ぎ新規作成 UX」想定に合致）。
- 理由: C3/C7 は集約内・`version` 楽観ロック往復で詳細画面内完結。C6 は集約またぎ・新採番・新ヘッダー入力（見積日/締切/部署/税率）・画面遷移を伴い性質が異なる。スコープ分割で 1 スライスを小さく保つ。

### 用語（CONTEXT.md 反映済み）
- 「複製 (Duplication)」を上位概念とし、**見積複製 (Estimate Duplication, C6)**＝集約またぎ・系譜(`EstimateVariationCopy`)あり・単価クリア、**バリエーション複製 (Variation Duplication, C3 経路)**＝集約内・系譜なし・単価引き継ぎ、に書き分けた。
- 「改訂」案は却下。理由: C3 操作と得意先改訂(C7) は系譜・凍結・行構成固定の 3 点すべてが真逆であり、同名にすると「改訂したのに元が凍結も系譜もされない」混線が生じる。「複製」は修飾語でスコープ（集約内/またぎ）を明示でき、duplicate の語義（並列に増やす）が C3 の性質に合う。

### 複製プリフィルの UX
- 「複製」押下で、既存バリ内容を初期値にした **作成フォームを開く**（即追加ではない）。編集して保存で `appendVariation`。
- 理由: S4/S5 の C4 編集パイプラインと共通部品（`LineEditTable`/`previewAmounts`/JSON hidden）を再利用でき実装量が小さい。

### 提出区分の扱い
- バリエーション複製は提出区分を **引き継ぐ（変更不可）**。新規追加は提出区分を **選択できる**（白紙だから）。
- 理由: 提出区分を変える操作は得意先改訂(C7) の役割（ADR-0045: 提出区分はバリ単位の不変属性、宛先切替の業務操作は存在しない）。

### 複製元の適格性（3 軸）
- **改訂明細**: 改訂スナップショットを持つ明細を含むバリ（改訂先）は複製元にできない。改訂元（凍結された通常明細のバリ）は複製可。理由: 改訂スナップショットは改訂系譜と不可分の凍結状態で、系譜なしの新バリへ持ち越すと整合が壊れる。S4 `variationEditable.ts` の「改訂明細を含まない」条件と揃える。
- **提出区分**: 問わない。改訂明細を含まなければ得意先宛バリ（直接作成・複製由来）も複製元にでき、「得意先宛→得意先宛」の複製を許す。
- **バリエーション状態**: 問わない。無効(INACTIVE)バリも複製元にでき、複製先は新規 ACTIVE として生まれる。理由: 複製は複製元を変更しない読み取り操作で、無効状態を侵さない。「ボツ案を土台に再検討」は自然な業務操作。

### セット群を含むバリの複製
- 構成明細は複製元の **スナップショットをそのまま引き継ぐ**（セット商品からの再展開はしない）。
- 理由: 複製＝内容を保つ。単価引き継ぎと一貫。技術的にも `fromVariationLines` が既存 `components` をそのまま nodes 化する＝これそのもの。無効構成商品の警告(ADR-0052/S5) も引き継ぐ。

### 起点とフォーム構造
- 複製元＝現在表示中のバリ（active タブ）。操作行(⑤) に「複製」ボタンを置き、**改訂先バリのタブには出さない**（適格性の UI 反映）。
- 新規追加は「＋バリエーション追加」ボタン。
- どちらも C4 編集トグルと独立した第 3 モード（作成フォーム `isCreating`）を開く。複製は初期内容＝複製元コピー＋提出区分を固定表示、新規追加は空内容＋提出区分を選択。
- **保存するまで新バリは作られない**（作業コピー）。保存で `AddVariation` が連番採番(§A.2)→ `revalidatePath`＋`redirect`。キャンセルで破棄。

### 実装細部（S3/S4 踏襲のため判断不要）
- `version` を集約ルートで往復する楽観ロック（ADR-0039）。
- 保存時に `checkTaxRateThenSave` を通り、税率不一致(§8.7) は `TaxCheckedSaveResult` でフォーム維持（C2/C4 と同型）。
- 明細ゼロのバリも保存可（S4 でドメインが空配列を許可済み）。
- 新規追加フォームの明細追加時、`LineEditTable` 共有により周辺商品サジェスト(S4) もそのまま踏襲。

### ADR の要否
- 新規 ADR は不要。用語は CONTEXT.md、系譜なしは D4、複製系譜・最低 1 件は見積複製側の ADR-0040/0042、提出区分の不変性は ADR-0045 で既出。「再現困難＋驚き＋真のトレードオフ」を 3 つとも満たす新決定は無い。

### 実装方式（/tdd）
- 純粋モジュール（作成スキーマ・複製写像）は co-located `*.test.ts` で behavior ごとに RED→GREEN（test+impl 同一コミット）。本来の TDD 対象。
- 配線層（Server Action・作成フォーム・Panel）はユニット不可（conform+FormData／プレゼン）のため実装先行。コアロジックは前段で TDD 済み・規約により E2E のみで検証（`actions.ts` に倣う）。
- E2E は配線後の統合受け入れ。bulk author せず 1 ケースずつ追加・実行する。
- 理由: `/tdd` の反・水平スライス則が効くのは red-green が成立する純粋ロジック層。テストを最後に一括する旧 Step 構成は crap test 化するため、ユニットは各実装スライスへ畳み込み、E2E のみ配線後の受け入れに残す。

## ステップ

> **TDD 再設計（選択 B）**: 旧構成は Step1〜5＝実装・Step6＝ユニット＋E2E 一括で、`/tdd` の反・水平スライス則に反した。純粋ロジックのユニットを各実装スライスへ畳み込み（RED→GREEN）、E2E のみ配線後の受け入れに残す。各 Step の `[ ]` は実装方式（ユニットTDD／実装先行／統合受け入れ）。

### Step 1: バリエーション追加の入力スキーマ ［ユニットTDD: RED→GREEN］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/variationSchema.ts`（拡張）／`variationSchema.test.ts`（追記）
- 作業内容（behavior ごとに RED→GREEN、test+impl 同一コミット）:
  - `addVariationNodeSchema` を追加。共通フィールド（version/全体値引/メモ/nodes）を `variationContentFields` に抽出して C4 と共有し、`variationId` を外して `submissionType` を加える。
  - behavior: ①有効入力（tracer）②`submissionType` 列挙強制（CUSTOMER/DELIVERY_LOCATION）③必須（回帰ガード）。`nodes`/メモは C4 で検証済みのため重複させない。
- コミットメッセージ: `feat: バリエーション追加の入力スキーマ（提出区分付き）を追加する`

### Step 2: 複製元 → 作成フォーム初期値の写像 ［ユニットTDD: RED→GREEN］
- 対象ファイル: `variationDuplication.ts`（純粋モジュール新設）／`variationDuplication.test.ts`
- 作業内容（behavior ごとに RED→GREEN）:
  - `toCreateInitialValuesFromVariation(source: VariationDTO)` を `fromVariationLines` 再利用の薄いアセンブラとして実装。
  - behavior: ①提出区分の引き継ぎ（tracer）②セット群スナップショットの保持 ③全体値引・メモの引き継ぎ。
  - **改訂列ドロップは別 behavior にしない**: `WorkingLine` 型に `revisedDeliveryPrice` が無く構造的に保証される（＋適格性上、改訂先バリは複製元になれない）。
- コミットメッセージ: `feat: 複製元バリエーションから作成フォーム初期値への写像を追加する`

### Step 3: Server Action（C3 配線）［実装先行］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/actions.ts`
- 作業内容:
  - `addVariation` を追加。`updateVariationContent` と同型（`verifySession` → `parseWithZod`(`addVariationNodeSchema`) → DTO で `estimateId` 解決 → `toVariationContentInputFromNodes` → `AddVariationInput`{estimateId, version, submissionType, content} → `addVariationCommandFactory().execute()`）。
  - 税率不一致・競合はフォーム維持、成功で `revalidatePath`＋`redirect`。
  - テストなし（規約・コアは Step1/2 で TDD 済み）。
- コミットメッセージ: `feat: バリエーション追加の Server Action（C3配線）を追加する`

### Step 4: 作成フォーム ［実装先行］
- 対象ファイル: `VariationCreateForm.tsx`（新設。`VariationEditForm` の共通部品を共有）
- 作業内容:
  - `LineEditTable`/`previewAmounts`/JSON hidden を共有し、作成モードのフォームを実装する。
  - 提出区分: 新規追加＝選択 UI、複製＝固定表示（引き継ぎ・変更不可）で分岐する。
  - 初期 nodes を空（新規）／複製元コピー（Step2 の `toCreateInitialValuesFromVariation` 出力）で受け取る。
- コミットメッセージ: `feat: バリエーション作成フォーム（新規追加・複製プリフィル）を実装する`

### Step 5: VariationPanel 配線 ［実装先行］
- 対象ファイル: `VariationPanel.tsx`
- 作業内容:
  - 操作行(⑤) に「複製」ボタン（改訂先タブでは `isVariationEditable` 相当のゲートで非表示）、別途「＋バリエーション追加」ボタンを置く。
  - `isCreating` 状態で作成フォームを開く（C2/C4 トグルと独立）。複製元＝active タブのバリ。
  - 編集中のタブ切替は破棄確認（S4 同様）。
- コミットメッセージ: `feat: 見積詳細画面にバリエーション複製・新規追加の操作を配線する`

### Step 6: E2E 統合受け入れ（1 ケースずつ追加・実行）［統合受け入れ］
- 対象ファイル: `estimates-variation-create.e2e.ts`（新設・`estimates-variation-edit.e2e.ts` と分離）
- 作業内容（bulk author せず 1 ケース追加→`pnpm e2e`→次、を反復）:
  - ①提出区分を選んで新規追加→空バリ保存→一覧反映。
  - ②既存バリを複製→プリフィル内容一致（提出区分固定・セット群引き継ぎ）→保存→複製バリが独立 ACTIVE で出現・複製元は不変。
  - ③改訂先タブに「複製」ボタンが出ない（適格性の UI 反映）。
  - **「系譜なし」は E2E で DB アサートしない**（ADR-0012: テストで Prisma 直接利用禁止）。系譜なしは C3 `AddVariation` の設計上の保証（ドメインユニットテスト済み）として扱い、E2E は上記 UI 観測可能な結果のみ検証する。
- コミットメッセージ: `test: バリエーション複製・新規追加の E2E を追加する`

### Step 7: ドキュメント整合 + 分割 issue 起票
- 対象ファイル: `docs/business/estimate/ユースケース一覧(見積).md`、（逸脱があれば）`docs/claude-plans/issue-334/deviations.md`
- 作業内容:
  - ユースケース一覧の C3 行の入力粒度を `estimateId + version + submissionType + content` に更新し、バリエーション複製が C3 経由である旨を注記する。
  - C7（得意先改訂）・C6（見積複製・#351 依存）の分割 issue を `/create-issue` で起票する。
- コミットメッセージ: `docs: バリエーション複製の用語と C3 ユースケースを反映する`
