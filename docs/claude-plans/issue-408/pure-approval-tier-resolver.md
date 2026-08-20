# Issue #408: 役職→承認段階の純粋 resolver（深さ算出＋4段 fail-fast）の実装 — 実装計画

## 概要

ADR-0063 で確定した「役職の承認段階を最上位役職からの階層深さで算出し、4 段不変条件を fail-fast で守る」方式を、estimate アプリ層の**純粋関数 resolver** として TDD（red-green-refactor）で実装する。

- 役職グラフ（`id` ＋ `superiorPositionId`）を引数で受け取り、各役職の `ApprovalGoalTier`（承認段階）を解決して返す。
- 段階写像（ADR-0063 確定）: 根（`superiorPositionId = null`＝社長）からの距離 `0 → PRESIDENT / 1 → DIVISION_MANAGER / 2 → DEPARTMENT_MANAGER / 3 → SECTION_MANAGER`。
- 前提（根を起点に正確に 4 段の単一鎖）が破れていれば例外を投げる（fail-fast）。
- リポジトリ・DB・コマンドには一切依存しない純関数（ADR-0030 / ADR-0052 / ADR-0025）。

本計画のスコープは **resolver 本体 ＋ 単体テストのみ**。申請コマンド・組織スナップショット組立ては別アプリ層 issue、リポジトリの Prisma 実装は #407（インフラ層）。

## 設計判断

設計の中核（解決方式＝深さ算出 / fail-fast / 配置＝estimate アプリ層 / 依存方向 estimate→組織）は **ADR-0063 で確定済み**。本実装で残るのは実装レベルの選択のみ。

### 入力の型
- A. position サブドメインの `Position` エンティティ配列を受ける
- B. 最小射影 `{ positionId: PositionId; superiorPositionId: PositionId | null }[]` を受ける
- 推奨: **B**（estimate アプリ層が position の集約エンティティ型に依存せず純粋・疎結合に保てる。`ApprovalChainBuilder` が役割グラフを素のまま引数で受けるのと同じ流儀）

### 出力の型
- A. `Map<string, ApprovalGoalTier>`（キー = `PositionId.value`）
- B. `Map<PositionId, ApprovalGoalTier>`（VO キー）
- 推奨: **A**（VO の参照等価問題を避け、申請ユースケースが `positionId.value` で引ける）

### fail-fast の例外型
- A. 既存 `BusinessRuleViolationError`（DomainError 階層）を流用
- B. 専用エラー（例: `ApprovalTierResolutionError`）を新設
- 推奨: **A**（既存階層に倣う。前提違反は業務不変条件違反として扱う）。メッセージで違反種別（鎖長 ≠ 4 / 根が不在・複数 / 枝分かれ / 親参照切れ）を明示。

### 配置・段階写像
- 配置は estimate アプリ層 `application/shared/` に純粋関数モジュールとして置く（既存の横断ヘルパと同流儀。Estimate 集約・position サブドメインには置かない・ADR-0063）。判断不要。
- 段階写像（距離→段階）は ADR-0063 で確定。判断不要。

## ステップ

TDD（red-green-refactor）で進める。各ステップはテスト先行で 1 サイクル。

### Step 1: 正常系 — 4 段の単一鎖を承認段階へ写像
- 対象ファイル:
  - `src/server/subdomains/estimate/application/shared/__tests__/resolveApprovalGoalTiersByDepth.test.ts`（新規・先に red）
  - `src/server/subdomains/estimate/application/shared/resolveApprovalGoalTiersByDepth.ts`（新規・green）
- 作業内容:
  - 課長→部長→本部長→社長の 4 段グラフを入力に、各 `PositionId` が `SECTION_MANAGER..PRESIDENT` へ写ることを検証するテストを書く（red）
  - 根からの距離を算出し、距離→段階で写像する最小実装で通す（green）
  - 入力配列の順序非依存（シャッフルしても同結果）を検証
- コミットメッセージ: `feat: 役職→承認段階 resolver の正常系（深さ算出による4段写像）を実装`

### Step 2: 異常系 — 4 段不変条件の fail-fast
- 対象ファイル:
  - `.../__tests__/resolveApprovalGoalTiersByDepth.test.ts`（異常系ケース追記・red）
  - `.../resolveApprovalGoalTiersByDepth.ts`（検証ロジック追加・green）
- 作業内容:
  - 以下のケースで例外を投げることを検証するテストを追加（red）
    - 鎖長 ≠ 4（3 段・5 段）
    - 根（`superiorPositionId = null`）が不在 / 複数
    - 枝分かれ（同一 `superiorPositionId` を持つ役職が複数＝同距離に複数ノード）
    - 親参照先が入力に存在しない（壊れたグラフ）
  - 「根を起点に正確に 4 段の単一鎖」を検証する fail-fast を実装し green
  - リファクタ: 検証と写像の責務を整理し、純粋性（外部依存ゼロ）を確認
- コミットメッセージ: `feat: 役職→承認段階 resolver に4段不変条件の fail-fast を実装`

## 関連

- ADR-0063（深さ算出＋4 段 fail-fast）/ ADR-0062（承認段階の返却と役職解決の分離）
- ADR-0030 / ADR-0052（越境データの引数渡し）/ ADR-0025（ドメイン純関数）
- CONTEXT.md「承認段階（Approval Goal Tier）」
- #407（インフラ層・リポジトリ Prisma 実装）/ 別アプリ層 issue（申請コマンド＋snapshot 組立て）
