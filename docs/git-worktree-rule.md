```markdown
# Git Worktree エイリアス運用ルール

## 概要

複数ブランチを同時に作業するための worktree を簡単に管理するエイリアス。

## ディレクトリ構造
```

my-project/
├── .git/
├── src/
├── worktrees/ ← worktree はここに作成される
│ ├── feature-login/
│ ├── feature-signup/
│ └── hotfix-bug-123/
└── .gitignore ← /worktrees/ を追加しておく

````

## エイリアス一覧

| コマンド | 説明 |
|----------|------|
| `git wta <branch>` | worktree を追加 |
| `git wtr <branch> [opt]` | worktree を削除 |
| `git wtl` | worktree 一覧表示 |

## 使い方

### worktree 追加

```bash
git wta feature/new-feature
````

- ブランチが存在すれば、そのブランチで worktree 作成
- ブランチが存在しなければ、新規ブランチを作成して worktree 作成
- `feature/new-feature` → `worktrees/feature-new-feature/` に配置

### worktree 削除

```bash
# worktree のみ削除（ブランチは残る）
git wtr feature/new-feature

# worktree + ブランチ削除（マージ済みのみ）
git wtr feature/new-feature -d

# 強制削除（未コミット変更・未マージでも削除）
git wtr feature/new-feature -D
```

### 一覧表示

```bash
git wtl
```

## オプション早見表

| オプション | worktree | ブランチ | 備考             |
| ---------- | -------- | -------- | ---------------- |
| なし       | 削除     | 残る     | 安全             |
| `-d`       | 削除     | 削除     | マージ済みのみ   |
| `-D`       | 強制削除 | 強制削除 | 未マージでも削除 |

## セットアップ

### 1. ~/.gitconfig に追加

```ini
[alias]
    wta = "!f() { \
        branch=\"$1\"; \
        safe_branch=$(echo \"$branch\" | sed 's/\\//-/g'); \
        root=$(git rev-parse --show-toplevel); \
        worktrees_dir=\"$root/worktrees\"; \
        mkdir -p \"$worktrees_dir\"; \
        path=\"$worktrees_dir/$safe_branch\"; \
        if git show-ref --verify --quiet \"refs/heads/$branch\"; then \
            git worktree add \"$path\" \"$branch\"; \
        else \
            git worktree add -b \"$branch\" \"$path\"; \
        fi; \
    }; f"

    wtr = "!f() { \
        branch=\"$1\"; \
        opt=\"$2\"; \
        worktree_path=$(git worktree list --porcelain | grep -B2 \"branch refs/heads/$branch\" | grep \"worktree\" | cut -d' ' -f2); \
        if [ -z \"$worktree_path\" ]; then \
            echo \"Worktree for branch '$branch' not found\"; \
            return 1; \
        fi; \
        if [ \"$opt\" = \"-D\" ]; then \
            git worktree remove --force \"$worktree_path\"; \
        else \
            git worktree remove \"$worktree_path\"; \
        fi; \
        if [ \"$opt\" = \"-d\" ]; then \
            git branch -d \"$branch\"; \
        elif [ \"$opt\" = \"-D\" ]; then \
            git branch -D \"$branch\"; \
        fi; \
    }; f"

    wtl = worktree list
```

### 2. .gitignore に追加

```gitignore
/worktrees/
```

## 注意事項

- worktree 内で作業中のファイルは、削除前にコミットまたはスタッシュすること
- `-D` は未マージの作業も消えるので慎重に使う
- メインの作業ディレクトリでエイリアスを実行すること

```

---

これでどうかな？追加したい項目とかある？
```
