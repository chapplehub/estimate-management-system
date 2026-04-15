#!/bin/bash
# PostToolUse: ExitPlanMode
# Plan mode 終了後のリマインド（計画ファイル作成後に必要なアクション）

INPUT=$(cat)

CONTEXT="📋 Plan Mode 終了リマインド:
- Plan file naming: ファイル名が {kebab-case-description}.md になっているか確認（plan.md やランダム名は不可）
- Commit plan before implementation: 計画ファイルを実装開始前にコミットすること"

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":$(echo "$CONTEXT" | jq -Rs .)}}"
exit 0
