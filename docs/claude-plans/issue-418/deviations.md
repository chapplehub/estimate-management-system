# Issue #418 実装計画からの逸脱記録

計画: `approval-operation-commands.md`

## 1. `hasMember` の実装を `findFirst` ではなく `count` にした

- **元の計画**: Step 1 で `employeeRole.findFirst` により存在確認する。
- **実際の実装**: `employeeRole.count({ where: { roleId, employeeId } }) > 0`。
- **理由**: boolean 判定に行データのハイドレーションは不要で、`count` の方が意図（存在の真偽）を
  そのまま表す。複合 PK に対する count はインデックスで完結し低コスト。

## 2. 既存テストの roleCd 衝突を解消する `fix:` コミットを追加した（計画外）

- **元の計画**: Step 1 は `hasMember` の追加のみ。
- **実際の実装**: Step 1 着手時、`hasMember` テスト作成が pre-commit の並列テストのスケジューリングを
  変え、既存の潜在バグ（`findRoleIdsWithMembers` テストと `GetRolesByPositionQuery` テストが同じ
  `roleCd` ROLE921/922 を共有し、並列時に一方の cleanup が他方のフィクスチャを削除）を顕在化させた。
  後発の `findRoleIdsWithMembers` 側を一意な ROLE923/924 へ寄せる `fix:` コミット（99be5cb）を先に入れた。
  併せて `hasMember` テストも他ファイルと衝突しない ROLE933/934 を使用。
- **理由**: #327 の「ファイル別プレフィックス」規約違反による既存フレークで、放置すると本 issue の
  コミットが pre-commit で非決定的に落ち続ける。本作業を進める前提として解消が必要だった。

## 3. `EstimateApplication` に静的 `ENTITY_NAME` を追加した

- **元の計画**: Step 3 は WithdrawApplicationCommand の追加のみ。
- **実際の実装**: `NotFoundEntityError(EstimateApplication, ...)` は `entityClass.ENTITY_NAME` を要求するが、
  `EstimateApplication` に当該静的プロパティが無かったため `static readonly ENTITY_NAME = "見積申請"` を追加した
  （`Estimate` と同じ規約）。Step 3 のコミットに同梱。
- **理由**: 計画で採用した NotFoundEntityError 方式（Step 3 設計判断）を成立させるための最小の付随変更。

## 4. `ensureApprovalFixtures` に承認者の役割メンバーシップ登録を追加した

- **元の計画**: Step 4 の作業内容として「承認者のメンバーシップ検証」は記載済みだが、テストフィクスチャの
  具体的拡張には言及なし。
- **実際の実装**: 承認/差戻の成功系テストで承認者が当該ステップ役割のメンバーである必要があるため、
  `ensureApprovalFixtures` で承認者を全ステップ役割の `EmployeeRole` に冪等登録するようにした。
- **理由**: シード役割は既にメンバーを持ち（さもなくば submit テストが NO_APPROVER で落ちる）、承認者追加で
  「メンバー有無」判定は不変のため承認チェーン構築への影響がないことを確認した上での安全な拡張。

## 5. 承認/差戻の共通前処理を `loadStepForMemberDecision` ヘルパーへ抽出した

- **元の計画**: Step 5 に「メンバーシップ検証は Approve と共通化できるならヘルパーへ抽出」とあり、条件付き。
- **実際の実装**: 抽出を実施（`application/shared/approval/loadStepForMemberDecision.ts`）。stepId ロード +
  ステップ特定 + メンバーシップ検証の骨格を集約し、操作名（"承認"/"差戻"）だけ引数で差し替える。差戻固有の
  コメント VO 構築は呼び出し側に残した。
- **理由**: 両コマンドで約10行が完全重複しており、認可検証の単一ソース化で保守性が上がるため計画の条件を満たすと判断。
