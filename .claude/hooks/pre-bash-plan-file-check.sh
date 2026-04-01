#!/bin/bash
# PreToolUse hook (Bash): git commit 時に計画ファイルの未コミット警告を出す
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

if [ ! -d "$PLANS_DIR" ]; then
  exit 0
fi

UNCOMMITTED=$(git status --porcelain "$PLANS_DIR" 2>/dev/null)
if [ -n "$UNCOMMITTED" ]; then
  echo "📋 注意: ${PLANS_DIR} に未コミットのファイルがあります。計画ファイルも一緒にコミットしてください。"
fi

exit 0
