# Issue #136: EnterWorktree バグ回避スクリプトを責務ごとに分離 — 実装計画

## Context

Claude Code の `EnterWorktree` には2つの課題がある：

1. `.worktreeinclude` が適用されない → 手動でファイルコピーが必要
2. `origin/main` ベースで作成される → `origin/develop` に修正が必要（[Issue #27134](https://github.com/anthropics/claude-code/issues/27134)）

これらは **異なる原因・異なるタイミングで解消される** ため、責務ごとに独立したスクリプトに分離する。
将来、片方が不要になった際にそのスクリプトだけ削除すれば済むようにする。

## 変更ファイル

| ファイル | 操作 |
|---------|------|
| `scripts/worktree-copy-includes.sh` | 新規作成（既存 `setup-worktree.sh` の内容を移行） |
| `scripts/worktree-fix-base-branch.sh` | 新規作成 |
| `scripts/setup-worktree.sh` | 削除 |
| `.claude/skills/auto-implement/SKILL.md` | スクリプト呼び出し部分を更新 |

## ステップ

### Step 1: `scripts/worktree-copy-includes.sh` を作成

既存の `setup-worktree.sh` の内容をそのまま移行する。引数は変更なし。

```bash
#!/usr/bin/env bash
# 責務: .worktreeinclude に記載されたファイルを worktree にコピーする
# 廃止条件: Claude Code が .worktreeinclude をネイティブサポートしたら
set -euo pipefail

WORKTREE_PATH="$1"
SOURCE_ROOT="$2"
INCLUDE_FILE="$SOURCE_ROOT/.worktreeinclude"

if [ ! -f "$INCLUDE_FILE" ]; then
    echo "worktree-copy-includes: .worktreeinclude not found, skipping"
    exit 0
fi

cd "$SOURCE_ROOT"
shopt -s globstar nullglob dotglob

while IFS= read -r pattern || [ -n "$pattern" ]; do
    [[ -z "$pattern" || "$pattern" == \#* ]] && continue
    for file in $pattern; do
        [ -f "$file" ] || continue
        dest="$WORKTREE_PATH/$file"
        mkdir -p "$(dirname "$dest")"
        cp "$file" "$dest"
        echo "  -> copied: $file"
    done
done < "$INCLUDE_FILE"
```

- コミットメッセージ: `refactor: worktree-copy-includes.sh を作成（setup-worktree.sh から分離）`

### Step 2: `scripts/worktree-fix-base-branch.sh` を作成

EnterWorktree のバグ回避専用スクリプト。

```bash
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
```

- コミットメッセージ: `refactor: worktree-fix-base-branch.sh を作成（EnterWorktree バグ回避）`

### Step 3: `scripts/setup-worktree.sh` を削除

- コミットメッセージ: `refactor: setup-worktree.sh を削除（責務分離完了）`

### Step 4: `SKILL.md` の §1.5 を更新

**②** のセクションを以下に変更：

```bash
SOURCE_ROOT=$(git worktree list | head -1 | awk '{print $1}')
bash "$SOURCE_ROOT/scripts/worktree-fix-base-branch.sh" "$(pwd)"
bash "$SOURCE_ROOT/scripts/worktree-copy-includes.sh" "$(pwd)" "$SOURCE_ROOT"
```

**③ セクション**（L90〜L99）を以下に変更（`git fetch` と `origin/develop` 指定を削除し、`checkout -B` のみ残す）：

```bash
git checkout -B {type}/issue-{number}
```

> `origin/develop` への修正は `worktree-fix-base-branch.sh` で完了済みのため、
> ここでは現在の HEAD（= origin/develop）から作業ブランチを作成するだけでよい。

- コミットメッセージ: `refactor: auto-implement スキルのworktreeセットアップを分離スクリプトに委譲`

## 検証方法

1. 別セッションで `/auto-implement` を実行
2. `git log --oneline -3` で develop の HEAD と一致するか確認
3. 作業ブランチ名が `{type}/issue-{number}` で作成されるか確認
4. `.worktreeinclude` のファイルがコピーされるか確認
5. `git branch -vv` で tracking が `origin/develop` になっているか確認
