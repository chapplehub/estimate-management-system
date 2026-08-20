# Issue #704: 計画からの逸脱記録

## Step 4: docs-only PR での skip 検証をマージ後（Step 5）へ繰り延べ

- **元の計画内容**: Step 4（マージ前の動作確認）で「docs のみを変更した検証用 PR で、changes のみ実行され static / test / e2e が skipped になり、required check が合格扱いになることを確認する」
- **実際の実装内容**: マージ前の Step 4 では本 PR（プロダクト差分あり → 全 CI 実行）と workflow_dispatch（ゲート素通し）の 2 経路のみを確認し、docs-only PR の skip 検証は Step 5（本 PR マージ後の ruleset 変更）の最終確認に統合した
- **逸脱の理由**: pull_request イベントの run が使うワークフロー定義は merge ref（base + head の合成コミット）のもの。マージ前に develop へ docs-only PR を出すと、merge ref のワークフローは develop 側の旧定義（paths フィルタ付き）になり新ゲートを通らない。逆に本ブランチを含むブランチから PR を出すと差分に .github/** が含まれ product=true になる。したがって「新ゲート + docs-only 差分」の組み合わせは develop へのマージ後にしか成立しない。なお product=false の判定ロジック自体は、single-branch clone で actions/checkout の refspec 制約を再現した模擬リポジトリの機能テスト（docs-only / プロダクト差分 / push / fetch 失敗の 4 ケース）で検証済み
