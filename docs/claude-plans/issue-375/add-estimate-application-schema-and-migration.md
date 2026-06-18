# Issue #375: 見積申請のPrismaスキーマ追加とmigration実装 — 実装計画

## 概要

見積申請機能のデータ基盤として、`prisma/schema.prisma` に申請関連モデルと enum を追加し、migration を生成・適用する。設計は grill-with-docs のレビューで確定し、`システム設計書(申請).md` §3 と ADR-0058 に反映済み。本 issue はスキーマ＋migration まで（ドメイン層・アプリ層・UI は別 issue）。

当初設計（設計書 §3 旧版）からグリルで大きく変更しており、本計画は **ADR-0058 反映後の確定設計**に従う。

追加するもの:
- enum: `EstimateExemptionReason`（状態 enum は持たず導出。ADR-0058）
- model: `EstimateApplication` / `EstimateApprovalStep` / `EstimateStepApproval` / `EstimateStepRejection` / `EstimateApplicationWithdrawal` / `EstimateApprovalExemption`
- 既存モデルへの逆参照: `EstimateVariation` / `Employee` / `Position` / `Role`（`Estimate` は冗長 estimate_id を持たないため対象外）
- 手書き SQL の CHECK 制約（`attempt >= 1` / `step_order >= 1`）

## 設計判断

主要な判断はグリルで確定済み（→ ADR-0058 / `deviations.md`）。本実装で新たに起こす判断はない。確定事項を以下に再掲する（実装の指針として）。

### model / enum 命名（確定）
- すべて `Estimate` プレフィックスで統一。理由: Prisma の型名はグローバルで将来の価格申請と衝突するため。

### 状態の持ち方（確定・ADR-0058）
- 承認/差戻/取下は終端イベント表（`EstimateStepApproval` / `EstimateStepRejection` / `EstimateApplicationWithdrawal`）に分離し、申請・ステップ状態は行の存在で導出。状態 enum は持たない。
- イベント表は `stepId`（取下は `applicationId`）を自然キー（@id）にする。

### 「1見積1前進」の担保（確定・ADR-0058）
- DB バックストップ（冗長 estimate_id＋部分ユニーク＋複合FK）は持たない。アプリ層（見積アグリゲートの楽観ロック）に一元化 → 別 issue。スキーマには estimate_id を持たせない。

### 規約適用（確定・判断不要）
- onDelete: 全 FK 既定（Restrict）。`onDelete` を schema に書かない。
- CHECK: `attempt >= 1` / `step_order >= 1`（下限のみ・手書き SQL）。`version` は対象外。
- 業務日時は createdAt に集約（submittedAt / exemptedAt / decidedAt は持たない）。
- `EstimateApplication.version` のみ楽観ロック（ステップ・イベント・免除は持たない）。
- 差戻 comment は `EstimateStepRejection` に NOT NULL（default なし）で配置。

## ステップ

### Step 1: schema.prisma に enum とモデル・逆参照を追加
- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - enum `EstimateExemptionReason` を追加
  - model 6種を §3 の確定定義どおり追加（`EstimateApplication` / `EstimateApprovalStep` / `EstimateStepApproval` / `EstimateStepRejection` / `EstimateApplicationWithdrawal` / `EstimateApprovalExemption`）
  - 既存 `EstimateVariation`（applications / exemption）・`Employee`（applicant / approver / rejecter / withdrawer / exemptor）・`Position`（finalApprovalPosition）・`Role`（approvalSteps）に逆参照リレーションを追加
  - `@@unique`（`[variationId, attempt]` / `[applicationId, stepOrder]` / 免除 `variation_id`）・`@@index`・`@db.Uuid` / `@db.Timestamptz(3)` / `@db.VarChar` を規約どおり付与
  - `pnpm db:generate` と `prisma validate` が通ることを確認
- コミットメッセージ: `feat: 見積申請の6モデルとenumをスキーマに追加 (#375)`

### Step 2: migration を生成し CHECK 制約を手書き追記して適用
- 対象ファイル: `prisma/migrations/{timestamp}_add_estimate_application/migration.sql`
- 作業内容:
  - `prisma migrate dev --create-only` で migration を生成（**未適用**で作る）。※ `prisma migrate` は権限制約のため `!` 委譲で実行。dev DB は全 worktree 共有のためドリフトに注意
  - 生成 SQL に CHECK 制約を手書き追記: `attempt >= 1` / `step_order >= 1`（ADR-0019 の既存 migration の書式に倣う）
  - 部分ユニーク・複合FK・estimate_id は **追加しない**（ADR-0058 で廃止）
  - migration を適用（`!` 委譲）し DB 反映を確認
- コミットメッセージ: `feat: 見積申請テーブルのmigration追加（CHECK制約付き） (#375)`
