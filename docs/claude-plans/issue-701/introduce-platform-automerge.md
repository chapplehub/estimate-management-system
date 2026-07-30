# Issue #701: Renovate automerge の導入 — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

依存更新フローの「Dashboard 承認 → PR 作成 → CI → 手動マージ」のうち、マージ以降を自動化する。
non-major 全部（minor / patch / pin / digest + lockFileMaintenance、node グループ含む）を automerge 対象とし、
経路は platformAutomerge（GitHub ネイティブ auto-merge、Renovate 既定値）を使う。
`dependencyDashboardApproval` は維持する（承認 1 回・マージ 0 回モデル）。

設計判断の全容は **ADR-20260730-t6e** に起票済み（本計画に先行するグリルセッションで確定）。

**適用前提（解消済み）**: #704（`e2e report` の required status check 化）が #705 でマージ済みであることを実測確認した。
required checks = `static` / `test` / `e2e report`（strict）。この前提が崩れると「E2E 赤でもマージされる」穴が開くため、
実装前に ruleset の現状を再確認すること。

## 設計判断

すべてグリルセッションで確定し ADR-20260730-t6e に記録済み。本計画で新規の判断はなし。

- 人間ゲート: `dependencyDashboardApproval` 維持（承認後のマージのみ自動化）
- スコープ: non-major 全部 + lockFileMaintenance。major は `automerge` 既定 false のまま手動
- 経路: platformAutomerge（既定 true のまま何も書かない）。内蔵 automerge・branch 型は不採用
- マージ方式: `automergeStrategy` は platform 経路で効かない dead config のため書かず、
  リポジトリ設定の squash-only 化で保証する
- 書かない設定: `automergeSchedule` / `automergeStrategy` / `ignoreTests` / `assignAutomerge`（理由は ADR §決定）

## ステップ

### Step 1: リポジトリ設定変更（squash-only + auto-merge 有効化）
- [ ] **完了**
- 対象ファイル: なし（GitHub リポジトリ設定。コミットは本計画のチェックボックス更新のみ）
- テスト戦略: テスト不要（GitHub 設定変更。Step 3 の実測で検証）
- 作業内容:
  - `gh api -X PATCH repos/chapplehub/estimate-management-system -f allow_auto_merge=true -f allow_merge_commit=false -f allow_rebase_merge=false`
  - 変更後に GET で 3 値を実測確認する（`allow_squash_merge: true` が維持されていることも見る）
  - renovate.json 変更（Step 2）より**先に**行うこと。auto-merge 無効のまま automerge 設定が動き出す窓を作らない
- コミットメッセージ: `docs: issue-701 Step 1 完了（リポジトリ設定を squash-only + auto-merge 有効化）`

### Step 2: renovate.json に automerge 設定を追加
- [ ] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（Renovate 設定。スキーマは `$schema` 準拠、挙動は Step 3 の実測で検証）
- 作業内容:
  - `lockFileMaintenance: { "automerge": true }` をトップレベルに追加
    （`:maintainLockFilesMonthly` プリセットの enabled / schedule とはオブジェクトマージされ、automerge だけが加わる）
  - packageRules 末尾に non-major automerge ルールを追加:
    ```json
    {
      "description": "non-major は CI 緑で自動マージする（→ ADR-20260730-t6e）。承認（dependencyDashboardApproval）は維持しており、自動化されるのはマージ以降のみ。major は automerge 既定 false のまま手動",
      "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
      "automerge": true
    }
    ```
  - トップレベル `description` 配列に要点を追記: platformAutomerge（既定）を使うこと、
    `e2e report` required 化（#704）が安全性の前提であること、`automergeStrategy` /
    `automergeSchedule` は platform 経路で効かない dead config のため書かないこと、
    マージ方式はリポジトリ設定の squash-only で保証していること、ADR-20260730-t6e への参照
- コミットメッセージ: `ci: Renovate の non-major 更新に automerge を導入する（platformAutomerge、承認は維持） (#701)`

### Step 3: PR 作成とマージ後の実測検証
- [ ] **完了**
- 対象ファイル: なし（GitHub 上の動作確認）
- テスト戦略: テスト不要（実測検証そのものが本 step）
- 作業内容:
  - 本ブランチの PR を作成しマージする（PR 自体は required 3 チェックを通過して手動マージ）
  - マージ後、次回 Renovate ジョブ以降で Dashboard から任意の non-major 更新を承認し、以下を実測:
    - 作成された PR の本文に「Automerge: Enabled」が表示されること
    - PR に GitHub の auto-merge（squash）が enqueue されること
    - CI 緑後に自動マージされ、squash コミット（`chore(deps): ... (#N)`）が develop に入ること
    - 複数 PR 承認時は `rebaseWhen: behind-base-branch` により順次 rebase → 自動マージが連鎖すること
  - 検証結果に問題があれば Issue #701 に記録して対処を検討する
- コミットメッセージ: `docs: issue-701 Step 3 完了（automerge の実測検証）`
