# Issue #307 実装計画からの逸脱記録

## 1. コミット粒度（6コミット → 2コミット）

- **元の計画**: Step 1〜6 を層ごとに分け、6コミットに分割する想定だった。
- **実際の実装**: 2コミットに集約した。
  - commit 1: リポジトリIF分割（save 残置）＋ Prisma 条件付き updateMany ＋ リポジトリ統合テスト
  - commit 2: 更新系3コマンド ＋ DTO/QueryService ＋ プレゼン層 ＋ save 廃止 ＋ コマンドテスト
- **逸脱の理由**: pre-commit が `tsc --noEmit`（プロジェクト全体）を実行するため、各コミットは全体で型が通る必要がある。`save` を必須引数つき `update` へ切り替える変更は、リポジトリIF・3コマンド・呼び出し側（actions.ts）・既存テストを巻き込み、途中段階では tsc が通らない。そこで「save を残した additive な追加（commit 1）」と「呼び出し側の一括移行＋save 廃止（commit 2）」の2段に分け、各コミットがコンパイル可能な状態を保った。計画自体がこの制約を「各コミットが tsc を通る状態を保つ」と前提していたため、方針転換ではなく粒度の現実的調整。

## 2. CreateDeliveryLocationCommand の insert 移行（計画のステップ外）

- **元の計画**: 対象は Update/Activate/Deactivate の3コマンド。Create は「新規作成（insert 経路）」としてスコープ外。
- **実際の実装**: `CreateDeliveryLocationCommand` の `repository.save()` を `repository.insert()` に変更した。
- **逸脱の理由**: `save` をリポジトリIFから廃止する以上、`save` を呼んでいた Create コマンドも `insert` へ移さないと tsc が通らない。楽観ロック（expectedVersion）の付与はしておらず、メソッド名の移行のみ。スコープ（楽観ロック対象）は変えていない。

## 3. 付随テストの save → insert 置換（計画のテスト項目外）

- **元の計画**: テストは「リポジトリ統合（stale 逐次）」「コマンド単体（expectedVersion 素通し）」の2種を想定。
- **実際の実装**: 上記に加え、`save` を使っていた既存2テストを `insert` へ置換した。
  - `DeleteDeliveryLocationCommand.test.ts`（beforeEach の事前作成）
  - `DeliveryLocationCodeDuplicationCheckDomainService.test.ts`（重複データの事前作成）
- **逸脱の理由**: `save` 廃止に伴う機械的な追従。振る舞いの検証内容は変えていない。
