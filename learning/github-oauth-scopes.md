# GitHub OAuth スコープと workflow スコープ

作成日: 2026-03-27

## 概要

GitHub Actions のワークフローファイル（`.github/workflows/`）を変更してpushする際に `workflow` スコープが必要になる。
この問題の原因、解決方法、および GitHub OAuth スコープ全般について整理する。

## 詳細

### 発生した問題

`.github/workflows/playwright.yml` を変更して `git push` したところ、以下のエラーが発生した。

```
! [remote rejected] develop -> develop (refusing to allow an OAuth App to create or update workflow `.github/workflows/playwright.yml` without `workflow` scope)
```

### 原因

GitHub は CI ワークフローファイルの変更に対して、通常の `repo` スコープとは別に **`workflow` スコープ** を要求する。
これはワークフローが任意コード実行できるため、改ざん防止のセキュリティ設計。

### 解決方法

#### 方法1: workflow スコープを追加する（今回採用）

```bash
gh auth refresh -s workflow
```

#### 方法2: SSH プロトコルに切り替える

SSH 経由なら OAuth トークンのスコープは関係ないため、問題を回避できる。

```bash
git remote set-url origin git@github.com:<user>/<repo>.git
```

#### 方法3: git の認証ヘルパーを gh に設定する

```bash
gh auth setup-git
```

### トークンのスコープ確認方法

```bash
gh auth status
```

出力例:

```
- Token scopes: 'admin:public_key', 'gist', 'read:org', 'repo'
```

### GitHub OAuth スコープ一覧

| スコープ | 権限内容 |
|---|---|
| `repo` | プライベートリポジトリへのフルアクセス（コード、コミット、PR、issue等） |
| `repo:status` | コミットステータスの読み書き |
| `repo_deployment` | デプロイメントステータスの読み書き |
| `public_repo` | パブリックリポジトリのみアクセス |
| `workflow` | GitHub Actions ワークフローファイルの変更 |
| `write:packages` | GitHub Packages の書き込み |
| `read:packages` | GitHub Packages の読み取り |
| `delete:packages` | GitHub Packages の削除 |
| `admin:org` | Organization の管理（チーム、メンバー等） |
| `admin:repo_hook` | リポジトリ Webhook の管理 |
| `admin:org_hook` | Organization Webhook の管理 |
| `gist` | Gist の作成・編集 |
| `notifications` | 通知の読み取り |
| `user` | ユーザープロフィール情報の読み書き |
| `user:email` | メールアドレスの読み取り |
| `read:org` | Organization メンバーシップの読み取り |
| `audit_log` | 監査ログの読み取り |
| `project` | GitHub Projects の読み書き |
| `admin:ssh_signing_key` | SSH 署名キーの管理 |

### `workflow` スコープが `repo` と分離されている理由

CI ワークフローは `run:` ステップで任意のコマンドを実行できる。
もしワークフローファイルの変更が `repo` スコープだけで可能だと、トークンが漏洩した場合にCIを悪用した攻撃（暗号通貨マイニング、シークレットの窃取等）が容易になる。
そのため GitHub はワークフロー変更を別スコープとして分離し、明示的な許可を求める設計にしている。

### 補足: HTTPS vs SSH と認証の関係

- **HTTPS**: OAuth トークン（`gho_****`）で認証。スコープの制約を受ける
- **SSH**: SSH 鍵で認証。OAuth スコープは無関係

`gh auth status` で `Git operations protocol: ssh` と表示されていても、remote URL が `https://` なら実際は HTTPS が使われる。
`git remote -v` で実際のプロトコルを確認すること。

## 参考

- `.github/workflows/playwright.yml` - 今回変更したワークフロー
- [GitHub OAuth scopes documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
