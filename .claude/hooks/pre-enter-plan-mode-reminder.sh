#!/bin/bash
# PreToolUse: EnterPlanMode
# Plan mode 開始時のリマインド（計画作成中に必要なルール）
# 計画ファイルのフォーマット（テスト戦略欄を含む）は PLAN_TEMPLATE.md が単一情報源。
# ここにフォーマットを再掲せず、必ず Read させること。

INPUT=$(cat)

CONTEXT="📋 Plan Mode 開始リマインド:
- 計画ファイルは docs/claude-plans/issue-{number}/{kebab-case-description}.md に Write で直接作成する（settings.local.json は編集しない。self-modification でブロックされ、かつ不要）
- Plan file format: docs/claude-plans/PLAN_TEMPLATE.md を必ず Read し、そのフォーマットに従う（記憶で書かない。各ステップの テスト戦略 欄を含む）
- One step = one commit: 各ステップは1コミット単位で設計"

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":$(echo "$CONTEXT" | jq -Rs .)}}"
exit 0
