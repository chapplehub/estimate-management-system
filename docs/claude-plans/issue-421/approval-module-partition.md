# Issue #421: refactor: estimate サブドメイン内で承認系を approval/ に区画化する — 実装計画

## Context（背景）

`estimate` サブドメインの承認系コード（~21 シンボル）が `domain/{entities,values,policies,services,repositories}` と `application/shared` の **6 ディレクトリに散在**し、見積本体（複製・改訂・修理）と平置きで混在している。「承認に関する○○はどこ？」のナビゲーション性が落ちている。

本 issue は**同一の境界づけられたコンテキスト内**で、承認系を各層の `approval/` バケツへ集約する**フォルダ区画化（ナビゲーション補助）**である。サブドメイン分割（#420 撤回）は行わない。承認の大半は `EstimateVariationId` に縛られた見積固有集約であり、集約境界は barrel＋eslint（ADR-0027）で既に担保済み。分割の利得はゼロでむしろサブドメイン跨ぎ依存を新設するため、区画化に留める。

**狙う成果**: 「承認は必ず `approval/` 配下」を 1 規則で全層に効かせ、平置き例外ゼロにする。挙動・公開 API は一切変えない純粋な構造リファクタ。

## 調査で確定した事実（コードベース照合済み）

- 移動対象 21 シンボルは Issue 記載と実ファイルが完全一致（entities 3 / values 13 / policies 1 / services 1 / repositories 2 / application/shared 1）。
- 承認系 import を持つ `.ts` は **estimate サブドメイン内のみ**。サブドメイン外からの参照は**ゼロ**（grep 確認済み）。
- **クロスサブドメイン import（`@subdomains/employee/...` 等のエイリアス）は移動の影響を受けない**。影響するのは**層内の相対 import のみ**。
- **共移動するファイル間の相対 import は不変**（例: `values/approval/StepRejection.ts` の `./RejectionComment` は両方 approval/ へ移るため変更不要）。
- eslint の子エンティティ参照許可オーバーライド（`files: ["src/server/subdomains/estimate/domain/entities/**"]`）は `/**` グロブのため `entities/approval/**` を自動カバー。**追加変更不要**。

### Issue 記載の軽微な不正確（計画で補正）

Issue は「`EstimateMapper` は承認系**子エンティティ**を未 import のため変更不要」とするが、`EstimateMapper.ts:19` は移動対象 VO の `EmergencyReason` を import している。子エンティティに限れば正しいが、**VO の import パス更新は必要**。同様に汎用テストヘルパー `domain/entities/__tests__/estimateAggregateBuilder.ts`（承認専用ではなく Estimate 集約全体のビルダー＝**移動しない**）も `EmergencyReason` を import しており、パス更新が必要。いずれも Issue の「残りは import パスの付け替え」に含まれる扱い。

## 設計判断

中核方針（型(a) 層優先＋各層 `approval/`／例外ゼロ／本体は平置き継続／新規 barrel・互換シムなし）は **Issue で grill 済み・合意済み**。残る実装レベルの判断のみ列挙する。

### テストファイルの配置（ユーザー確認済み）
- A. `{layer}/approval/__tests__/X.test.ts`（approval バケツ直下に `__tests__`）
- B. `{layer}/__tests__/approval/X.test.ts`（層の `__tests__` 下に approval サブフォルダ）
- **決定: A**（ユーザー選択）。既存の「ソースに隣接する `__tests__`」規約を保ち、共移動ファイル間の相対 import（`../X`）がそのまま生きる。

### コミット粒度
- **1 層 = 1 コミット**（CLAUDE.md「意味のあるまとまりでコミット」）。各層のコミット内で「該当ファイル＋テストの `git mv` → 参照 import の付け替え（barrel/eslint 含む）→ `tsc`＋`lint`＋`test` green」までを完結させ、**各コミット時点で常に green** を保つ。
- 層を跨いで参照する import 行は後続コミットで深さが再変化しうる（例: values 移動時に entities 側を `../values/approval/X` に直し、entities 移動時に `../../values/approval/X` へ再調整）。この二度手間は許容（各コミットの green 維持と意味的まとまりを優先）。

### ADR
- 新規 ADR は作らない（自明に巻き戻せるフォルダ移動。ADR-0027 も決定不変でパス 1 行が動くのみ＝改訂不要）。**ADR 起票が必要かはユーザー判断**。

## ステップ

> 全ステップ共通の機械的ルール:
> - ファイル移動は履歴保持のため `git mv` を使う（ソース → `{layer}/approval/`、テスト → `{layer}/approval/__tests__/`）。
> - 移動したファイル内の**相対 import を再計算**する: ①深さが 1 段深くなる（`../` → `../../`）、②移動先が approval/ の対象なら `approval/` セグメントを挿入、③共移動の兄弟（同一 approval/ 内）への相対 import は不変。
> - 移動対象を参照する**非移動ファイル**の import を新パスへ付け替える。
> - `tsc`（`pnpm build`）と `pnpm lint` が漏れを捕捉し、既存テストが挙動不変を保証する安全網。各ステップ末で `pnpm build && pnpm lint && pnpm test` が green を確認。

### Step 1: values 層を approval/ へ区画化
- 対象ファイル:
  - 移動（13＋テスト）: `domain/values/{ApplicationStatus,ApplicationWithdrawal,ApprovalChainPlan,ApprovalGoalTier,ApprovalStepStatus,EstimateApplicationId,EstimateApprovalStepId,EstimateApprovalExemptionId,EstimateExemptionReason,EmergencyReason,RejectionComment,StepApproval,StepRejection}.ts` → `domain/values/approval/`、隣接 `__tests__/*.test.ts` → `domain/values/approval/__tests__/`
  - 参照付け替え（非移動・代表例）: `domain/entities/{Estimate,EstimateApplication,EstimateApprovalStep,EstimateApprovalExemption,EstimateFactory,AfterRepairEstimateDetail}.ts` とその `__tests__`、`domain/entities/__tests__/estimateAggregateBuilder.ts`、`domain/policies/ApprovalRequirementPolicy.ts`、`domain/services/ApprovalChainBuilder.ts`、`domain/repositories/{EstimateApplicationRepository,EstimateApprovalExemptionRepository}.ts`、`application/shared/resolveApprovalGoalTiersByDepth.ts`、`application/commands/{CreateEstimateCommand,UpdateEstimateCommand}.ts`、`infrastructure/mappers/EstimateMapper.ts`
- 作業内容:
  - 13 VO ＋テストを `values/approval/`・`values/approval/__tests__/` へ `git mv`
  - 移動 VO 同士の相対 import（`./RejectionComment` 等）は不変、非移動兄弟への相対 import は深さ調整
  - 全参照元の `…/values/X` を `…/values/approval/X` へ付け替え（`EmergencyReason` 経由の EstimateMapper・aggregateBuilder を含む）
  - `pnpm build && pnpm lint && pnpm test` green
- コミットメッセージ: `refactor: 承認系 value object を domain/values/approval/ へ区画化 (#421)`

### Step 2: entities 層を approval/ へ区画化
- 対象ファイル:
  - 移動（3＋テスト）: `domain/entities/{EstimateApplication,EstimateApprovalStep,EstimateApprovalExemption}.ts` → `domain/entities/approval/`、隣接テストを `domain/entities/approval/__tests__/`
  - barrel 更新: `domain/entities/index.ts`（承認系 re-export 2 行 `./EstimateApprovalExemption` `./EstimateApplication` → `./approval/...`）
  - eslint 更新: `eslint.config.mjs` の `no-restricted-imports` 1 行（`entities/EstimateApprovalStep` → `entities/approval/EstimateApprovalStep`）
  - 参照付け替え: 上記 3 エンティティを import する非移動ファイル（`Estimate.ts` ほか／コマンド経由は barrel 利用のため原則不変）
- 作業内容:
  - 3 エンティティ＋テストを `entities/approval/` へ `git mv`
  - 移動エンティティの相対 import を再計算（`../values/approval/X` → `../../values/approval/X`、非承認 VO `../values/EstimateVariationId` → `../../values/EstimateVariationId`、兄弟エンティティ `./EstimateApprovalStep` は不変）
  - barrel 2 行・eslint 1 行を新パスへ
  - eslint オーバーライド（`entities/**` グロブ）が `entities/approval/**` を引き続きカバーすることを lint green で確認
  - `pnpm build && pnpm lint && pnpm test` green
- コミットメッセージ: `refactor: 承認系 entity を domain/entities/approval/ へ区画化し barrel/eslint パスを更新 (#421)`

### Step 3: policies 層を approval/ へ区画化
- 対象ファイル: `domain/policies/ApprovalRequirementPolicy.ts` → `domain/policies/approval/`、`__tests__/ApprovalRequirementPolicy.test.ts` → `domain/policies/approval/__tests__/`、参照元
- 作業内容: `git mv` ＋移動ファイルの相対 import 深さ調整（消費する見積属性 VO は引数注入のため import 局所性は小）＋参照元付け替え＋ green 確認
- コミットメッセージ: `refactor: ApprovalRequirementPolicy を domain/policies/approval/ へ区画化 (#421)`

### Step 4: services 層を approval/ へ区画化
- 対象ファイル: `domain/services/ApprovalChainBuilder.ts` → `domain/services/approval/`、`__tests__/ApprovalChainBuilder.test.ts` → `domain/services/approval/__tests__/`、参照元
- 作業内容: `git mv` ＋相対 import 調整＋参照元付け替え＋ green 確認
- コミットメッセージ: `refactor: ApprovalChainBuilder を domain/services/approval/ へ区画化 (#421)`

### Step 5: repositories 層を approval/ へ区画化
- 対象ファイル: `domain/repositories/{EstimateApplicationRepository,EstimateApprovalExemptionRepository}.ts` → `domain/repositories/approval/`（テストなし＝interface のため）、参照元（infrastructure 実装・コマンド等）
- 作業内容: `git mv` ＋ interface 内の相対 import（参照する承認 VO/entity の新パス）調整＋実装/参照元の付け替え＋ green 確認
- コミットメッセージ: `refactor: 承認系 repository interface を domain/repositories/approval/ へ区画化 (#421)`

### Step 6: application/shared 層を approval/ へ区画化
- 対象ファイル: `application/shared/resolveApprovalGoalTiersByDepth.ts` → `application/shared/approval/`、`__tests__/resolveApprovalGoalTiersByDepth.test.ts` → `application/shared/approval/__tests__/`、参照元（申請ユースケース・コマンド等）
- 作業内容: `git mv` ＋相対 import 調整（出力 `ApprovalGoalTier` は承認 VO、`PositionId` は引数渡し）＋参照元付け替え＋ green 確認
- コミットメッセージ: `refactor: resolveApprovalGoalTiersByDepth を application/shared/approval/ へ区画化 (#421)`

### Step 7: 最終検証（受け入れ条件の充足確認）
- 対象ファイル: なし（検証のみ）
- 作業内容:
  - `pnpm build` / `pnpm lint` / `pnpm test` が全 green
  - 平置き例外ゼロの確認: `domain/{entities,values,policies,services,repositories}` 直下と `application/shared` 直下に承認系シンボルが残っていないことを grep 確認
  - 互換シム・未使用 barrel が無いことを確認（旧パス re-export を新設していない）
  - estimate サブドメイン**外**からの承認系参照がゼロのままであることを grep で再確認
  - eslint 集約境界規約（ADR-0027）が新パスで機能（子エンティティ直接 import がブロックされる）ことを確認
  - 計画と異なる対応があれば `docs/claude-plans/issue-421/deviations.md` に記録
- コミットメッセージ: コミット不要（先行コミットで完結。記録が出れば `docs:` で別コミット）

## 受け入れ条件（Issue より）

- [ ] `pnpm build` / `pnpm lint` / `pnpm test` が green。
- [ ] 承認系シンボルが全層で `approval/` 配下に集約され、平置き例外がゼロ。
- [ ] eslint 境界規約（ADR-0027）が新パスで維持され、集約境界違反が引き続き検出される。
- [ ] 承認系シンボルへの estimate サブドメイン**外**からの参照がゼロのまま。
- [ ] 互換シム・未使用 barrel を残さない。

## 検証方法（Verification）

```bash
# 各ステップ末・最終
pnpm build   # tsc が import 漏れを型エラーで捕捉
pnpm lint    # no-restricted-imports（ADR-0027 境界）と新パスの整合を検証
pnpm test    # 既存テストが挙動不変を保証（移動で壊れれば即検知）

# 平置き例外ゼロの確認（承認系名が approval/ 外に無いこと）
cd src/server/subdomains/estimate
ls domain/values domain/entities domain/policies domain/services domain/repositories application/shared

# 外部参照ゼロの再確認
cd <repo root>
grep -rn "domain/.*approval/\|application/shared/approval/" src --include="*.ts" | grep -v "subdomains/estimate/"
# → estimate 外ヒットが無いこと
```

## 非スコープ

- サブドメイン分割（#420 撤回）／新規 ADR の起票（ユーザー判断）。
- 本体（複製・改訂・修理）の区画化。
- 承認ユースケースの実装（#417 / #418 / #419 で別途）。
- 新規 barrel・互換シム（旧パス re-export）の追加。
