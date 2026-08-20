# Issue #351: 見積の新規作成画面（C1 CreateEstimate の UI） — 実装計画

## 概要

新規見積作成ルート `/estimates/new` と作成フォームを実装し、`CreateEstimateCommand` を1回駆動して見積を原子的に新規作成、作成後に詳細画面（`[estimateNumber]`）へ遷移する。

- ヘッダー基本情報（見積年月日・締切日・得意先・納品先・部署・税端数区分・見積区分）＋ 区分別サブタイプ詳細（修理／事後修理）＋ 初期バリエーション1件（提出区分・通常明細・自動展開セット群・全体値引・メモ）を**単一の統合フォーム**で入力し、**単一の `createEstimate` Server Action** でまとめて保存する（空見積不可＝≥1バリの原子的作成）。
- 税率はユーザー入力にせず、見積年月日からマスタ導出して read-only 表示（編集画面と統一）。§8.7 税率不一致は保存せずフォームエラーで警告する。
- 編集画面（#342/#346/#333 で出荷済み）と**部品・ロジックを積極的に統一**する方針（不都合がない箇所のみ）。統一の単位はラッパフォーム丸ごとではなく、内側の dumb 部品と検証ロジックの原子。

**グリル中に生成済みの成果物**:
- issue **#374**: 部署初期値を作成者の所属部署から自動解決（バックエンド込み・#351 では手動 select で進め、自動解決はこの後続 issue）。
- **ADR-0056**: 見積作成の税率導出＋整合チェックは `CreateEstimateCommand` に内包せず app-shared ラッパに置く（採用済み・本計画 Step 1 の根拠）。

## 設計判断

### 税率の供給（導出 vs 手入力）
- A. 見積年月日からマスタ導出・read-only（§8.7 チェックの `consistent.rate` を採用税率に流用）
- B. issue 文面どおりユーザーが手入力
- **採用: A**。編集画面の read-only 方針・CONTEXT の設計意図と一致し、整合チェックが既に解決する税率を再利用できて手入力欄も別ロジックも不要。

### 税率導出＋§8.7 チェックの配置（ADR-0056）
- A. `CreateEstimateCommand` に内包し戻り値を `{created|taxRateMismatch}` union に変更（更新系 C2/C3/C4 と完全対称）
- B. `CreateEstimateCommand` 据え置き＋ app-shared `checkTaxRateThenCreate` を新設しアクションが使用
- **採用: B**。既存 `TaxRateConsistencyCheckDomainService` を再利用（ロジック統一）、`checkTaxRateThenSave` と app-shared 層で対称。コマンドを純粋な組立器に保ち、多数のテストフィクスチャ（ReviseForCustomer/AddVariation/UpdateVariation/UpdateEstimate）を壊さない。作成は更新に無い「導出」を持つので専用オーケストレーションは正当な非対称。

### フォーム骨格（統合 vs 分割）
- A. 単一統合フォーム＋単一アクションで原子的作成
- B. ヘッダーと初期バリを別アクションで段階保存
- **採用: A**。空見積不可（≥1バリ必須）の原子性が B（下書き状態という新概念や一瞬の空見積）を構造的に排除する。

### ヘッダー部の統一手段
- a. 共有 dumb 部品（修理/事後修理塊・FK選択フィールド）を抽出し、出荷済み編集フォームも差し替え
- b. 共有部品は新設するが編集側差し替えは別 issue へ繰り延べ
- c. `EstimateHeaderForm` を mode:create|edit でパラメータ化
- **採用: a**。重複を残さない統一方針に最も忠実。神コンポーネント化を避けつつ将来改修を1箇所に集約。出荷済みコードへ手が入るコストは許容（[[feedback_unify_create_with_edit_screen]]）。

### 作成者・部署の解決
- 作成者 = `session.user.employeeId`（read-only・null は作成不可）。表示名は Employee を引いて「氏名（コード）」。
- 部署 = 有効部署の手動 select（プレースホルダ必須選択）。所属からの自動解決は後続 #374（ポート新設を伴うためスコープ外）。

### 初期バリエーション件数
- **正確に1件**。提出区分は得意先宛／納品先宛を自由選択（ADR-0045・得意先宛も直接作成可）。2件目以降は詳細画面の C3 追加／複製で足す（複数バリ管理の二重実装回避）。

### セット群対応
- 自動展開のみ（手動構成追加は #350 へ繰り延べ済み）。`VariationLineEditor`＋`useVariationLineEditor`（ADR-0050 のノード JSON 直列化）を再利用。
- 作成配線に `PrismaProductQueryService` を注入し `assertSetComponentsValid`（ADR-0052・ペイロード防御）を C4 と同型で効かせる。

### 税率プレビューの供給（作成中はまだ税率が確定しない問題）
- a. 見積年月日変更時にサーバで有効税率をライブ解決し、ヘッダー read-only 表示＆ `VariationLineEditor` のプレビュー税率に使用（submit で案B が再確定）
- b. 現在税率を既定値で近似
- **採用: a**。プレビュー金額は意思決定材料で、税率境界付近の submit 食い違いを避ける。同じ `findEffectiveAt` を使い編集画面と表示・ロジックを統一。

### 作成スキーマの構成・サブタイプ必須性
- 専用 `createEstimateSchema` を共有原子（`nodesField` 等・要 export）から組む。`version`・`taxRate` は含めない。`updateEstimateHeaderSchema`/`addVariationNodeSchema` を丸ごとは再利用しない（version/taxRate 差分のため）。
- サブタイプ必須性は schema の `superRefine` で条件必須化（NEW=不要 / REPAIR=修理3項目 / AFTER_REPAIR=事後修理3項目）。エラーは各フィールドパスへ付与。編集（アクション側担保）からの意図的乖離だが、作成は estimateType を submit に持つため正当。

### テスト戦略（/tdd 前提・test-first）
- **単体テストは各ステップ内で test-first**（red→green→refactor）で書く。テストを末尾に固めない（`/tdd` の red-green ループと矛盾するため）。
- 単体で押さえる対象（純粋ロジック・検証）= `checkTaxRateThenCreate`（Step 1）、`createEstimateSchema` の conform 経路（Step 3）。これらは「テスト → 実装」の順で進める。
- UI（Step 4〜6）は React コンポーネント主体で単体 TDD の対象が薄いため、**E2E を外側の受け入れループ**として検証する。Step 4 の出荷済みフォーム差し替えは既存テスト／E2E が回帰ガードになる（red-green-refactor の refactor フェーズ）。
- **E2E（Step 7）は受け入れ条件の貫通検証（外側ループ）**。最後に置くのは「単体を後回しにする」意味ではなく、各ステップで test-first 済みの実装を統合して受け入れ確認するため。先に失敗する E2E を雛形として置いてから内側の単体ループを回す進め方（ダブルループ）でもよい。

## ステップ

### Step 1: app-shared `checkTaxRateThenCreate` ＋ 作成配線ファクトリ
- 対象ファイル: `src/server/subdomains/estimate/application/shared/__tests__/checkTaxRateThenCreate.test.ts`（新規・先）、`checkTaxRateThenCreate.ts`（新規）、作成配線ファクトリ（`createEstimateCommandFactory.ts` 拡張 or 新設）
- 作業内容（**test-first**）:
  - **(red)** 先に `checkTaxRateThenCreate.test.ts` を書く: consistent→`created` / mismatch→`taxRateMismatch` union を、税率リポジトリのモックで 8%/10% 境界を作って検証
  - **(green)** §8.7 チェック→`consistent` なら解決税率を `taxRate` に詰めて `CreateEstimateCommand` へ委譲→`{created|taxRateMismatch}` を返すヘルパを実装（`checkTaxRateThenSave` と同型）
  - Composition Root で `TaxRateConsistencyCheckDomainService`（＋`PrismaTaxRateRepository`）と `CreateEstimateCommand`（`PrismaProductQueryService` 注入・ADR-0052）を解決
- コミットメッセージ: `feat: 見積作成の税率導出＋§8.7チェックを app-shared checkTaxRateThenCreate に実装（ADR-0056）`

### Step 2: 税率ライブ解決の Server Action
- 対象ファイル: `src/app/(features)/estimates/_shared/` 配下に税率解決アクション（新規）
- 作業内容:
  - 見積年月日（"yyyy-mm-dd"）を JST パースし `TaxRateRepository.findEffectiveAt` で有効税率を返す薄い Server Action
  - ヘッダー read-only 表示・プレビュー税率の供給に使う
- コミットメッセージ: `feat: 見積年月日から有効税率を解決する Server Action を追加（作成画面プレビュー用）`

### Step 3: 作成スキーマ `createEstimateSchema`
- 対象ファイル: `src/app/(features)/estimates/new/__tests__/schema.conform.test.ts`（新規・先）、`new/schema.ts`（新規）、`variationSchema.ts`（`nodesField` を export）
- 作業内容（**test-first**）:
  - **(red)** 先に conform 経路テストを書く: 区分別必須（NEW=不要 / REPAIR・AFTER_REPAIR=各3項目）と空メモの undefined 化、`nodesField` のパースを検証
  - **(green)** 共有原子（`nodesField` 等）＋ ヘッダー項目＋`estimateType`＋`submissionType`＋全体値引＋メモで `createEstimateSchema` を構成（version/taxRate なし）、`superRefine` で区分別サブタイプ必須化
- コミットメッセージ: `feat: 見積作成フォームの createEstimateSchema を共有原子から構成（superRefineで区分別必須）`

### Step 4: ヘッダー共有部品の抽出と編集フォーム差し替え（案a）
- 対象ファイル: 共有部品（修理/事後修理フィールド塊・得意先/納品先 FK選択フィールド）を新規抽出、`EstimateHeaderForm.tsx`（差し替え）
- 作業内容:
  - インラインの修理／事後修理セクション・FK選択フィールドを dumb な共有コンポーネントへ抽出
  - 出荷済みの編集ヘッダーフォームを新部品を使う形に差し替え（挙動不変）
- コミットメッセージ: `refactor: 見積ヘッダーの修理/FK選択フィールドを共有部品へ抽出し編集フォームを差し替え`

### Step 5: 作成フォーム本体（統合フォーム）
- 対象ファイル: `src/app/(features)/estimates/new/CreateEstimateForm.tsx`（新規）、提出区分フィールドの共有化
- 作業内容:
  - ヘッダー（区分セレクタで NEW/REPAIR/AFTER_REPAIR を選択しサブタイプ欄を切替・税率は read-only ライブ表示・作成者 read-only・部署 select）と初期バリ1件（共有部品＋`VariationLineEditor` 再利用）を1フォームに統合
  - 提出区分フィールド（`VariationCreateForm` から抽出して共有）を select モードで配置
  - 税率はライブ解決値を `useVariationLineEditor` に渡しプレビュー反映
- コミットメッセージ: `feat: 見積新規作成の統合フォーム（ヘッダー＋初期バリ）を実装`

### Step 6: `createEstimate` アクション ＋ ルート ＋ リダイレクト
- 対象ファイル: `src/app/(features)/estimates/new/actions.ts`（新規）、`new/page.tsx`（新規）、`src/shared/constants/redirect-reasons.ts`、フラッシュメッセージのマッピング
- 作業内容:
  - `createEstimate` Server Action: `verifySession`→`parseWithZod(createEstimateSchema)`→`checkTaxRateThenCreate` 駆動→`taxRateMismatch` はフォームエラー（両税率提示）→成功時 `revalidatePath`＋詳細へ `redirect`
  - createdBy=session.user.employeeId（null は作成不可エラー）、部署は有効部署 query を `page.tsx` で供給
  - `REDIRECT_REASON.ESTIMATE_CREATED` 追加＋作成成功メッセージのマッピング
- コミットメッセージ: `feat: 見積新規作成の Server Action とルート /estimates/new を実装（成功時に詳細へ遷移）`

### Step 7: E2E `estimates-create.e2e.ts`（受け入れ＝外側ループ）
- 対象ファイル: `src/app/(features)/estimates/estimates-create.e2e.ts`（新規）
- 位置づけ: 単体テストは Step 1・3 で test-first 済み。本ステップは統合後の受け入れ条件貫通（外側ループ）。ダブルループで進める場合は、先に失敗する E2E 雛形を置いてから Step 1〜6 の内側ループを回してもよい。
- 作業内容（`create-e2e-test` スキル規約・ADR-0012/0017/0020 準拠）:
  - (1) NEW 作成→詳細へ遷移、(2) 自動展開セット群を含む作成、(3) REPAIR/AFTER_REPAIR の区分別情報入力で作成、(4) 税率不一致でフォーム警告（既存 8%/10% 境界 = 見積年月日 2019-09-30／締切日 2019-10-01 を利用）
- コミットメッセージ: `test: 見積新規作成画面の E2E（受け入れ条件4本）を追加`
