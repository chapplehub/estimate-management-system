# Plan Mode Workflow

計画ファイルを使って実装する場合（plan mode）のルール。
このルールは hooks（EnterPlanMode / ExitPlanMode）で自動リマインドされる。

## 計画作成時（EnterPlanMode）

- **Setup plansDirectory**: 計画作成前に `.claude/settings.local.json` の `plansDirectory` を `docs/claude-plans/issue-{number}` に更新すること。
- **Plan file format**: Planファイルは `docs/claude-plans/PLAN_TEMPLATE.md` のフォーマットに従って作成すること。
- **One step = one commit**: 計画の各ステップは「1コミット単位」で設計すること。

## 計画作成後（ExitPlanMode）

- **Plan file naming**: Planファイル名は計画内容を表す命名にすること（例: `implement-customer-list.md`, `add-column-constraints.md`）。Claudeが自動生成するランダム名（例: `glowing-prancing-dewdrop.md`）は使用しない。フォーマット: `docs/claude-plans/issue-{number}/{kebab-case-description}.md`
- **Commit plan before implementation**: 計画ファイルは実装開始前にコミットすること。
