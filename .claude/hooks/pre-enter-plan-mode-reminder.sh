#!/bin/bash
# PreToolUse: EnterPlanMode
# Plan mode 開始時のリマインド（計画作成中に必要なルール）

INPUT=$(cat)

CONTEXT="📋 Plan Mode 開始リマインド:
- 計画ファイルは docs/claude-plans/issue-{number}/{kebab-case-description}.md に Write で直接作成する（settings.local.json は編集しない。self-modification でブロックされ、かつ不要）
- Plan file format: docs/claude-plans/PLAN_TEMPLATE.md のフォーマットに従う
- One step = one commit: 各ステップは1コミット単位で設計"

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":$(echo "$CONTEXT" | jq -Rs .)}}"
exit 0
