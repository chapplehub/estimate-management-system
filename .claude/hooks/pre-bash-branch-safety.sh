#!/bin/bash
# PreToolUse hook (Bash): main/master ブランチへの git push/commit をブロックする
# stdin: Claude Code から渡される JSON（tool_input.command 等）
# exit 2 = ツール実行をブロック

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  if echo "$INPUT" | grep -q "git"; then
    echo "❌ ERROR: git commands blocked (jq not installed for safety check)." >&2
    exit 2
  fi
  exit 0
fi

CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty" 2>/dev/null)
if [ -z "$CMD" ]; then
  exit 0
fi

if echo "$CMD" | grep -qE 'git\s+(push|commit)'; then
  if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    echo "❌ ERROR: git push/commit to $BRANCH branch is blocked." >&2
    echo "Please use a feature branch or git worktree for development." >&2
    exit 2
  fi
fi

exit 0
