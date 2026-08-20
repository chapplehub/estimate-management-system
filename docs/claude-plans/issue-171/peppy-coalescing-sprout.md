# Plan: settings.json のインライン hooks を .claude/hooks/ シェルスクリプトに切り出す

## Context

`.claude/settings.json` の hooks セクションに長大なインライン `bash -c '...'` コマンドが6つ存在し、可読性・保守性が低い。既に1つ (`post-bash-commit-fail-check.sh`) は `scripts/claude-hooks/` に切り出し済みだが、配置場所を `.claude/hooks/` に統一したい。

## 対象フック一覧

| # | Hook Type | Matcher | 切り出し先ファイル名 | 状態 |
|---|-----------|---------|---------------------|------|
| 1 | Stop | (なし) | `stop-notify-completion.sh` | 新規作成 |
| 2 | PreToolUse | AskUserQuestion | `pre-ask-notify-question.sh` | 新規作成 |
| 3 | PreToolUse | Bash | `pre-bash-branch-safety.sh` | 新規作成 |
| 4 | PreToolUse | Bash | `pre-bash-plan-reminder.sh` | 新規作成 |
| 5 | PreToolUse | Bash | `pre-bash-plan-file-check.sh` | 新規作成 |
| 6 | PostToolUse | Bash | `post-bash-commit-fail-check.sh` | 移動 |
| 7 | PostToolUse | EnterWorktree | `post-worktree-setup.sh` | 新規作成 |

## 命名規則

`{hook-type}-{matcher}-{descriptive-name}.sh`
- prefix: `stop-`, `pre-`, `post-` (ライフサイクル)
- matcher: `bash-`, `ask-`, `worktree-` (トリガー)
- suffix: 目的の説明

## スクリプトテンプレート

既存の `post-bash-commit-fail-check.sh` に合わせる:

```bash
#!/bin/bash
# {HookType} hook: {目的の説明}
# stdin: Claude Code から渡される JSON（session_id, tool_input, tool_result 等）

INPUT=$(cat)
# ... ロジック ...
exit 0
```

## 実装ステップ

### Step 1: 既存スクリプトの移動 (Hook 6)

- `.claude/hooks/` ディレクトリ作成
- `scripts/claude-hooks/post-bash-commit-fail-check.sh` → `.claude/hooks/post-bash-commit-fail-check.sh` にコピー
- `settings.json` の command を `"bash .claude/hooks/post-bash-commit-fail-check.sh"` に更新
- テスト後、旧ファイル・旧ディレクトリ (`scripts/claude-hooks/`) を削除
- **コミット**

**テスト:**
```bash
echo '{"tool_input":{"command":"git commit -m test"},"tool_result":"Exit code 1: error"}' | bash .claude/hooks/post-bash-commit-fail-check.sh
# → ⚠️ 警告メッセージが出力されること
echo '{"tool_input":{"command":"ls"}}' | bash .claude/hooks/post-bash-commit-fail-check.sh
# → 何も出力されないこと
```

### Step 2: 通知フックの切り出し (Hook 1, 2)

- `.claude/hooks/stop-notify-completion.sh` 作成
- `.claude/hooks/pre-ask-notify-question.sh` 作成
- `settings.json` の該当 command を更新
- **コミット**

**テスト:**
```bash
echo '{"session_id":"abc12345-test"}' | bash .claude/hooks/stop-notify-completion.sh
echo '{"session_id":"abc12345-test"}' | bash .claude/hooks/pre-ask-notify-question.sh
# → ntfy.sh に通知が届くこと（ブラウザで確認）
```

### Step 3: PreToolUse Bash フックの切り出し (Hook 3, 4, 5)

- `.claude/hooks/pre-bash-branch-safety.sh` 作成
- `.claude/hooks/pre-bash-plan-reminder.sh` 作成
- `.claude/hooks/pre-bash-plan-file-check.sh` 作成
- `settings.json` の該当 command を更新
- **コミット**

**テスト:**
```bash
# branch-safety: feature ブランチで許可されること
echo '{"tool_input":{"command":"git commit -m test"}}' | bash .claude/hooks/pre-bash-branch-safety.sh
echo $?  # → 0

# branch-safety: 非 git コマンドはスルー
echo '{"tool_input":{"command":"ls -la"}}' | bash .claude/hooks/pre-bash-branch-safety.sh
echo $?  # → 0

# plan-reminder / plan-file-check: git commit 以外は無視
echo '{"tool_input":{"command":"ls"}}' | bash .claude/hooks/pre-bash-plan-reminder.sh
echo $?  # → 0
echo '{"tool_input":{"command":"ls"}}' | bash .claude/hooks/pre-bash-plan-file-check.sh
echo $?  # → 0
```

### Step 4: PostToolUse EnterWorktree フックの切り出し (Hook 7)

- `.claude/hooks/post-worktree-setup.sh` 作成
- `scripts/worktree-fix-base-branch.sh`, `scripts/worktree-copy-includes.sh` はそのまま残す（呼び出し先）
- `settings.json` の該当 command を更新
- **コミット**

**テスト:**
```bash
# 空入力 → 何もせず exit 0
echo '{}' | bash .claude/hooks/post-worktree-setup.sh
echo $?  # → 0

# null path → 何もせず exit 0
echo '{"tool_result":{"path":null}}' | bash .claude/hooks/post-worktree-setup.sh
echo $?  # → 0
```

### Step 5: .worktreeinclude 更新

- `.worktreeinclude` に `.claude/hooks/**` を追加
- worktree 環境でもフックスクリプトが参照可能になる
- **コミット**

**対象ファイル:** `.worktreeinclude`（現在の内容: `.env`, `.env.*`, `.claude/settings.local.json`）

## 修正対象ファイル

| ファイル | 操作 |
|---------|------|
| `.claude/settings.json` | command フィールドを全 Step で更新 |
| `.claude/hooks/*.sh` (7ファイル) | 新規作成 |
| `scripts/claude-hooks/post-bash-commit-fail-check.sh` | 削除（Step 1） |
| `scripts/claude-hooks/` | ディレクトリ削除（Step 1） |
| `.worktreeinclude` | `.claude/hooks/**` 追加（Step 5） |

## リスクと対策

| リスク | 対策 |
|--------|------|
| worktree でフックが見つからない | Step 5 で `.worktreeinclude` に追加 |
| JSON 構文エラー | 各 Step で `jq . .claude/settings.json` で検証 |
| バックグラウンド curl (`&`) が外部スクリプトで動かない | Step 2 テストで確認 |
| 途中で中断した場合の不整合 | Step ごとにコミット |

## 検証（全体）

全 Step 完了後、Claude Code セッションを再起動して以下を確認:
1. `git commit` 失敗時に警告が出ること（Hook 6）
2. feature ブランチでのコミットが通ること（Hook 3）
3. 通知が ntfy.sh に届くこと（Hook 1, 2）
