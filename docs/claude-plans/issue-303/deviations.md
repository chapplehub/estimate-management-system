# Issue #303 実装中の計画からの逸脱記録

計画ファイル: `flatten-company-model-and-customer-optimistic-lock.md`

## 1. ADR 番号を 0040 → 0043 に変更

- **元の計画**: 取引先平坦化の ADR を `0040` として起票。
- **実際の対応**: develop に rebase したところ、develop 側に既存の `ADR-0040`（見積複製系譜、#295/#315 由来）が存在し番号衝突。最新採番が 0042 だったため `0043` に振り直した。ファイル名・INDEX・CONTEXT.md・schema コメント・計画ファイル・issue 本文の参照を全て 0043 に統一。
- **逸脱の理由**: 並行ブランチ（#295/#315）が先に 0040〜0042 を採番してマージしていた。worktree 作業中は develop 側の採番状況が見えず、起票時点では 0040 が空いていた。

## 2. 共有 dev DB のドリフトに対する develop への rebase

- **元の計画**: 平坦化マイグレーションを生成・適用する（rebase は計画外）。
- **実際の対応**: マイグレーション生成前に `prisma migrate dev` がドリフト検出で失敗。原因は複数 worktree が単一 dev DB（`estimate_management_dev`）を共有し、`feat/issue-295` が先に適用した `20260611093013_variation_copy_natural_key` がローカル履歴に無かったこと。#295 が develop にマージ済みだったため develop へ rebase して履歴を一致させた。
- **逸脱の理由**: worktree × 単一 dev DB の構成上、他ブランチの未取り込みマイグレーションが履歴を汚染する。`migrate reset` は他 worktree を壊すため不可。

## 3. 既存 estimate テストの flaky 修正（計画外の別コミット）

- **元の計画**: customer/delivery-location のみ変更。estimate は対象外。
- **実際の対応**: フェーズ2コミット時、pre-commit フック（フルスイート）が estimate テストで非決定的に失敗。原因は `DuplicateEstimateCommand.test`（#315）が既に `UpdateEstimateCommand.test` に割当済みの会計年度 2096（見積番号 N9600001）を「未使用」と誤認して再利用し、vitest 並列実行で採番・cleanup が衝突していたこと。Duplicate を未使用年度 2093（N9300001）へ移し、別コミット（`fix:`）として分離した。
- **逸脱の理由**: 自分の変更とは無関係な既存 flaky だが、フルスイートを回すフックがコミットをブロックするため修正が必要だった。#303 本体（customer 楽観ロック）とは別の関心事のため独立コミットにした。

## 4. CompanyId VO の削除に伴う対象外ファイルの最小修正

- **元の計画**: customer/delivery-location 配下のテストを更新。
- **実際の対応**: `CompanyId` VO 削除に伴い、対象リスト外の `shared/domain/values/__tests__/EntityId.test.ts` が `CompanyId` を参照していたため、import と該当アサーション1行のみ削除（他 ID 型のカバレッジは維持）。
- **逸脱の理由**: VO 削除には全参照の除去が必須。テスト意図の縮小は CompanyId 関連の最小限に留めた。
