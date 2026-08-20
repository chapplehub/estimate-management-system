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

# 計画ディレクトリは現在のブランチ名（feat/issue-123 等）から導出する。
# settings.local.json の plansDirectory には依存しない（書き換えが self-modification でブロックされ運用が破綻するため）。
ISSUE=$(git branch --show-current 2>/dev/null | grep -oE 'issue-[0-9]+' | head -1)
if [ -z "$ISSUE" ]; then
  exit 0
fi

PLANS_DIR="docs/claude-plans/${ISSUE}"
if [ ! -d "$PLANS_DIR" ]; then
  exit 0
fi

PLAN_FILES=$(find "$PLANS_DIR" -maxdepth 1 -name "*.md" ! -name "deviations.md" 2>/dev/null)
if [ -z "$PLAN_FILES" ]; then
  exit 0
fi

echo "📋 リマインド: 実装計画が存在します。計画からの逸脱があれば ${PLANS_DIR}/deviations.md に追記してください。"
exit 0
