---
name: dev-worktree
description: 開発用 worktree を作成しセットアップする。Use when worktreeで開発を始めたいとき/「worktree作って」と言われたとき。ブランチ名正規化→EnterWorktree→依存インストール→Prisma生成までを同一セッションで実施する。旧 bashrc の wta 関数の後継。
user-invocable: true
---

# プロンプト内容

あなたは開発環境セットアップの担当です。
`$ARGUMENTS` で渡されたブランチを worktree として作成し、同一セッションのまま開発できる状態にしてください。

これは旧 bashrc 関数 `wta` の後継です。Claude Code のネイティブ worktree 機能（`EnterWorktree` / `.worktreeinclude` / `origin/HEAD` ベース分岐）を使い、セッションを切らずに worktree へ入ります。

## ステップ 1: ブランチ名の取得

`$ARGUMENTS` からブランチ名を取得する。

- 空の場合はエラーとして終了し、使い方（例: `/dev-worktree feat/123`）を返す。

## ステップ 2: ブランチ名の正規化

末尾が `/数字` のときのみ `/issue-数字` に補完する。それ以外は変更しない。

```bash
NORMALIZED=$(echo "$ARGUMENTS" | sed -E 's|/([0-9]+)$|/issue-\1|')
echo "正規化後のブランチ名: $NORMALIZED"
```

- 例: `feat/123` → `feat/issue-123`
- 例: `feat/issue-123` → 変化なし（既に整形済み）
- 例: `hotfix/login-bug` → 変化なし（末尾が数字でない）

## ステップ 3: origin/HEAD の点検（破壊的変更はしない）

worktree はリポジトリのデフォルトブランチ（`origin/HEAD`）から分岐する。develop 基点にするため `origin/HEAD` を確認する。

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo "UNSET"
```

- 結果が `refs/remotes/origin/develop` なら、そのまま次へ進む。
- `develop` 以外、または `UNSET` の場合は **自動で変更せず、必ずユーザーに確認する**。
  - 現在の値を提示し、「`git remote set-head origin develop` を実行して `origin/HEAD` を `origin/develop` に向けてよいか」を尋ねる。
  - 承認されたら実行する: `git remote set-head origin develop`
  - 拒否されたら、その旨を伝えて**処理を中断する**（worktree 作成に進まない）。基点が develop にならないため。
  - 理由: `origin/HEAD` はリポジトリ全体のデフォルトブランチ参照であり、他の操作にも影響しうる。勝手に書き換えない。

## ステップ 4: EnterWorktree で worktree 作成 & セッション移動

`EnterWorktree` ツールを `name: <正規化後のブランチ名>` で呼び出す。

- Claude Code が `.claude/worktrees/<正規化後>` に worktree を作成し、セッションの cwd をそこへ切り替える。
- `.env` / `.env.*` / `.claude/settings.local.json` など gitignore 対象ファイルは `.worktreeinclude` によりネイティブに自動コピーされる（手動コピー不要）。

## ステップ 5: ブランチ名の保証

EnterWorktree が付けたブランチ名が、正規化後の名前と一致するか確認する。

```bash
CURRENT=$(git branch --show-current)
echo "現在のブランチ: $CURRENT"
```

- `$CURRENT` が `$NORMALIZED` と異なる場合（`worktree-` 接頭辞が付くなどの挙動差を吸収するため）、リネームする:

```bash
git branch -m "$NORMALIZED"
```

- これでこのリポジトリのブランチ命名規則 `feat/issue-{number}` と `create-pr` スキルの Issue 番号抽出を確実に満たす。

## ステップ 6: ベース基点の検証

新規ブランチなので、基点が `origin/develop` であれば HEAD は origin/develop と一致するはず。

```bash
git fetch origin develop --quiet
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/develop)" ]; then
  echo "OK: develop 基点で作成されています"
else
  echo "⚠️ 警告: HEAD が origin/develop と一致しません。基点を確認してください。"
fi
```

- 一致しない場合は**警告を表示するだけ**にとどめ、`git reset --hard` のような破壊的操作は行わない。基点が違う原因（origin/HEAD 設定漏れなど）をユーザーに報告する。

## ステップ 7: 依存関係のインストール

```bash
pnpm install
```

## ステップ 8: Prisma クライアント生成

```bash
pnpm exec prisma generate
```

## ステップ 9: 失敗時のポリシー

ステップ 7 / 8 が失敗した場合:

- **worktree は削除せず保持する**（`ExitWorktree` でロールバックしない）。作成済みのブランチと状態を残し、ユーザーが原因を調査・再実行できるようにするため。
- 失敗したコマンドと終了コード、推定原因（ネットワーク・依存解決・スキーマ不整合など）を報告する。
- 後続ステップには進まない。

> このポリシーは「安全側（壊さず残す）」を既定とする。もし「失敗したら自動でロールバックしてほしい」など別方針が望ましければ、このステップを編集して `ExitWorktree(action: "remove", discard_changes: true)` を呼ぶよう変更してよい。

## ステップ 10: 完了報告

以下を報告する:

- 作成された worktree のパス（`.claude/worktrees/<正規化後>`）
- ブランチ名
- ベース基点（develop か）
- 次アクションの案内（例: `pnpm dev` で開発サーバ起動 / そのまま実装を依頼）

> セッションは切り替わっておらず、同一の会話のまま worktree 内で作業を継続できる。VSCode の新規ウィンドウは開かない（`code -n` は別プロセスで会話文脈を引き継げないため）。
