# Issue #573: 見積申請詳細 参照クエリ（GetEstimateApplicationDetail） — 実装計画

## 概要

見積申請詳細画面（`/estimate-applications/[estimateNumber]/[variationNumber]`）の BE 参照クエリを実装する。あるバリエーションの申請の全容（バリエーション要約・最新申請・過去申請履歴・免除記録・操作可否）を読み取り DTO で一括供給する。書き込み系の新規開発はなく、ステップ状態導出の共有関数抽出（振る舞い不変リファクタ）のみドメイン層に触れる。

CQRS read model。実装は `/tdd`（red-green-refactor）で進める。

## 設計判断

会話（`/grill-with-docs`）で確定済み。詳細は ADR-20260707-ae2 を参照。

### 操作可否フラグの実装位置
- A. query service 完結（`canApply` と同型）
- B. app層で越境合成（query service は操作者非依存・app層で `hasMember` 合成）
- 決定: **B**。`canApprove`/`canReject` が role サブドメインの `hasMember` を要し、estimate infra からの直読みは集約境界（ADR-0030/0052）を破るため。→ **ADR-20260707-ae2 起票済み**

### NotFound の表現
- 一律 `null` 返却（`GetEstimateDetailQuery` と同型）。3ケース（見積番号なし／バリエーション番号なし／申請も免除も無い）を同値扱いし、一覧の母集合と整合。専用エラーは作らない。

### 出力 DTO の骨格
- **判別ユニオン** `kind: "APPLICATIONS" | "EXEMPTED"`。`APPLICATIONS` 枝は `latest` / `past`（attempt降順）を分離、`EXEMPTED` 枝は `exemption`。`summary` と `operations` はユニオン外に常設。
- flat な `StepView`（`actorName` に承認者/差戻者を畳み込み・`status` で判別・`rejectionComment` は REJECTED のみ）。ステップ単位ユニオンは採らず均一テーブルUIに合わせる。
- 各 `ApplicationView` は自前の申請状態（`ApplicationStatus` 由来）を保持（summary のバリエーション申請状態とは別概念）。
- `operations` は3フラグ＋3コマンド標的（`latestApplicationId`／`awaitingStepId`／`expectedVersion`）を束ねる。免除・非PENDINGでは全false・標的null。

### ステップ状態導出の再利用
- A. 共有純粋関数 `deriveApprovalStepStatus` に抽出し集約と読み取りで共有
- B. Prisma 実装に §3.6 規則を複製
- 決定: **A**。`deriveApplicationStatus` の先例に倣い、read/write のドリフトを封じる。集約 `EstimateApplication.stepStatus()` を委譲に差し替える（振る舞い不変）。

### query / app 責務分割
- ①query service = 操作者非依存の Prisma 還元（表示ビュー＋還元済み生事実 `state`/`awaitingRoleId`/`applicantEmployeeId`/`latestApplicationId`/`awaitingStepId`/`expectedVersion` を返す）
- ②app層 Query = operator を受けて `state===PENDING` を共通ゲートに3フラグを合成（`canWithdraw=applicantEmployeeId===operator`、`canApprove=canReject=hasMember(awaitingRoleId, operator)`）

### 免除枝の末端
- `ExemptionView`（reason code+label／実施者名／日時）。code+label は `EstimateExemptionReason` VO 単一ソース（ADR-0069）。

### テスト方針
- 3層: 純粋関数（DB無し）／app層 Query（fake `RoleQueryService` 注入でフラグ総当り・DB無し）／Prisma統合（実DB・6シナリオ）。
- E2E は本 issue に含めない（後続の表示FE・操作FE issue で画面と実施）。

## ステップ

### Step 1: `deriveApprovalStepStatus` 共有純粋関数の抽出（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/approval/deriveApprovalStepStatus.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/approval/__tests__/deriveApprovalStepStatus.test.ts`（新規）
  - `src/server/subdomains/estimate/domain/entities/approval/EstimateApplication.ts`（`stepStatus()` を委譲へ差し替え）
- 作業内容:
  - Red: §3.6 の4値（REJECTED/APPROVED/AWAITING/NOT_STARTED）を materialize 済み事実（`hasRejection`/`hasApproval`/`applicationIsPending`/`lowerStepsAllApproved`）から導出する関数のテストを DB 無しで網羅
  - Green: `deriveApprovalStepStatus` を実装（`deriveApplicationStatus` と同型の純粋関数）
  - Refactor: 集約 `stepStatus()` を新関数への委譲に差し替え、既存 `EstimateApplication`/`ApprovalStepStatus` テストを回帰網として維持
- コミットメッセージ: `refactor: 承認ステップ状態の§3.6導出を共有純粋関数に抽出`

### Step 2: 詳細 DTO 型と query service port の定義
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO.ts`（新規・判別ユニオン＋ApplicationView/StepView/ExemptionView/operations）
  - `src/server/subdomains/estimate/application/queries/EstimateApplicationDetailQueryService.ts`（新規・port＋projection型）
- 作業内容:
  - 判別ユニオン DTO・各ビュー型・`operations` を定義（code+label は VO 単一ソースの型を再輸出）
  - `findDetail(estimateNumber, variationNumber): Promise<DetailProjection | null>` の port と、生事実を含む projection 型を定義
- コミットメッセージ: `feat: 見積申請詳細の読み取りDTOとquery service portを定義`

### Step 3: app層 Query `GetEstimateApplicationDetailQuery`（TDD）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/GetEstimateApplicationDetailQuery.ts`（新規）
  - `src/server/subdomains/estimate/application/queries/__tests__/GetEstimateApplicationDetailQuery.test.ts`（新規）
- 作業内容:
  - Red: fake query service（projection 決め打ち）＋ fake `RoleQueryService`（`hasMember`）で、フラグ合成マトリクス（申請中×メンバー→承認/差戻可、申請中×本人→取下可、非PENDING/免除→全false、projection=null→null伝播）を総当り
  - Green: operator を受けて `state===PENDING` ゲート＋`hasMember`＋本人性で3フラグと3標的を組み立て、最終 DTO を返す実装
- コミットメッセージ: `feat: 見積申請詳細 参照クエリ（app層・操作可否をhasMemberで合成）`

### Step 4: Prisma 実装 `PrismaEstimateApplicationDetailQueryService`（TDD・統合）
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateApplicationDetailQueryService.ts`（新規）
  - `src/server/subdomains/estimate/infrastructure/queries/__tests__/PrismaEstimateApplicationDetailQueryService.test.ts`（新規）
  - `src/server/__tests__/helpers/approvalTestBands.ts`（詳細クエリ用の新規テスト番号帯を登録）
- 作業内容:
  - Red: 新規テスト帯を切り、`ensureApprovalFixtures`＋実リポジトリで6シナリオ（申請中1回目／差戻→再申請／承認済／取下／免除のみ／NotFound）を本物の行として作り、projection・表示ビュー（状態導出・latest/past・ステップstatus・宛先ID群）を検証（3フラグ真偽は層3で作らない）
  - Green: `VARIATION_DETAIL_SELECT` の最小射影で直読みし、`deriveApplicationStatus`／`deriveApprovalStepStatus`／`deriveAwaitingStepOrder` で還元、latest/past・免除枝・生事実を組み立てる実装
- コミットメッセージ: `feat: 見積申請詳細 query serviceのPrisma実装`

### Step 5: factory（composition root）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/factories/getEstimateApplicationDetailQueryFactory.ts`（新規）
- 作業内容:
  - `PrismaEstimateApplicationDetailQueryService` と `RoleQueryService`（具象）を app層 Query に注入する composition root を組む（`previewApplicationQueryFactory` と同型）
- コミットメッセージ: `feat: 見積申請詳細 参照クエリのfactoryを追加`
