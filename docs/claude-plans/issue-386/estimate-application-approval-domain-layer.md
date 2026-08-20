# Issue #386: 見積申請・承認のドメイン層を実装する — 実装計画

## 概要

#375（見積申請スキーマ・6モデル＋enum＋migration・ADR-0058）の上に、見積申請・承認の**ドメイン層のみ**（エンティティ／値オブジェクト／ドメインサービス／ポリシー／リポジトリインターフェース＋純粋単体テスト）を実装する。`システム設計書(申請).md` がアーキテクチャの大枠を確定済みで、本計画はそれをドメイン実装に落とす段の設計合意を結晶化したもの。

**スコープ境界（重要）**:
- アプリ層コマンド（SubmitApplication / ApproveStep / RejectStep / WithdrawApplication）・クエリ・Prisma 実装・UI は**含めない**（別 issue）。
- 「1見積1前進バリエーション」の担保（`Estimate.version` 楽観ロックによる直列化・ADR-0058）はアプリ層の関心であり**本 issue では実装しない**。ドメイン層は構造的に強制しない。
- 「申請以降の編集・無効化不可」は develop 側で表示ステータス由来の進行ロック（ADR-0061）として Estimate 側に定式化済み。本 issue（申請・承認集約）の外。
- ドメイン層は Prisma 非依存・リポジトリポート非依存（組織グラフは引数渡し・ADR-0030/0052）。

配置: `src/server/subdomains/estimate/domain/{entities,values,services,policies,repositories}`（既存の集約同居パターン・§2.1）。

## 設計判断

会話のグリルで確定した判断を記録する（詳細根拠は各 ADR）。

### スコープ
- 純粋ドメイン層のみ。アプリ層コマンドは別 issue。
- 理由: 集約ルート2つ＋導出＋チェーン構築＋ポリシーで十分な塊。最 risky な「1見積1前進の version 直列化」はアプリ／インフラの継ぎ目で独立イシュー向き。純粋ドメインは Prisma 非依存で単体テストが速く、共有 dev DB ドリフト・migration を踏まない。

### 集約境界（§2.2）
- `EstimateApplication`（集約ルート）＝ `EstimateApprovalStep[]`（子エンティティ）。免除は薄い独立集約ルート `EstimateApprovalExemption`。
- 理由: 申請がステップ・イベントのライフサイクルを完全支配。免除は承認と別概念（ADR-0054）。

### 終端イベントのモデリング（イシュー未決事項）
- 承認・差戻・取下の3イベントは**値オブジェクト**、`EstimateApprovalStep` は子エンティティ。
- 理由: イベントは append-only 不変で PK が親の自然キー（独自 identity を持たない）＝`EstimateVariationCopy`(ADR-0041) と同じ VO のシグネチャ。「行の存在＝状態」を「VO が non-null＝発生」で写し取れる。子エンティティを増やさず ADR-0027 境界に通す対象を最小化。ステップは独自 UUID＋「決定が後から付く」ライフサイクルゆえエンティティ。

### 状態導出の配置（イシュー未決事項）
- §3.6 導出の唯一の真実は集約ルート `EstimateApplication`。`ApplicationStatus`/`ApprovalStepStatus` を**導出専用 VO**で型表現（doc に「保存しない・行の存在から導出・ADR-0058」を明記）。
- 理由: ステップ状態は「下位全承認＋申請PENDING」という横断条件が要り、ステップ単体で決まらない。書き込みガードと将来の読み取りモデルが同じ §3.6 を二重実装するとズレる。VariationStatus に倣った導出 VO がコードベースの語彙に合う。ADR-0058 が廃止したのは"保存カラムとしての enum"でメモリ上の導出型は別物。

### 承認要否ポリシー × チェーンビルダーの境界（ADR-0062）
- `ApprovalRequirementPolicy`: 純関数 `judge(finalTotal, leafCategories, estimateType) → Exempt(EstimateExemptionReason) | Required(goalTier)`。金額閾値はポリシー内に保持。**抽象ゴール段階 `ApprovalGoalTier` を返し、Position の identity を知らない**。
- `ApprovalChainBuilder`: 組織スナップショット（applicantSuperiorRoleId / 役割グラフ / 役職段階対応 / roleHasApprover）を引数で受け、**VO 計画 `ApprovalChainPlan`**（goalPositionId ＋ 順序付き roleId 列）を返す。具体 finalApprovalPositionId は到達役職として解決。承認者不在・起点未設定は例外（ADR-0038）。
- 理由: 金額閾値（業務ルール＝ドメイン・ADR-0023/0055）と段階→具体役職（組織マスタ＝他サブドメイン）を分離。ADR-0030/0052 と整合。詳細は ADR-0062。

### 集約生成（ADR-0036/0027）
- ビルダーは子エンティティを返さず VO 計画を返す。集約内ファクトリ `EstimateApplication.create`（バレル公開）が `ApprovalChainPlan` ＋ identity VO を受けてステップ子を内部生成（最低1ステップ・stepOrder 連番・goalPositionId NOT NULL）。
- 理由: 子エンティティはビルダー（services）から new できない（ADR-0027）。記述子入力・子型を露出しない（ADR-0036）。

### リポジトリ（イシュー未決事項）
- 集約ルートごとに2本。`EstimateApplicationRepository`（insert / update+expectedVersion / findById / findByStepId / findByVariationId）と `EstimateApprovalExemptionRepository`（insert / findByVariationId）。
- version はドメインエンティティに持たせず `update` 引数で渡す（ADR-0039）。免除は不変ゆえ update/version/delete を持たない。Estimate には触れない。
- 理由: 承認/差戻/取下は子イベント挿入を伴うアグリゲート変更＝version 直列化点（ADR-0058）。承認/差戻の入力は stepId なので findByStepId が必要。attempt+1・履歴のため findByVariationId。

### 値オブジェクト・テスト
- `RejectionComment`（必須・空不可・≤2000）を新設（Memo は空許容のため別物。§3.4「差戻理由は必須」を型で強制）。
- 導出ステータス値は §3.6 準拠（Step: NOT_STARTED/AWAITING/APPROVED/REJECTED、Application: PENDING/APPROVED/REJECTED/WITHDRAWN）。
- ポリシー入力の商品区分は product サブドメインの `ProductCategory`（既存 enum）。価格を持つ末端明細のみ（§4.2）。
- 全て純粋単体テスト（testing-backend 準拠・DB 非依存）。リポジトリは interface のみ（Prisma 実装・統合テストは別 issue）。

### 新規 ID 値オブジェクト
- `EstimateApplicationId` / `EstimateApprovalStepId` / `EstimateApprovalExemptionId`（`EstimateId.generate()`・UUIDv7・ADR-0009 に倣う）。終端イベントは親の自然キーを借りるため独自 ID VO は作らない。

## ステップ

> 各ステップは TDD（red-green-refactor）で進め、意味のあるまとまりでコミットする（CLAUDE.md コミット規約）。設計判断を含むコミットはボディに理由を記載。計画と異なる対応をしたら `docs/claude-plans/issue-386/deviations.md` に記録。

### Step 1: 識別子・enum・コメントの値オブジェクト
- 対象ファイル: `domain/values/EstimateApplicationId.ts` / `EstimateApprovalStepId.ts` / `EstimateApprovalExemptionId.ts` / `EstimateExemptionReason.ts` / `ApprovalGoalTier.ts` / `RejectionComment.ts` ＋ 各 `__tests__`
- 作業内容:
  - ID3種を `EstimateId` の generate/reconstruct/equals パターンに倣って実装
  - `EstimateExemptionReason`（CONSUMABLE_ONLY/BELOW_THRESHOLD/AFTER_REPAIR）・`ApprovalGoalTier`（4段）を enum 的 VO で
  - `RejectionComment`（必須・空不可・≤2000）
- コミットメッセージ: `feat: 見積申請ドメインの識別子・区分・差戻理由の値オブジェクトを追加`

### Step 2: 導出ステータス値オブジェクト
- 対象ファイル: `domain/values/ApplicationStatus.ts` / `ApprovalStepStatus.ts` ＋ `__tests__`
- 作業内容:
  - §3.6 の状態値を enum 的 VO で表現。doc に「保存しない・行の存在から導出（ADR-0058）」を明記
- コミットメッセージ: `feat: 申請・承認ステップの導出専用ステータス値オブジェクトを追加`

### Step 3: 終端イベント値オブジェクト（承認・差戻・取下）
- 対象ファイル: `domain/values/StepApproval.ts` / `StepRejection.ts` / `ApplicationWithdrawal.ts` ＋ `__tests__`
- 作業内容:
  - 承認（approverEmployeeId・occurredAt）／差戻（rejectedByEmployeeId・RejectionComment・occurredAt）／取下（withdrawnByEmployeeId・occurredAt）を不変 VO で。`EstimateVariationCopy` に倣い identity を持たない
- コミットメッセージ: `feat: 承認・差戻・取下の終端イベント値オブジェクトを追加`

### Step 4: EstimateApprovalExemption 集約（独立・薄い）
- 対象ファイル: `domain/entities/EstimateApprovalExemption.ts` ＋ バレル ＋ `__tests__`
- 作業内容:
  - create（variationId・reason・exemptedBy）/ reconstruct。1バリエーション1件・編集不可前提の薄いルート
- コミットメッセージ: `feat: 承認免除集約 EstimateApprovalExemption を追加`

### Step 5: EstimateApprovalStep エンティティ ＋ EstimateApplication ルート（生成）
- 対象ファイル: `domain/values/ApprovalChainPlan.ts` / `domain/entities/EstimateApprovalStep.ts` / `domain/entities/EstimateApplication.ts` / `entities/index.ts` ＋ `__tests__`
- 作業内容:
  - `ApprovalChainPlan`（goalPositionId ＋ 順序付き roleId 列）VO を定義
  - `EstimateApprovalStep` 子エンティティ（roleId/stepOrder 不変骨格、approval/rejection VO を保持、isApproved/isRejected のローカル述語）
  - `EstimateApplication.create`（集約内ファクトリ・ApprovalChainPlan＋identity から事前生成。最低1ステップ・連番・goalPositionId NOT NULL の構造的不変条件）/ reconstruct。バレルからルートとファクトリのみ公開（ADR-0027/0036）
- コミットメッセージ: `feat: 見積申請集約 EstimateApplication と承認ステップ・チェーン計画を追加`

### Step 6: 状態導出（§3.6）と承認/差戻/取下メソッド
- 対象ファイル: `domain/entities/EstimateApplication.ts`（拡張）/ `EstimateApprovalStep.ts` ＋ `__tests__`
- 作業内容:
  - ルートに §3.6 導出（applicationStatus / 各ステップ状態の合成。差戻最優先・取下最優先・下位全承認で AWAITING 前進）
  - approve(stepId, approver) / reject(stepId, rejecter, comment) / withdraw(withdrawnBy) を実装。ガードは導出ステータス（AWAITING/PENDING のみ）で表現し、終端イベント VO を付与
- コミットメッセージ: `feat: 申請・承認ステップの状態導出と承認/差戻/取下操作を実装`

### Step 7: ApprovalRequirementPolicy（承認要否・純関数）
- 対象ファイル: `domain/policies/ApprovalRequirementPolicy.ts` ＋ `__tests__`
- 作業内容:
  - `judge(finalTotal, leafCategories, estimateType) → Exempt(reason) | Required(goalTier)`。評価順（事後→消耗品のみ→<10万→金額段階）。金額閾値はポリシー内。消耗品判定は価格を持つ末端明細の区分のみ（§4.2）
  - テストは金額境界（10万/100万/1000万/3000万）・消耗品のみ・事後見積・評価順を網羅
- コミットメッセージ: `feat: 承認要否判定ポリシー ApprovalRequirementPolicy を追加`

### Step 8: ApprovalChainBuilder（承認チェーン構築・ドメインサービス）
- 対象ファイル: `domain/services/ApprovalChainBuilder.ts` ＋ `__tests__`
- 作業内容:
  - 組織スナップショットを引数で受け、起点（申請者の上位役割）から goalTier の役職へ到達するまで役割グラフを辿り `ApprovalChainPlan` を返す。常に最低1ステップ（ADR-0003）。承認者不在・起点未設定は例外（ADR-0038）
  - テストは起点未設定・承認者不在・起点が既にゴール以上で1ステップ・通常多段を組織スナップショット fixture で
- コミットメッセージ: `feat: 承認チェーン構築サービス ApprovalChainBuilder を追加`

### Step 9: リポジトリインターフェース
- 対象ファイル: `domain/repositories/EstimateApplicationRepository.ts` / `EstimateApprovalExemptionRepository.ts`
- 作業内容:
  - `EstimateApplicationRepository`（insert / update(aggregate, expectedVersion) / findById / findByStepId / findByVariationId）
  - `EstimateApprovalExemptionRepository`（insert / findByVariationId）
  - JSDoc に version 直列化点（ADR-0039/0058）・Estimate 非接触・検索は QueryService の規約を明記
- コミットメッセージ: `feat: 見積申請・承認免除のリポジトリインターフェースを追加`
