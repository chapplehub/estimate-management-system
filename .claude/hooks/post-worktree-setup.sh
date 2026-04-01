#!/bin/bash
# PostToolUse hook (EnterWorktree): worktree 作成後にセットアップスクリプトを実行する
# stdin: Claude Code から渡される JSON（tool_result.path 等）
# 注意: scripts/worktree-*.sh はメインリポジトリに残す（共通スクリプト）

INPUT=$(cat)

WORKTREE_PATH=$(echo "$INPUT" | jq -r ".tool_result.path // empty")
if [ -z "$WORKTREE_PATH" ] || [ "$WORKTREE_PATH" = "null" ]; then
  exit 0
fi

SOURCE_ROOT=$(git worktree list | head -1 | awk '{print $1}')

bash "$SOURCE_ROOT/scripts/worktree-fix-base-branch.sh" "$WORKTREE_PATH"
bash "$SOURCE_ROOT/scripts/worktree-copy-includes.sh" "$WORKTREE_PATH" "$SOURCE_ROOT"

exit 0
