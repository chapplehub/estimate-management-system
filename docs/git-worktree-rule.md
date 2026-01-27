# Git Worktree 管理関数 運用ルール

## 概要

複数ブランチを同時に作業するための worktree を簡単に管理するシェル関数。
worktree 作成時に自動で環境セットアップ（npm install、prisma generate、.env コピー）を行い、作成したディレクトリに移動します。

## ディレクトリ構造

```
my-project/
├── .git/
├── src/
├── worktrees/           ← worktree はここに作成される
│   ├── feature-login/
│   ├── feature-signup/
│   └── hotfix-bug-123/
└── .gitignore           ← /worktrees/ を追加しておく
```

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `wta <branch>` | worktree を追加（自動セットアップ + cd） |
| `wtr <branch> [opt]` | worktree を削除 |
| `wtl` | worktree 一覧表示 |

## 使い方

### worktree 追加

```bash
wta feature/new-feature
```

実行される処理：
1. worktree 作成（ブランチがなければ新規作成）
2. `.env` ファイルのコピー
3. `npm install`
4. `prisma generate`
5. 作成したディレクトリに `cd`

- `feature/new-feature` → `worktrees/feature-new-feature/` に配置

### worktree 削除

```bash
# worktree のみ削除（ブランチは残る）
wtr feature/new-feature

# worktree + ブランチ削除（マージ済みのみ）
wtr feature/new-feature -d

# 強制削除（未コミット変更・未マージでも削除）
wtr feature/new-feature -D
```

### 一覧表示

```bash
wtl
```

## オプション早見表

| オプション | worktree | ブランチ | 備考             |
| ---------- | -------- | -------- | ---------------- |
| なし       | 削除     | 残る     | 安全             |
| `-d`       | 削除     | 削除     | マージ済みのみ   |
| `-D`       | 強制削除 | 強制削除 | 未マージでも削除 |

## セットアップ

### 1. ~/.bashrc に関数を追加

以下のどちらかの方法で設定してください。

#### 方法A: source で読み込む（推奨）

`~/.bashrc` に以下を追加：

```bash
# Git Worktree 管理関数を読み込む
if [ -f ~/dev/estimate-management-system/scripts/bashrc-worktree-functions.sh ]; then
    source ~/dev/estimate-management-system/scripts/bashrc-worktree-functions.sh
fi
```

#### 方法B: 直接コピー

`scripts/bashrc-worktree-functions.sh` の内容を `~/.bashrc` に直接コピー。

### 2. 設定を反映

```bash
source ~/.bashrc
```

### 3. .gitignore に追加

```gitignore
/worktrees/
```

## カスタマイズ

`scripts/bashrc-worktree-functions.sh` の `wta` 関数を編集することで、プロジェクト固有の初期化処理を追加できます。

例：Claude Code を自動起動したい場合は、`wta` 関数の最後に `cc` を追加。

## 注意事項

- worktree 内で作業中のファイルは、削除前にコミットまたはスタッシュすること
- `-D` は未マージの作業も消えるので慎重に使う
- メインの作業ディレクトリでコマンドを実行すること
- `git wta` ではなく `wta` で実行（シェル関数のため）
