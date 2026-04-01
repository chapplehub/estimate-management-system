#!/bin/bash
# PreToolUse hook (Bash): git commit 時に実装計画の存在をリマインドする
# stdin: Claude Code から渡される JSON（tool_input.command 等）

INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  exit 0
fi

CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty" 2>/dev/null)
if [ -z "$CMD" ]; then
  exit 0
fi

if ! echo "$CMD" | grep -qE 'git\s+commit'; then
  exit 0
fi

SETTINGS=".claude/settings.local.json"
if [ ! -f "$SETTINGS" ]; then
  exit 0
fi

PLANS_DIR=$(jq -r ".plansDirectory // empty" "$SETTINGS" 2>/dev/null)
if [ -z "$PLANS_DIR" ]; then
  exit 0
fi

PLAN_FILES=$(find "$PLANS_DIR" -maxdepth 1 -name "*.md" ! -name "deviations.md" 2>/dev/null)
if [ -z "$PLAN_FILES" ]; then
  exit 0
fi

echo "📋 リマインド: 実装計画が存在します。計画からの逸脱があれば ${PLANS_DIR}/deviations.md に追記してください。"
exit 0
