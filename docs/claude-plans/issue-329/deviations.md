# Issue #329 実装計画からの逸脱記録

計画: `docs/claude-plans/issue-329/set-line-foundation.md`

## 1. Estimate.ts は変更不要だった

- **元の計画**: Step 1 の対象ファイルに `Estimate.ts`（`reconstruct` 経由で setGroups を運ぶ）を含めていた。
- **実際の実装**: `Estimate.ts` は 1 行も変更しなかった。
- **理由**: セット群は `EstimateVariation` 内に完全カプセル化され、`Estimate.create/reconstruct` は
  既に `EstimateVariation[]` を保持するだけなので、setGroups は子エンティティ経由で透過的に運ばれる。
  集約ルートに変更が波及しないのは、子が自身の不変条件を閉じ込めている設計の正しい帰結。

## 2. EstimateSetGroup.reconstruct は Step 3 で追加した

- **元の計画**: Step 1 で `EstimateSetGroup`（snapshot＋EstimateItemId[]＋`create` で空群禁止）を作ると記載。
  `reconstruct` の追加時期は明記していなかった。
- **実際の実装**: Step 1 では `create` のみ実装し、`reconstruct` は Step 3（Mapper の往復テスト）で
  必要になった時点で TDD で追加した。
- **理由**: `reconstruct` は永続化からの再構築でのみ使うため、それを駆動する Mapper の
  ラウンドトリップテスト（Step 3）で初めて必要になった。先取り実装を避けた（YAGNI）。

## 3. 空群禁止は群境界のみで担保（variation 側に重複させない）

- **元の計画**: 設計判断 Q4 で「S1 ドメイン（集約内・構築時 assert）: 空群禁止・参照整合・排他所属」と記載。
- **実際の実装**: 空群禁止は `EstimateSetGroup.create` の群境界でのみ担保し、
  `EstimateVariation` の構築時 assert（`assertSetGroupsConsistency`）では参照整合・排他所属のみを検証した。
- **理由**: `EstimateSetGroup.create` が空配列を拒否するため、群は構造上常に非空。variation 側で
  重ねて空群チェックを書くと到達不能な分岐（dead branch・テスト不能）になる。variation の assert は
  群単体では検証できない集約横断の不変条件（参照整合・排他所属）に絞るのが責務の正しい分割。
  「集約内・構築時に担保する」という計画の意図（群の `create` も集約内の構築時）は満たしている。

## 4. テスト補助の追加（逸脱ではなく計画の具体化）

- diff-upsert の 5 シナリオ検証のため、builder に `buildEstimateWithTwoSetGroups` を追加し、
  delete のカスケード確認テストも 1 件追加した（計画のテスト方針の範囲内の具体化）。
