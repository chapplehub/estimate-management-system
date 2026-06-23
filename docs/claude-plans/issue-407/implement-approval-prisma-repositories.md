# Issue #407: 見積申請・承認免除リポジトリの Prisma 実装（Mapper・統合テスト） — 実装計画

## 概要

#386 で実装した承認系ドメイン層（`EstimateApplication` / `EstimateApprovalStep` / `EstimateApprovalExemption` 集約・終端イベント VO・`ApprovalChainPlan`）の上に、インフラ層を実装する。具体的には承認免除・見積申請リポジトリの Prisma 実装、Domain⇔Prisma の Mapper、TDD による統合テストを行う。

**スコープは Mapper + リポジトリ Prisma 実装 2 本 + 統合テストの 3 点に縮退**している。Issue 起票時の未決事項に挙がっていた「§3.7 逆参照リレーション追加」「migration の切り方」は、調査の結果 **#384（commit da032b0）で承認系 6 テーブル・全 FK・CHECK・index・§3.7 逆参照リレーションがすべて作成済み**であることが判明したため、本 issue の対象外とする（新規 migration 不要）。

**本 issue 外の境界**: 承認 Inbox 等の QueryService、楽観ロック `version` を読み出す read model は別 issue。本リポジトリ interface は集約の保存・再構築に必要な最小操作のみを提供する。

## 設計判断

### スコープ縮退（§3.7・migration は #384 で完了済み）
- 逆参照リレーションは Prisma の仮想リレーション（SQL カラムを生まない）で、FK が #384 で張られていれば schema 記載のみで完結し新規 migration は不要。
- 判断: §3.7 / migration を本 issue から外し、Mapper + リポジトリ実装 + 統合テストに集中する。

### ファイル配置
- A. 既存 `infrastructure/mappers/`・`infrastructure/prisma/` の flat 配置に合わせる
- B. ドメイン層の `approval/` 区画化（commit `b5f0c94`）を鏡写しに `infrastructure/mappers/approval/`・`infrastructure/prisma/approval/` を新設する
- 推奨: **B**（承認系を区画化する確立済み規約に揃える。flat 配置は承認系導入前の名残）

### `update()` の終端イベント永続化方式
- A. version ガード＋終端イベントを自然キーで idempotent upsert＋ステップ骨格は不触＋`created_at` は DB 既定＋`refetch`
- B. DB のイベント行を読んで差分の不足分だけ create（読み込み 1 往復増・利得なし）
- C. イベント全削除→再作成（追記専用・不変原則に反し `created_at` を壊す）
- 推奨: **A**。理由: 終端イベントは追記専用・1ステップ1決定でドメインが `isDecided()` ガード済み、`stepId`/`applicationId` が `@id` 自然キーのため upsert が冪等になり FK 安全。並行性は `version` ガード（ADR-0039/0058）、冪等性は自然キーが担保し、読み込み差分も削除再作成も不要。`occurredAt` は reload 後の DB `created_at` で確定する（ADR-0058「occurredAt = イベント行 createdAt」と一致、in-memory の `new Date()` は捨てる）。

### `insert()` の形
- 既存パターン踏襲（ルート＋ステップ骨格のネスト create。生成時点でイベントは無し）のため判断不要。

### Mapper の責務分割
- 集約ルートごとに 1 Mapper（`*_FULL_INCLUDE` 定数＋`toDomain`＋create-input ビルダ、子の `reconstruct()` 直呼び）。eslint override（ADR-0031）は各 mapper ファイルに限定。既存 `EstimateMapper` と同型のため判断不要。

### ユニーク制約衝突の例外翻訳
- 推奨: `estimate_applications(variationId, attempt)` 衝突・`estimate_approval_exemptions.variationId` 衝突（Prisma P2002）を `ConflictError` に翻訳する。理由: いずれも「アプリ層チェックをすり抜けた並行レースを DB の最後の砦が捕捉」したケースで、`attempt` は §6.3 の楽観採番（MAX+1）、免除は二重確定レース。既存 `estimate_number` 翻訳の先例と一貫した再試行 UX に落とす。FK 違反（P2003）は翻訳せず生のまま（テストで別途確認）。

### 統合テストのデータ準備方式
- A. テスト専用に予約コードで組織（役職・役割・従業員）を全て自前生成
- B. 役職・役割はシードを code 引きで再利用、従業員のみ予約コードで upsert
- 推奨: **B**。理由: 既存の組織グラフ依存テスト（`SuperiorRoleValidationDomainService.test.ts`）がシード組織を `positionCd` で code 引きする確立済み流儀があり、`Position.name`/`positionCd` の `@unique` がテスト専用役職の生成を阻む。役職・役割は固定の正準マスタなのでシード再利用、従業員はシードを mutate せず隔離するため予約コードで upsert。対象 variation は実 estimate insert で本物の FK を用意。

### テスト戦略（申請集約の構築）
- 推奨: 申請集約は `EstimateApplication.create` ＋ **`ApprovalChainPlan` 手組み**で生成し、`ApprovalChainBuilder` は通さない。理由: リポジトリテストの主題は永続化往復＋ADR-0058 状態導出であり、チェーン構築（組織トラバース）は #386 ドメインテストで担保済み。混ぜると関心が二重化する。

### ドキュメント更新
- CONTEXT.md: 今回の決定は全て実装方式で新規業務用語なし → 追記不要（glossary は実装詳細を持たない）。
- 新規 ADR: 既存 ADR（0058/0039/0032/0054・estimate_number 翻訳先例）に従うのみで「不可逆×文脈なしでは驚く×真のトレードオフ」を満たさない → 起票見送り。

## ステップ

TDD（red → green → refactor）で進める。各ステップは 1 つの red-green サイクルで動作する意味的まとまりを成し、green に達した時点で 1 コミットする（failing-test の単独コミットは作らない）。

### Step 1: 承認免除リポジトリを TDD で実装（＋ensureApprovalFixtures 土台）
- 対象ファイル:
  - `src/server/__tests__/helpers/ensureApprovalFixtures.ts`（新規・テスト helper）
  - `src/server/subdomains/estimate/infrastructure/prisma/approval/__tests__/PrismaEstimateApprovalExemptionRepository.test.ts`（新規）
  - `src/server/subdomains/estimate/infrastructure/mappers/approval/EstimateApprovalExemptionMapper.ts`（新規）
  - `src/server/subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApprovalExemptionRepository.ts`（新規）
- 作業内容:
  - Red: `ensureApprovalFixtures`（役職・役割はシード code 引き、従業員は予約コード upsert、対象 variation は実 estimate insert）を整え、免除の統合テストを書く（insert → `findByVariationId` 往復、同一 variation 二重 insert → `ConflictError`）。
  - Green: `EstimateApprovalExemptionMapper`（`*_FULL_INCLUDE`・`toDomain`・create-input）と `PrismaEstimateApprovalExemptionRepository`（`insert`/`findByVariationId`、P2002→`ConflictError` 翻訳）を実装。mapper ファイルに eslint override（ADR-0031）を限定付与。
  - Refactor: 予約コード namespace・cleanup を既存 `ensureEstimateFixtures` 流儀に整える。
- コミットメッセージ: `feat: 承認免除リポジトリのPrisma実装とテストフィクスチャ土台を追加`
  - body 記載: 承認系インフラを approval/ サブフォルダに区画化（理由: ドメイン層の approval/ 区画化と鏡写し）。免除の variationId unique 衝突を ConflictError に翻訳（理由: 二重確定レースを再試行可能な競合として表面化、estimate_number 先例に一貫）。

### Step 2: 見積申請リポジトリの insert / 検索を TDD で実装
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/prisma/approval/__tests__/PrismaEstimateApplicationRepository.test.ts`（新規）
  - `src/server/subdomains/estimate/infrastructure/mappers/approval/EstimateApplicationMapper.ts`（新規）
  - `src/server/subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApplicationRepository.ts`（新規）
- 作業内容:
  - Red: `EstimateApplication.create` ＋手組み `ApprovalChainPlan`（例 goalPosition=部長、step 役割 ROLE009→ROLE004 の 2 段）で申請を構築し、`insert` → `findById`/`findByStepId`/`findByVariationId` の往復テストを書く。検証の核は **PENDING 状態の導出が往復を生き残ること**（`applicationStatus===PENDING`・先頭ステップ `AWAITING`・以降 `NOT_STARTED`）。`findByVariationId` は attempt 複数件で履歴が返ることを確認。(variationId, attempt) 二重 insert → `ConflictError`。
  - Green: `EstimateApplicationMapper`（steps を traverse する `*_FULL_INCLUDE`・`toDomain`・ステップ骨格ネスト create を含む insert create-input）と `PrismaEstimateApplicationRepository` の `insert`/`findById`/`findByStepId`/`findByVariationId` を実装。P2002→`ConflictError` 翻訳。
- コミットメッセージ: `feat: 見積申請リポジトリのinsert・検索系をPrismaで実装`
  - body 記載: insert はルート＋ステップ骨格のネスト create でイベントは持たない（理由: 生成時点で決定は無く、状態は行の存在から導出する ADR-0058）。

### Step 3: 申請の update（承認・差戻・取下＋楽観ロック）を TDD で実装
- 対象ファイル:
  - `.../prisma/approval/__tests__/PrismaEstimateApplicationRepository.test.ts`（追記）
  - `.../mappers/approval/EstimateApplicationMapper.ts`（イベント upsert input を追記）
  - `.../prisma/approval/PrismaEstimateApplicationRepository.ts`（`update` を追記）
- 作業内容:
  - Red: ドメインの `approve`/`reject`/`withdraw` を経た申請を `update(application, expectedVersion)` で永続化し、reload で **ADR-0058 状態導出が往復を生き残ること**を検証（approve 連鎖で順次 `APPROVED`・次が `AWAITING`、最終承認で申請 `APPROVED` ／ reject で `REJECTED` ／ withdraw で `WITHDRAWN`）。stale `expectedVersion` で `ConflictError`。`created_at`（occurredAt）が DB 既定で確定し refetch 後に復元されることを確認。
  - Green: `EstimateApplicationMapper` に終端イベントの自然キー create/upsert input を追加。`PrismaEstimateApplicationRepository.update` を方式 A で実装（`updateMany({where:{id,version}})`→`count===0` で `ConflictError`、non-null イベントを自然キー idempotent upsert、ステップ骨格は不触、`created_at` は DB 既定、末尾 `refetch`）。
  - Refactor: 既存 `PrismaEstimateRepository.update` と共通するロック/翻訳の型を見直し、重複があれば整理。
- コミットメッセージ: `feat: 見積申請のupdate（承認・差戻・取下）を楽観ロック付きで実装`
  - body 記載: update は終端イベントを自然キーで idempotent upsert しステップ骨格は触らない（理由: イベントは追記専用・不変で 1ステップ1決定。並行性は version、冪等性は @id 自然キーが担保。ADR-0058/0039）。occurredAt は in-memory 値を捨て DB created_at で確定（ADR-0058）。
