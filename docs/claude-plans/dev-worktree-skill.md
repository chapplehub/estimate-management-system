# Plan: `wta` を Claude Code ネイティブ worktree に移行する `/dev-worktree` スキル

## Context

これまで開発時は、bashrc の `wta` 関数で worktree 作成 → セットアップ → VSCode 起動 → その中で Claude Code 起動、という手順を踏んでいた。理由は、かつて Claude Code の worktree 機能がベースブランチを main/master 固定にしていたため。

Claude Code のネイティブ worktree 機能（`EnterWorktree` ツール / `.worktreeinclude` / `origin/HEAD` ベース分岐）が改善されたので、`wta` を使わずに「同一セッションを維持したまま」worktree に入り、開発環境を整える `/dev-worktree` スキルへ移行する。

公式ドキュメント (https://code.claude.com/docs/en/worktrees) に準拠することを最優先とする。

### 調査で判明した重要事実
- **`.worktreeinclude` はネイティブ機能**（フック不要）。「パターン一致 *かつ* gitignore 対象」のファイルのみコピー。追跡済みファイルはコピーされない（worktree のチェックアウトに元から含まれるため）。
- **`worktree.baseRef` は `"fresh"` / `"head"` のみ**。`"develop"` のような任意 ref は不可。
- worktree は **`origin/HEAD`（リポジトリのデフォルトブランチ）から分岐**する。現状 `origin/HEAD` 未設定。→ `git remote set-head origin develop` で develop 基点が**ネイティブに**実現する。
- 既存の「フック方式の遺産」（`post-worktree-setup.sh` フック + `worktree-fix-base-branch.sh` + `worktree-copy-includes.sh`）は、上記ネイティブ機能で**すべて代替可能**＝不要。

### 確定した設計判断
- 実装形式: **Skill `/dev-worktree`**
- develop 基点: **`origin/HEAD` → develop**（公式準拠）。フック・矯正スクリプトは削除。
- ブランチ名正規化: **維持**（`test/123` → `test/issue-123`）
- VSCode 起動: **しない**（同一セッション継続。`code -n` は別プロセスで会話文脈を引き継げないため）

## 実装内容

### 1. develop 基点をネイティブ化（`origin/HEAD` 設定）
`origin/HEAD` を `origin/develop` に向けることで `EnterWorktree` が develop 基点で分岐する。
```bash
git remote set-head origin develop   # origin/HEAD -> origin/develop
```
**ただし自動実行はしない**。スキル実行時に `origin/HEAD` を点検し、develop 以外/未設定なら現状値を提示してユーザーに変更可否を確認してから実行する（後述ステップ3）。`worktree.baseRef` は既定（fresh = origin/HEAD 基点）のままでよく、settings.json への追記は不要。

### 2. 新規スキル `/dev-worktree` を作成
**ファイル: `.claude/skills/dev-worktree/SKILL.md`**（既存スキルの frontmatter 形式に倣う: `name: dev-worktree` / `description`（「開発用 worktree を作成しセットアップする」旨を日英で） / `user-invocable: true` / `context`）

スキルの手順:
1. `$ARGUMENTS` からブランチ名を取得。空ならエラーで終了。
2. **正規化**: 末尾が `/数字` のときのみ `/issue-数字` に補完（`sed -E 's|/([0-9]+)$|/issue-\1|'`）。`feat/issue-123` のように既に整形済みなら変化しない。
3. **前提チェック（破壊的変更はしない）**: `origin/HEAD` を確認する。
   - 既に `origin/develop` を指していれば何もしない。
   - 指していない（未設定 / 別ブランチ）場合は **自動で `git remote set-head` を実行せず、ユーザーに確認する**。現在の `origin/HEAD` の値を提示し、「`git remote set-head origin develop` に変更してよいか」を尋ねる。承認されたら実行、拒否されたらその旨を伝えて中断（worktree 作成に進まない）。理由: `origin/HEAD` はリポジトリ全体のデフォルトブランチ参照で、他の挙動にも影響しうるため勝手に書き換えない。
4. `EnterWorktree(name: <正規化後>)` を呼び、セッション cwd を `.claude/worktrees/<正規化後>` に切り替える。`.env`/`.env.*`/`settings.local.json` は `.worktreeinclude` によりネイティブにコピーされる。
5. **ブランチ名の保証**: `git branch --show-current` が正規化後の名前と異なる場合（`worktree-` 接頭辞が付くなどの挙動差を吸収）、`git branch -m <正規化後>` でリネーム。これでリポジトリのブランチ命名規則 `feat/issue-{number}` と `create-pr` スキルの番号抽出を確実に満たす。
6. **基点の検証**: `git rev-parse HEAD` == `git rev-parse origin/develop` を確認。異なれば警告を表示（破壊的 reset はしない）。
7. `pnpm install` を実行（セッション内なので進捗が見える）。
8. `pnpm exec prisma generate` を実行。
9. **失敗時ポリシー**（学習モードの contribution ポイント）: 7/8 がコケた場合の挙動（中断して報告 / 自動で `ExitWorktree` ロールバック / ベストエフォート継続）は、安全性と UX のトレードオフがあるため実装時にユーザーに 1 ブロック書いてもらう。
10. 完了報告（worktree パス・ブランチ名・次アクション）。

### 3. 旧フック方式の遺産を撤去（公式準拠・「フック不要」）
- `.claude/settings.json`: `PostToolUse` の `EnterWorktree` マッチャーブロック（現 200-208 行）を削除。
- 削除: `.claude/hooks/post-worktree-setup.sh`
- 削除: `scripts/worktree-fix-base-branch.sh`（`origin/HEAD` 設定で不要）
- 削除: `scripts/worktree-copy-includes.sh`（ネイティブ `.worktreeinclude` で代替）
- 保持: `.worktreeinclude`（ネイティブ機構）。`scripts/bashrc-worktree-functions.sh` は shell 側の参照用なので触らない。

### 4. `.gitignore` 整備
- 公式 Tip に従い `.claude/worktrees/` を追加（既存の `/worktrees/`（旧 wta 用）は残置可）。
- 実装時に `.env` / `.env.*` が gitignore 対象であることを確認（ネイティブコピーは gitignore 対象ファイルのみ対象のため）。必要なら `next-env.d.ts`（gitignore 対象なら）を `.worktreeinclude` に追加し wta と同等に。

## 影響ファイル
- 新規: `.claude/skills/dev-worktree/SKILL.md`
- 編集: `.claude/settings.json`（EnterWorktree フックブロック削除）, `.gitignore`, 必要なら `.worktreeinclude`
- 削除: `.claude/hooks/post-worktree-setup.sh`, `scripts/worktree-fix-base-branch.sh`, `scripts/worktree-copy-includes.sh`
- リポジトリ設定: `git remote set-head origin develop`

## 検証手順（end-to-end）
1. `origin/HEAD` 確認時、develop 以外ならユーザー確認が入ること。承認後 `git symbolic-ref refs/remotes/origin/HEAD` が `refs/remotes/origin/develop` を返すこと。拒否時は worktree 作成に進まないこと。
2. メインリポジトリで Claude セッションを起動し `/dev-worktree feat/999` を実行。
   - `.claude/worktrees/feat/issue-999`（または相当パス）に worktree が作られる。
   - `git branch --show-current` が `feat/issue-999`。
   - 基点が `origin/develop`（`git merge-base --is-ancestor origin/develop HEAD` 等で確認、新規ブランチなら HEAD == origin/develop）。
   - `.env` / `.env.test` / `.claude/settings.local.json` が worktree に存在。
   - `node_modules` と Prisma Client が生成済み（`pnpm dev` が起動できる）。
   - 同一 Claude セッションのまま worktree 内で会話継続できている。
3. `/dev-worktree test/123` で正規化（`test/issue-123`）が効くこと。
4. 後片付け: `ExitWorktree(action: remove)` または `git worktree remove` で削除できること。

## コミット方針
CLAUDE.md の規約に従い、意味のあるまとまりごとにコミット:
1. `origin/HEAD` 設定（ユーザー確認のうえ） + 旧フック/スクリプト撤去（設計判断: ネイティブ機能で代替可のため）
2. `/dev-worktree` スキル追加
3. `.gitignore` / `.worktreeinclude` 整備
