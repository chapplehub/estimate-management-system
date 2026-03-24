# auto-implement スキル改良: `.worktreeinclude` コピー処理の追加

## Context

`auto-implement` スキルの worktree セットアップ工程に問題がある:
- `.worktreeinclude` ファイルは存在するが、コピーする仕組みがない
- `settings.local.json` を丸ごと上書きしており、permissions / MCP 設定が消える
- `git wta` エイリアスが参照する `scripts/setup-worktree.sh` が未作成

汎用スクリプト `setup-worktree.sh` を作成し、SKILL.md と `bashrc-worktree-functions.sh` の両方から利用する。

---

## Step 1: `scripts/setup-worktree.sh` を作成

**ファイル:** `scripts/setup-worktree.sh` (新規)

`.worktreeinclude` を読み取り、glob パターンを展開してファイルをコピーするスクリプト。

- 引数: `$1` = worktree パス, `$2` = ソースリポジトリルート（既存 git alias と同じシグネチャ）
- `globstar` / `nullglob` / `dotglob` で `**` パターン・dotfile に対応
- 空行・`#` コメント行をスキップ
- `mkdir -p` で親ディレクトリを自動作成
- `.worktreeinclude` が存在しない場合は正常終了（exit 0）

```bash
#!/usr/bin/env bash
set -euo pipefail

WORKTREE_PATH="$1"
SOURCE_ROOT="$2"
INCLUDE_FILE="$SOURCE_ROOT/.worktreeinclude"

if [ ! -f "$INCLUDE_FILE" ]; then
    echo "setup-worktree: .worktreeinclude not found, skipping"
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

**コミット:** `feat: .worktreeinclude を読み取る setup-worktree.sh を作成`

---

## Step 2: SKILL.md セクション 1.5 を更新

**ファイル:** `.claude/skills/auto-implement/SKILL.md`

### 2a. ① の直後に「②（新規）.worktreeinclude コピー」を追加

```markdown
**② .worktreeinclude のファイルをコピー**

ソースリポジトリの `.worktreeinclude` に記載されたファイルを worktree にコピーする:

```bash
SOURCE_ROOT=$(git worktree list | head -1 | awk '{print $1}')
bash "$SOURCE_ROOT/scripts/setup-worktree.sh" "$(pwd)" "$SOURCE_ROOT"
```
```

以降のステップ番号を ③〜⑥ に繰り下げ。

### 2b. 旧④（新⑤）settings.local.json を plansDirectory のみ更新に変更

```markdown
**⑤ settings.local.json の plansDirectory を更新**

②でコピー済みの `.claude/settings.local.json` の `plansDirectory` のみを更新する:

```bash
if [ -f .claude/settings.local.json ]; then
    jq --arg dir "docs/claude-plans/issue-{number}" '.plansDirectory = $dir' \
      .claude/settings.local.json > .claude/settings.local.json.tmp \
      && mv .claude/settings.local.json.tmp .claude/settings.local.json
else
    mkdir -p .claude
    echo '{"plansDirectory": "docs/claude-plans/issue-{number}"}' > .claude/settings.local.json
fi
```
```

**コミット:** `refactor: SKILL.md に .worktreeinclude コピー工程を追加し settings.local.json 更新を部分更新に変更`

---

## Step 3: `bashrc-worktree-functions.sh` を更新

**ファイル:** `scripts/bashrc-worktree-functions.sh`

`wta()` 関数の `.env` ハードコードコピー（48-55行）を `setup-worktree.sh` 呼び出しに置換:

```bash
# .worktreeinclude に基づくファイルコピー
echo "[1/4] .worktreeinclude のファイルをコピー..."
if [ -f "$root/scripts/setup-worktree.sh" ]; then
    bash "$root/scripts/setup-worktree.sh" "$path" "$root"
else
    echo "  -> スキップ: setup-worktree.sh が見つかりません"
    if [ -f "$root/.env" ]; then
        cp "$root/.env" "$path/.env"
        echo "  -> コピー完了: .env (フォールバック)"
    fi
fi
```

**コミット:** `refactor: wta() のファイルコピーを setup-worktree.sh に委譲`

---

## 変更対象ファイル

| ファイル | 操作 |
|---------|------|
| `scripts/setup-worktree.sh` | 新規作成 |
| `.claude/skills/auto-implement/SKILL.md` | 編集（セクション 1.5） |
| `scripts/bashrc-worktree-functions.sh` | 編集（wta 関数） |

---

## 検証方法

1. `setup-worktree.sh` の単体テスト: 手動で `bash scripts/setup-worktree.sh /tmp/test-wt .` を実行し、`.env` と `.claude/settings.local.json` がコピーされることを確認
2. `jq` コマンドの動作確認: `jq --arg dir "test" '.plansDirectory = $dir' .claude/settings.local.json` で permissions が保持されることを確認
3. SKILL.md の手順が論理的に一貫していること（コピー → checkout → install → plansDirectory 更新 → mkdir）
