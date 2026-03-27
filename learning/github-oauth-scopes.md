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

#### 方法1: workflow スコープを追加する（一旦採用したがのちにSSHプロトコルに切り替えた）

```bash
gh auth refresh -s workflow
```

#### 方法2: SSH プロトコルに切り替える(最終的に採用)

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

#### なぜ SSH にはスコープがないのか

| | HTTPS (OAuth/PAT) | SSH |
|---|---|---|
| 認証方式 | トークン文字列 | 公開鍵/秘密鍵ペア |
| 権限制御 | トークンにスコープを付与して細かく制限 | 鍵がアカウントに紐づき、アカウントの権限がそのまま適用 |
| workflow変更 | `workflow` スコープが必要 | アカウントに書き込み権限があればそのまま可能 |

設計思想の違い:

- **HTTPS + トークン**: トークンが漏洩した場合の被害を最小限にするため、「このトークンで何ができるか」をスコープで絞れる仕組み。漏洩リスクが比較的高い（URLに含まれる、ログに残る等）ため、細かい権限制御が必要
- **SSH鍵**: 秘密鍵はローカルマシンから出ないため漏洩リスクが低い。そのためスコープによる制限を設けず、アカウントの権限をフルに使える

#### GitHub は HTTPS と SSH のどちらを推奨しているか

GitHub は公式ドキュメント上で**どちらも明確に「推奨」していない**。
両方を並列に紹介しており、環境に合わせて選んでよいというスタンス。

GitHub が推奨しているのはプロトコルではなく**認証方式**について:

- PAT を使うなら **fine-grained PAT**（classic PAT より推奨）
- より制御が必要なら **GitHub App** の使用を推奨

参考: https://docs.github.com/ja/authentication/keeping-your-account-and-data-secure/about-authentication-to-github

#### `gh auth status` と実際のプロトコルの乖離に注意

`gh auth status` で `Git operations protocol: ssh` と表示されていても、remote URL が `https://` なら実際は HTTPS が使われる。
`git remote -v` で実際のプロトコルを確認すること。

## 参考

- `.github/workflows/playwright.yml` - 今回変更したワークフロー
- [GitHub OAuth scopes documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub 認証について](https://docs.github.com/ja/authentication/keeping-your-account-and-data-secure/about-authentication-to-github)
