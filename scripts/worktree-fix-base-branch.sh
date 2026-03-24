#!/usr/bin/env bash
# 責務: EnterWorktree が origin/main ベースで作成するバグを回避し、origin/develop に修正する
# 廃止条件: Claude Code の EnterWorktree が HEAD ベースで作成するよう修正されたら
# ref: https://github.com/anthropics/claude-code/issues/27134
set -euo pipefail

WORKTREE_PATH="$1"

cd "$WORKTREE_PATH"
git fetch origin develop
git reset --hard origin/develop
git branch -u origin/develop
