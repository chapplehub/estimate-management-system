# Issue #418: 承認操作ユースケース（approve / reject / withdraw コマンド） — 実装計画

## 概要

`estimate` サブドメインの承認操作ユースケース（application 層）を実装する。ドメイン層(#386)に存在する
`EstimateApplication.approve / reject / withdraw` を駆動する 3 つのアプリ層コマンドを提供し、楽観ロック
（`expectedVersion`）に対応する。infra 層(#407)の `PrismaEstimateApplicationRepository`（`update` /
`findById` / `findByStepId`）と、申請ユースケース(#417)の前例に整合させる。

3 コマンドとも `load → domain op → repo.update(app, expectedVersion)` の骨格で、更新後の
`EstimateApplication` 集約を返す。

| コマンド | ロード | 入力 | 権限検証の置き場所 |
| --- | --- | --- | --- |
| `ApproveStepCommand` | `findByStepId` | `{ stepId, approverEmployeeId, expectedVersion }` | アプリ層: `RoleQueryService.hasMember(step.role, approver)` |
| `RejectStepCommand` | `findByStepId` | `{ stepId, rejecterEmployeeId, comment, expectedVersion }` | アプリ層: 同上 + `new RejectionComment(comment)` |
| `WithdrawApplicationCommand` | `findById` | `{ applicationId, operatorEmployeeId, expectedVersion }` | ドメイン: `withdraw` に本人ガード追加（#386 補完） |

## 設計判断

### コマンド粒度: 3 コマンドに分割
- A. 3 コマンド分割（`ApproveStepCommand` / `RejectStepCommand` / `WithdrawApplicationCommand`）
- B. 1 コマンドに集約（discriminator で分岐）
- 推奨: **A**。既存前例が徹底的に分割派（`ActivateVariationCommand` / `DeactivateVariationCommand` を
  ADR-0018 で意図分離）。入力の形が 3 者で異なり（approve/reject は `stepId`、withdraw は `applicationId`、
  reject のみコメント必須）、統合すると型で不正入力を排除できない。設計書 §10 AC2/AC3/AC4 も 3 コマンドで確定。

### 承認/差戻の権限検証（役割メンバーシップ）の配置: アプリ層
- A. アプリ層で新規クエリ `RoleQueryService.hasMember(roleId, employeeId)` を使い検証してからドメインを呼ぶ
- B. メンバーシップ情報を引数でドメインに渡す
- 推奨: **A**。役割グラフは estimate 集約の外であり、ドメインにポートを持たせない規約（設計書 §11 /
  ADR-0030・ADR-0052）に従う。設計書 §7.4/§12 が「承認は当該ステップの役割メンバーのみ」をユースケース層の
  業務イベント制約として明記。判定は `EmployeeRole` への `findFirst` 1 本で低コスト。今回スコープに含める
  （省くと AWAITING ステップを誰でも承認できる認可の穴が残る）。

### 取下の権限検証（申請者本人）の配置: ドメイン
- A. ドメイン `withdraw` に本人ガードを追加（`withdrawnByEmployeeId` != `applicantEmployeeId` なら例外）
- B. アプリ層で `application.applicantEmployeeId` と operator を照合
- 推奨: **A**。判定材料 `applicantEmployeeId` が集約内に完結するため、集約内不変条件はドメインに置く原則に従う。
  承認/差戻の権限をアプリ層に出したのは「集約外の役割グラフが必要」だからで、取下は逆。
  「集約内=ドメイン / 集約越え=アプリ層」で一貫する。#386 ドメインの `withdraw` を 1 メソッド補完する。

### 楽観ロックの受け渡しと競合エラー型: 既存踏襲
- 各コマンド入力に `expectedVersion: number` を含め、`repo.update(app, expectedVersion)` へ素通し。
- stale 時は infra が投げる既存 `ConflictError`（ApplicationError）をコマンドは握り潰さず伝播。新エラー型は作らない。
- version トークンは `EstimateApplication.version`（設計書 §7.1）。命名は `expectedVersion` に統一
  （`ActivateVariationInput` と同じ。`SubmitApplicationInput.version` の揺れには合わせない）。
- withdraw も version は必ず bump する（`update` の version 条件付きインクリメントは子イベント種別に無関係。
  最終承認と取下の競合を直列化・設計書 §7.1）。

### reject の付随入力（コメント）の扱い: reject のみ・境界で VO 構築
- `RejectStepInput.comment: string` を生文字列で受け、コマンド内で `new RejectionComment(input.comment)` を
  構築してドメインへ渡す。空/超過は VO が `ValidationError` を投げる（必須・1〜2000字・trim）。
- approve は付随入力なし（設計書 §7.1 は承認者・承認日時のみ記録）。withdraw も付随入力なし。

### トランザクション境界とリトライ: 最小構成
- `TransactionRunner` は注入しない。単一集約 `EstimateApplication` の更新 1 回で完結し、原子性は
  `repo.update` 内部の `runAtomically`（version bump + イベント追記）が担保。`ActivateVariationCommand` と同型。
  submit だけが 2 集約（Estimate.bumpVersion + 申請/免除 insert）を原子化するため特殊。
- 自動リトライしない。`ConflictError` はユーザーに素通しし再読み込み→再判断に委ねる（ADR-0039 の意図）。

### 各コマンドの戻り値: 更新後の集約
- 3 コマンドとも更新後の `EstimateApplication` 集約を返す（`repo.update` が refetch 済みを返す）。
  `ActivateVariationCommand` が保存済み `Estimate` を返すのと同型。結末が単一のため submit のような結果 union は不要。

### ロード失敗の扱い: NotFoundEntityError
- `findByStepId` / `findById` が null なら `NotFoundEntityError(EstimateApplication, ...)` を投げる。
  `ActivateVariationCommand` と同型。ドメイン `findStep` の `BusinessRuleViolationError` は多層防御として残す。

### ADR
- 「承認/差戻の権限はアプリ層・取下の権限はドメイン層」の非対称は ADR 候補だが、既存 ADR-0030/0052 の適用に
  過ぎず横断的新規決定ではないため、ユーザー判断により**起票しない**。

## ステップ

### Step 1: 役割メンバーシップ判定クエリの追加
- 対象ファイル:
  - `src/server/subdomains/role/application/queries/RoleQueryService.ts`（インターフェースに `hasMember` 追加）
  - `src/server/subdomains/role/infrastructure/queries/PrismaRoleQueryService.ts`（`employeeRole.findFirst` で実装）
  - `src/server/subdomains/role/infrastructure/queries/__tests__/`（統合テスト・実 Prisma）
- 作業内容:
  - `hasMember(roleId: string, employeeId: string): Promise<boolean>` を定義・実装
  - `EmployeeRole` テーブルへの存在確認 1 本（`findRoleIdsWithMembers` と同テーブル）
- コミットメッセージ: `feat: 役割メンバーシップ判定クエリ RoleQueryService.hasMember を追加`

### Step 2: ドメイン withdraw に申請者本人ガードを追加（#386 補完）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/approval/EstimateApplication.ts`
  - `src/server/subdomains/estimate/domain/entities/approval/__tests__/`
- 作業内容:
  - `withdraw` に `withdrawnByEmployeeId` と `_applicantEmployeeId` の一致ガードを追加。不一致は
    `BusinessRuleViolationError`
  - 既存の PENDING ガードは維持
- コミットメッセージ: `feat: 取下は申請者本人のみに制限するガードを EstimateApplication.withdraw に追加`

### Step 3: WithdrawApplicationCommand の実装
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/WithdrawApplicationCommand.ts`
  - `src/server/subdomains/estimate/application/commands/__tests__/WithdrawApplicationCommand.test.ts`
  - `src/server/subdomains/estimate/application/factories/withdrawApplicationCommandFactory.ts`
- 作業内容:
  - `findById` → null なら `NotFoundEntityError` → `withdraw(operator)` → `update(app, expectedVersion)` → 集約返却
  - 権限（本人）はドメイン側で担保されるため、コマンドは operator を渡すのみ
- コミットメッセージ: `feat: 取下ユースケース WithdrawApplicationCommand を追加`

### Step 4: ApproveStepCommand の実装
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/ApproveStepCommand.ts`
  - `src/server/subdomains/estimate/application/commands/__tests__/ApproveStepCommand.test.ts`
  - `src/server/subdomains/estimate/application/factories/approveStepCommandFactory.ts`
- 作業内容:
  - `findByStepId` → null なら `NotFoundEntityError` → 対象ステップの `roleId` を取得し
    `RoleQueryService.hasMember` で承認者のメンバーシップ検証（非メンバーは業務例外）→ `approve(stepId, approver)`
    → `update(app, expectedVersion)` → 集約返却
- コミットメッセージ: `feat: 承認ユースケース ApproveStepCommand を追加`

### Step 5: RejectStepCommand の実装
- 対象ファイル:
  - `src/server/subdomains/estimate/application/commands/RejectStepCommand.ts`
  - `src/server/subdomains/estimate/application/commands/__tests__/RejectStepCommand.test.ts`
  - `src/server/subdomains/estimate/application/factories/rejectStepCommandFactory.ts`
- 作業内容:
  - Approve と同じ骨格 + `new RejectionComment(input.comment)` を構築して `reject(stepId, rejecter, comment)` へ渡す
  - メンバーシップ検証は Approve と共通化できるならヘルパーへ抽出
- コミットメッセージ: `feat: 差戻ユースケース RejectStepCommand を追加`

### Step 6: ファクトリのバレル公開・整合確認
- 対象ファイル:
  - `src/server/subdomains/estimate/application/factories/index.ts`
- 作業内容:
  - 3 ファクトリを index に追加。`pnpm lint` / `pnpm test` で整合を確認
- コミットメッセージ: `chore: 承認操作コマンドのファクトリを factories バレルへ公開`
