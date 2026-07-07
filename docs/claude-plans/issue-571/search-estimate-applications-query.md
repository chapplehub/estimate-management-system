# Issue #571: 見積申請一覧 検索クエリ（SearchEstimateApplications） — 実装計画

## 概要

見積申請一覧画面（/estimate-applications）の読み取り専用クエリ `SearchEstimateApplications` を Backend（application＋infrastructure）に実装する。行はバリエーション単位で、対象は「申請または承認免除の記録を持つバリエーション」（＝バリエーション申請状態が NONE 以外）。既存の #559（`GetVariationApplicationStatesQuery`）の還元ロジック（`deriveApplicationStatus`＋`VariationApplicationState.reduce`）を再利用し、CQRS 読み取りモデルとして集約再構築を経ずに組み立てる。ドメイン書き込み系・インフラ書き込み系の新規開発は不要。

TDD（red-green-refactor）で進める。純粋関数（`deriveAwaitingStepOrder` / `selectApplicationRows`）は単体テスト先行、Prisma 実装はシナリオ統合テスト先行で実装する。

## 設計判断

会話（/grill-with-docs）で確定済み。中核判断は ADR-20260707-b36 に起票済み、CONTEXT「最新申請」を補足済み（コミット `c008bc1f`）。

### 行の包含集合とバリエーション有効/無効
- 対象は `VariationApplicationState ≠ NONE`（申請行1件以上 or 免除行あり）。
- 既定は**有効（ACTIVE）バリエーションのみ**。検索条件 `includeInactive: boolean`（既定 false）で無効も対象化。
- 判断理由: 画面の主語は「申請記録」であり有効性ではない。差戻・取下も過去の記録として見せる。ただし通常運用のノイズを避けるため既定は有効のみ。

### 検索の意味論（最新申請スコープ）
- 状態・申請者名・申請日・承認待ち役割は**最新申請（attempt最大）**のみを対象。過去 attempt にはヒットさせない。
- 判断理由: 表示（最新申請の値）と検索を一致させる。`some` では過去 attempt にヒットして乖離する。CONTEXT「最新申請＝過去は参照専用」と一貫。

### SQL/アプリ層の分担（ADR-20260707-b36）
- **SQL（不変事実）**: 見積番号・得意先名・納品先名の部分一致、有効/無効、「申請or免除の存在」で候補を絞る。取得はイベント行の存在有無という最小射影。
- **アプリ層（導出条件）**: 還元後の行に対し、純粋関数で状態・申請者・申請日・承認待ち役割を絞る。
- **limit**: `LIST_FETCH_LIMIT+1` をフィルタ・ソート後に適用（候補は非有界フェッチ・有界母数が相殺）。
- 判断理由: 状態は §3.6 で導出するため、SQLで絞ると `deriveApplicationStatus` をSQLに二重実装してドリフトを招く。単一ソースを優先。

### 免除行の出自（CONTEXT 補足済）
- EXEMPTED 行の `申請者名/申請日時` は**免除者/免除日時**。検索も一律この出自に効く。列名は据え置き。

### 承認待ち役割の導出
- 新設の共有純粋関数 `deriveAwaitingStepOrder`（PENDING前提で承認行の無い最小 stepOrder）で導出。
- 列は非PENDINGで null、検索は roleId 直比較で PENDING のみヒット。
- 判断理由: §3.6 のステップ導出規則を読み取りにインライン実装せず単一ソース化（書き込み側 `stepStatus` へ委譲リファクタは今回しない）。

### 複合条件・バリデーション
- 状態は複数選択（`state: VariationApplicationStateCode[]`・フィールド内OR／フィールド間AND）。
- 矛盾組合せ（例: 状態=承認済 かつ 承認待ち役割指定）は BE で特別扱いせず AND で空を返す。
- 空文字→undefined、申請日 from≤to、状態は5値集合内、roleId は UUID。

### ソート
- 申請日時降順 → 見積番号昇順 → バリエーション番号昇順（決定的安定化）。

### テスト戦略（二層）
- **単体（DB無し）**: `deriveAwaitingStepOrder`／`selectApplicationRows`（フィルタ・ソート・limit）を還元済み行の in-memory 配列で網羅。
- **統合（実DB少数）**: SQL where と事実 materialize の集約一致・配線を確認。`ensureApprovalFixtures` 再利用＋`APPROVAL_TEST_BANDS` に本クエリ用の見積番号帯を新規予約。

## ステップ

### Step 1: 検索条件・行DTOの契約定義
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/dto/EstimateApplicationSearchCriteria.ts`
  - `src/server/subdomains/estimate/application/queries/dto/EstimateApplicationSummaryDTO.ts`
- 作業内容:
  - `EstimateApplicationSearchCriteria`: estimateNumber / customerName / deliveryLocationName（部分一致）、state（`VariationApplicationStateCode[]`）、applicantName（部分一致）、awaitingRoleId、appliedFrom / appliedTo、includeInactive（既定 false）。
  - `EstimateApplicationSummaryDTO`（10項目）: 見積番号・バリエーション番号・得意先名・納品先名・提出区分・税込合計金額・申請状態(code+label)・承認待ち役割名(null可)・申請者名・申請日時。
  - `VariationApplicationStateCode` を ADR-0069 に従い境界へ再輸出（NONE を除く5値が検索対象である旨を docstring に明記）。
- コミットメッセージ: `feat: 見積申請一覧の検索条件・行DTOを定義 (#571)`

### Step 2: 承認待ちステップ導出の共有純粋関数（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/approval/deriveAwaitingStepOrder.ts`
  - `src/server/subdomains/estimate/domain/values/approval/__tests__/deriveAwaitingStepOrder.test.ts`
- 作業内容（red→green）:
  - 先にテスト: PENDING 前提で「承認行の無い最小 stepOrder を返す／全承認なら null／空なら null」を網羅。
  - 実装: `deriveAwaitingStepOrder(steps: {stepOrder:number; hasApproval:boolean}[]): number | null`。materialize 済み事実のみを入力とし、行の走査は呼び出し側（`deriveApplicationStatus` と同じ流儀）。
- コミットメッセージ: `feat: 承認待ちステップ導出の共有純粋関数 deriveAwaitingStepOrder を追加 (#571)`

### Step 3: フィルタ・ソート・limit の純粋関数（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/selectApplicationRows.ts`（`ReducedApplicationRow` 型＋純粋関数）
  - `src/server/subdomains/estimate/application/queries/__tests__/selectApplicationRows.test.ts`
- 作業内容（red→green）:
  - 先にテスト: 状態の複数選択OR、申請者名部分一致、申請日 from≤to 範囲、承認待ち役割 roleId 等値（PENDINGのみ持つ）、ソート第2/第3キー安定化、`limit`（+1）切り出し、矛盾組合せ→空、を還元済み行配列で網羅。
  - 実装: `selectApplicationRows(rows, derived, limit)` を Prisma 非依存の純粋関数として実装。
- コミットメッセージ: `feat: 見積申請一覧のフィルタ・ソート・limit純粋関数を追加 (#571)`

### Step 4: QueryService ポート定義とテスト帯予約
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/EstimateApplicationSearchQueryService.ts`（ポート interface）
  - `src/server/__tests__/helpers/approvalTestBands.ts`（本クエリ用の見積番号帯を追記）
- 作業内容:
  - ポート: `search(criteria, options?): Promise<EstimateApplicationSummaryDTO[]>`（options.limit で LIST_FETCH_LIMIT を受ける・既存クエリと対称）。
  - `APPROVAL_TEST_BANDS` に `applicationListSearch` 等の帯を新規予約（共有dev DBの並行実行衝突回避）。
- コミットメッセージ: `feat: SearchEstimateApplications のQueryServiceポートとテスト帯を定義 (#571)`

### Step 5: Prisma 実装（統合テスト先行）
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateApplicationSearchQueryService.ts`
  - `src/server/subdomains/estimate/application/queries/__tests__/SearchEstimateApplicationsQuery.test.ts`（実DB統合）
- 作業内容（red→green）:
  - 先に統合テスト: 各状態(5値)が行として出る／NONE除外／最新申請スコープ（多attempt）／免除行の出自（免除者・免除日時）／承認待ち役割の列・フィルタ／includeInactive トグル／不変事実の部分一致／ソート／limit を、`ensureApprovalFixtures`＋予約帯でシードして検証。
  - 実装: 不変事実で `buildWhereClause`（見積番号・得意先名・納品先名・有効無効・申請or免除の存在）→ 最小射影 select → materialize＋`VariationApplicationState.reduce`／`deriveAwaitingStepOrder` で還元 → `selectApplicationRows` → DTO 整形。
- コミットメッセージ: `feat: SearchEstimateApplications のPrisma読み取り実装 (#571)`

### Step 6: application クエリと factory 配線
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/SearchEstimateApplicationsQuery.ts`
  - factory（既存の estimate クエリ factory に追記）
- 作業内容:
  - `SearchEstimateApplicationsQuery`: ポートを受け取り委譲（#559 の `GetVariationApplicationStatesQuery` と同型）。
  - factory で Prisma 実装を配線。
- コミットメッセージ: `feat: SearchEstimateApplicationsQuery とfactory配線 (#571)`

## 備考

- 実装中に計画と異なる対応をした場合、完了時に `docs/claude-plans/issue-571/deviations.md` に記録する（CLAUDE.md 規約）。
- 後続: 見積申請一覧画面（Frontend）が本クエリの DTO を直 type-import で消費する（ADR-0069）。
