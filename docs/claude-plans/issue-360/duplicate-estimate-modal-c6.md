# Issue #360: 見積複製（C6 DuplicateEstimate）の UI — 実装計画

## 概要

複製元見積の詳細画面（`[estimateNumber]`）のヘッダー操作エリアに「見積複製」ボタンを新設し、押下で開くモーダルでバリ複数選択（≥1）・見積日・締切日・部署を収集して `DuplicateEstimateCommand` を駆動、新採番の別見積を生成し新見積の詳細画面へ遷移する。複製先は見積単価がクリアされ、複製系譜（`EstimateVariationCopy`）が記録される。

- issue 本文の「#351 作成画面に統合」前提は退ける（ADR-0057）。C6 は `CreateEstimate` とは別コマンド・別入力形状・別成果物（系譜記録・単価クリア）で、作成画面統合では AC を満たせないため。専用フルページルートも作らない（入力面が小さく、バリ内容編集を伴わず、単価再入力は遷移先詳細画面の既存 C4 インライン編集へ委譲できる）。
- `DuplicateEstimateCommand` / `EstimateDuplicationService` / `duplicateEstimateCommandFactory` は実装済み・テスト完備。**欠けているのはプレゼン層配線と、税率導出＋§8.7 を担う app-shared ラッパのみ**。
- #351 への依存は共有部品（`resolveEffectiveTaxRate` アクション・日付ユーティリティ・`REDIRECT_REASON` パターン・部署 select・`isVariationDuplicatable`）の再利用に縮小する。

**グリル中に起こした成果物**:
- **ADR-0057**: C6 UI を作成画面統合でなく詳細画面モーダル＋`DuplicateEstimate` 経路で実装する（採用済み・本計画の根拠）。

## 設計判断

### 配線方式（C6 UI をどこに置くか）
- A. C1 作成画面に複製モードを足す（`CreateEstimateForm` を mode 化）
- B. 専用フルページの複製画面（独立ルート）を新設
- C. 複製元詳細画面のヘッダー操作エリアに「見積複製」ボタン → モーダル → `DuplicateEstimateCommand` → 新見積詳細画面へ遷移
- **採用: C**（ADR-0057）。A は駆動コマンド・入力形状・成果物が違いすぎ神コンポーネント化、かつ系譜・単価クリアは `CreateEstimate` に無い。B は入力面が小さくバリ内容編集を伴わないため過剰。C は新規実装を「モーダル＋Server Action＋遷移」に縮小でき、単価再入力を遷移先の既存 C4 編集へ委譲できる。

### エントリポイント
- 複製元詳細画面の**ヘッダー操作エリア**に「見積複製」ボタンを新設。`VariationPanel` 内の C3「複製」（バリエーション複製・集約内）とはラベル・階層で明確に区別する（CONTEXT.md が両用語を厳密に分離）。一覧画面の行アクションは、バリ選択にバリ群の追加ロードが要り重くなるため見送る。

### バリ選択の適格性・見せ方
- 適格性は既存 `isVariationDuplicatable`（`[estimateNumber]/variationEditable.ts`）を再利用＝「改訂明細を含まない」のみ（状態不問・提出区分不問）。C3 と同一条件。
- 不適格バリ（改訂明細を含む）は**表示するがチェック不可**（グレーアウト＋理由注記）。隠さず透明性を優先。
- 適格バリが1件も無い見積は「見積複製」ボタン自体を無効化（理由をツールチップ表示）。
- ドメイン側（`EstimateDuplicationService`）は適格性を強制せず（存在チェック＋≥1のみ）、改訂明細除外は **UI 抑止に依存**する。C3 と同じ非対称を踏襲（ドメイン強化は別 issue 候補）。

### 複製先のバリ採番順・初期選択
- 複製先 `variationNumber` は**複製元の並び順で固定**（`selectedVariationIds[]` を複製元順にソートして送る）。チェックリストは集合を表す UI でありクリック順を覚えさせない。
- 初期選択は**全件未チェック**（明示選択）、≥1 必須。

### 税率導出＋§8.7 整合チェックの配置
- A. 複製 Server Action 内にチェックをインラインで書く
- B. ADR-0056 と対称な app-shared `checkTaxRateThenDuplicate` を新設し、`TaxRateConsistencyCheckDomainService` を再利用
- **採用: B**。`DuplicateEstimateCommand` は `taxRate` を生値で受け取るのみで §8.7 を保証しない。作成（`checkTaxRateThenCreate`）と対称な app-shared ラッパに置くことで、作成・複製の税率扱いを統一し ADR-0056 の方針と一貫させる。consistent なら解決税率を `taxRate` に注入して委譲、mismatch は複製せず両税率を載せた Result を返す。

### 複製後の着地・単価クリアの明示（#334 §5 残課題）
- 着地は**閲覧モード＋フラッシュ表示**（先頭バリの編集自動展開はしない。複数バリ複製時に部分的で誤解を招くため）。
- 単価クリアは2箇所で明示: (1) モーダル内の常設注記「複製先では見積単価がクリアされます。複製後に各バリで再入力してください」、(2) 新 `REDIRECT_REASON.ESTIMATE_DUPLICATED` による着地後フラッシュ。

### CONTEXT.md
- 既存用語（見積複製／バリエーション複製／複製元／複製先／バリエーション系譜）で過不足なく表現でき、**用語追加・変更は不要**。

### テスト戦略（/tdd 前提・test-first）
- 純粋ロジック（`checkTaxRateThenDuplicate`・`duplicateEstimateSchema`）は各ステップ内で **test-first（red→green→refactor）**。テストを末尾に固めない。
- UI（モーダル・ボタン）は単体 TDD の対象が薄いため、**E2E を外側の受け入れループ**として最後に貫通検証する。ダブルループ（先に失敗する E2E 雛形を置いてから内側の単体ループを回す）でもよい。

## ステップ

### Step 1: app-shared `checkTaxRateThenDuplicate` ＋ 配線ファクトリ ［ユニットTDD: RED→GREEN］
- 対象ファイル: `src/server/subdomains/estimate/application/shared/__tests__/checkTaxRateThenDuplicate.test.ts`（新規・先）、`shared/checkTaxRateThenDuplicate.ts`（新規）、`application/factories/checkTaxRateThenDuplicateDepsFactory.ts`（新規）
- 作業内容（**test-first**）:
  - **(red)** 先にテストを書く: consistent→`duplicated` / mismatch→`taxRateMismatch` union を、税率リポジトリのモックで 8%/10% 境界（見積日 2019-09-30／締切日 2019-10-01）を作って検証
  - **(green)** §8.7 チェック → consistent なら解決税率を `taxRate` に詰めて `DuplicateEstimateCommand` へ委譲 → `{duplicated|taxRateMismatch}` を返す（`checkTaxRateThenCreate` と同型）
  - Composition Root で `TaxRateConsistencyCheckDomainService`（＋`PrismaTaxRateRepository`）と `DuplicateEstimateCommand`（`duplicateEstimateCommandFactory`）を解決
- コミットメッセージ: `feat: 見積複製の税率導出＋§8.7チェックを app-shared checkTaxRateThenDuplicate に実装（ADR-0056/0057）`

### Step 2: 複製スキーマ `duplicateEstimateSchema` ［ユニットTDD: RED→GREEN］
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/__tests__/duplicateSchema.conform.test.ts`（新規・先）、`[estimateNumber]/duplicateSchema.ts`（新規）
- 作業内容（**test-first**）:
  - **(red)** conform 経路テスト: `selectedVariationIds[]` の ≥1 必須・見積日/締切日（"yyyy-mm-dd"）・部署必須を検証。`version`・`taxRate` は持たない
  - **(green)** `selectedVariationIds`（min 1）＋`estimateDate`/`deadline`（`dateInput` 共有原子）＋`departmentId` で構成
- コミットメッセージ: `feat: 見積複製フォームの duplicateEstimateSchema を実装（バリ選択≥1・新ヘッダ3項目）`

### Step 3: 複製モーダル本体（バリ選択＋新ヘッダ入力）
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/DuplicateEstimateModal.tsx`（新規）
- 作業内容:
  - バリ複数選択チェックリスト: `isVariationDuplicatable` で適格性判定し不適格バリは表示＋チェック不可（理由注記）。初期未チェック・≥1必須・複製元の並び順で送出
  - 見積日（変更で `resolveEffectiveTaxRate` をライブ解決）・締切日・部署 select・税率 read-only 表示
  - 単価クリアの常設注記。`useServerForm`（conform）で §8.7/バリデーションエラーをモーダル内に表示
  - 継承項目（見積区分・得意先・納品先・税端数区分・提出区分）は入力させない（複製元継承の旨を必要に応じ表示）
- コミットメッセージ: `feat: 見積複製モーダル（バリ選択・新ヘッダ入力・単価クリア注記）を実装`

### Step 4: 複製 Server Action ＋ 詳細画面ヘッダーへのボタン配線 ＋ リダイレクト
- 対象ファイル: `[estimateNumber]/actions.ts`（`duplicateEstimate` 追加）、`[estimateNumber]/page.tsx`／ヘッダー操作エリアのコンポーネント（「見積複製」ボタン配線）、`src/shared/constants/redirect-reasons.ts`、フラッシュメッセージのマッピング
- 作業内容:
  - `duplicateEstimate` Server Action: `verifySession`→`parseWithZod(duplicateEstimateSchema)`→`checkTaxRateThenDuplicate` 駆動→`taxRateMismatch` はフォームエラー（両税率提示）→成功時 `revalidatePath`＋新見積詳細へ `redirect`。`createdBy`=session.user.employeeId（null は複製不可）
  - 詳細画面ヘッダー操作エリアに「見積複製」ボタン（適格バリ0件で無効化）。`VariationPanel` の C3「複製」と区別
  - `REDIRECT_REASON.ESTIMATE_DUPLICATED` 追加＋単価クリアを促すフラッシュ文言のマッピング。着地は閲覧モード
- コミットメッセージ: `feat: 見積複製の Server Action と詳細画面ボタンを配線（成功時に新見積詳細へ遷移）`

### Step 5: E2E `estimates-duplicate.e2e.ts`（受け入れ＝外側ループ）
- 対象ファイル: `src/app/(features)/estimates/estimates-duplicate.e2e.ts`（新規）
- 位置づけ: 単体は Step 1・2 で test-first 済み。本ステップは統合後の受け入れ条件貫通（外側ループ）。ダブルループで先に失敗する E2E 雛形を置いてから内側ループを回してもよい
- 作業内容（`create-e2e-test` スキル規約・ADR-0012/0017/0020 準拠）:
  - (1) バリを1件以上選択して複製→新採番の別見積が生成され複製元は不変・新見積詳細へ遷移
  - (2) 複製先の見積単価がクリアされている／系譜が記録される（観測可能な範囲で）
  - (3) 0件選択は確定不可（≥1必須・ADR-0042）／改訂明細を含むバリはチェック不可
  - (4) 税率不一致でモーダル内フォーム警告（8%/10% 境界 = 見積日 2019-09-30／締切日 2019-10-01）
- コミットメッセージ: `test: 見積複製の E2E（受け入れ条件）を追加`

### 完了時
- `docs/claude-plans/issue-360/deviations.md` に「issue 本文の #351 統合前提からの逸脱」を {元計画}/{実際}/{理由} で記録する（CLAUDE.md ルール・ADR-0057 参照）。
