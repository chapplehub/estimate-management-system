# issue #375 計画からの逸脱記録

設計レビュー（grill-with-docs）で、確定済みとされた `システム設計書(申請).md` §3 から複数の設計変更を決定した。以下に {元の計画} / {実際の決定} / {理由} を記録する。新規 ADR-0058 を起票し、設計書 §3 を全面改訂済み。

## 1. model / enum 名のプレフィックス統一

- **元の計画**: `EstimateApplication` のみ `Estimate` プレフィックス。`ApprovalStep` / `ApprovalExemption` と enum 3種（`ApplicationStatus` 等）は無印。
- **実際の決定**: すべて `Estimate` プレフィックスで統一（`EstimateApprovalStep` / `EstimateApprovalExemption` / `EstimateApplicationStatus` 等。ただし状態 enum は下記2で廃止）。
- **理由**: Prisma の model/enum 名はグローバル。ADR-0053 が将来の価格申請を専用テーブルで分離する以上、価格側で同名が再要求され衝突する。今リネームは無コスト、後は高コスト。

## 2. 状態の完全導出・終端イベント表への分解（ADR-0058）

- **元の計画**: `EstimateApplication.status` / `ApprovalStep.status` を保存 enum で持つ。ステップは `approverEmployeeId`(null)・`decidedAt`(null)・`comment`(default "") を同一行に持ち、承認/差戻で上書き。
- **実際の決定**: 承認/差戻/取下を終端イベント表（`EstimateStepApproval` / `EstimateStepRejection` / `EstimateApplicationWithdrawal`）に分離。状態は行の存在＋順序から導出し、状態 enum 2種を廃止。ステップは骨格のみ（nullable ゼロ）。差戻 comment はイベント表に必須カラムとして配置。
- **理由**: nullable＋可変statusは「予定」と「結果」の同居のサイン。Order系・ADR-0054 の「行の存在で状態を導出」流儀と一貫させ、NULL徹底排除（ADR-0034）に沿う。

## 3. DBバックストップ（1見積1前進）の廃止（ADR-0058）

- **元の計画**: 申請に冗長 `estimate_id` を持たせ、`(estimate_id) WHERE status='PENDING'` の部分ユニークインデックスで「1見積1前進」をDB強制。
- **実際の決定**: 部分ユニーク・冗長 `estimate_id`（申請・免除とも）・複合FK整合ガードをいずれも廃止。「1見積1前進」はアプリ層（見積アグリゲートの楽観ロック）に一元化。
- **理由**: 真の不変条件は申請中＋承認済＋免除の3状態×2テーブル横断で、単一テーブルの部分ユニークでは5パターン中1つしか塞げず半端。状態導出（2）で保存カラム前提も崩れる。横断不変条件はアプリ層に寄せる方が一貫し、スキーマも単純化。
- **検討の経緯**: グリル中、一旦は「両テーブルに対称なDB強制＋複合FK整合ガード」を採る方向で合意したが、状態を完全導出する方針（2）を優先し nullable 排除を取る判断に転換した。

## 4. 跨ぎレース防止の version 役割変更

- **元の計画**: `EstimateApplication.version` は可変な申請行の楽観ロック。
- **実際の決定**: 申請行はほぼ不変になるが version は残し、「同一ステップへ承認と差戻を同時」「最終承認と取下を同時」等の**跨ぎ矛盾レース**をアグリゲートルートで直列化する楽観ロックとして用いる（ADR-0039 の本来意図）。
- **理由**: 状態を複数イベント表に割ると別表の `@id` では跨ぎを防げない。ルートの version で締める。

## 5. 業務日時の createdAt 集約

- **元の計画**: `submittedAt`（申請）・`exemptedAt`（免除）・`decidedAt`（ステップ）を独立カラムで保持。
- **実際の決定**: `submittedAt` / `exemptedAt` を削除し `createdAt` に集約。`decidedAt` は各イベント表の `createdAt` に一致するため独立カラム不要（イベント分解の副次効果）。
- **理由**: 生成と同時に起きる業務イベントの日時は createdAt に集約する既存流儀（`Order` / `OrderConfirmation` / `OrderCancellation`）と一貫。

## 6. onDelete を全 FK Restrict

- **元の計画**: `ApprovalStep → EstimateApplication` のみ `onDelete: Cascade`、他は未指定。
- **実際の決定**: 全 FK 既定（Restrict）。スキーマに `onDelete` を一切書かない。
- **理由**: 申請・ステップ・イベントは履歴で物理削除ユースケースが無い。Restrict は「そもそも消させない」を DB で宣言でき、削除のないドメインに正直。別集約参照は `Order.variation`（Restrict）と同型。

## 7. attempt の維持（導出に倒さない）

- **検討**: `attempt` は申請行の序数として導出可能なため削除を検討。
- **実際の決定**: 保存維持。`@@unique([variationId, attempt])` を自然キーとして残す。
- **理由**: nullable/可変ではない（除去の主目的に中立）。業務に見える申請回数（ADR-0005）であり自然キー・二重submitバックストップとして価値がある。導出可能値の保存は ADR-0028/0033 の流儀。

## CHECK 制約（規約適用・逸脱ではない）

- `attempt >= 1` / `step_order >= 1`（下限のみ・手書きSQL）。`version` は CHECK 対象外（既存 version 列に倣う）。

## 関連学び

- `learning/derive-status-from-event-rows-not-mutable-column.md`
- `learning/derivable-does-not-mean-removable.md`
- `learning/index-partial-vs-composite-selectivity.md`（追記: AWAITING部分インデックスの前提が本決定で覆った）
