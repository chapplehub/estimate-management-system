#!/bin/bash
# PreToolUse: EnterPlanMode
# Plan mode 開始時のリマインド（計画作成中に必要なルール）

INPUT=$(cat)

CONTEXT="📋 Plan Mode 開始リマインド:
- Setup plansDirectory: .claude/settings.local.json の plansDirectory を docs/claude-plans/issue-{number} に更新
- Plan file format: docs/claude-plans/PLAN_TEMPLATE.md のフォーマットに従う
- One step = one commit: 各ステップは1コミット単位で設計"

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":$(echo "$CONTEXT" | jq -Rs .)}}"
exit 0
