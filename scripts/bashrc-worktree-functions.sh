# =============================================================================
# Git Worktree 管理関数
#
# このファイルの内容を ~/.bashrc に追加してください
# または、以下を ~/.bashrc に追加して読み込んでください:
#   source /path/to/bashrc-worktree-functions.sh
# =============================================================================

# Worktree 追加（自動セットアップ + cd）
wta() {
    local branch="$1"
    if [ -z "$branch" ]; then
        echo "Usage: wta <branch-name>"
        return 1
    fi

    local safe_branch=$(echo "$branch" | sed 's/\//-/g')
    local root=$(git rev-parse --show-toplevel 2>/dev/null)

    if [ -z "$root" ]; then
        echo "Error: Not in a git repository"
        return 1
    fi

    local worktrees_dir="$root/worktrees"
    local path="$worktrees_dir/$safe_branch"

    mkdir -p "$worktrees_dir"

    # Worktree 作成
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        git worktree add "$path" "$branch"
    else
        git worktree add -b "$branch" "$path"
    fi

    if [ $? -ne 0 ]; then
        echo "Error: Failed to create worktree"
        return 1
    fi

    echo ""
    echo "=========================================="
    echo " Worktree Setup: $path"
    echo "=========================================="
    echo ""

    # .env のコピー
    echo "[1/4] .env ファイルをコピー..."
    if [ -f "$root/.env" ]; then
        cp "$root/.env" "$path/.env"
        echo "  -> コピー完了: .env"
    else
        echo "  -> スキップ: $root/.env が見つかりません"
    fi

    # npm install
    echo ""
    echo "[2/4] npm install..."
    (cd "$path" && npm install)

    # prisma generate
    echo ""
    echo "[3/4] prisma generate..."
    (cd "$path" && npx prisma generate)

    # ディレクトリ移動
    echo ""
    echo "[4/4] ディレクトリ移動..."
    cd "$path"

    echo ""
    echo "=========================================="
    echo " セットアップ完了!"
    echo "=========================================="
    echo ""
    echo "現在のディレクトリ: $(pwd)"
    echo ""
    echo "Claude Code を起動するには: cc"
    echo "開発サーバーを起動するには: npm run dev"
    echo ""
}

# Worktree 削除
wtr() {
    local branch="$1"
    local opt="$2"

    if [ -z "$branch" ]; then
        echo "Usage: wtr <branch-name> [-d|-D]"
        echo "  -d: ブランチも削除（マージ済みのみ）"
        echo "  -D: 強制削除（未マージでも削除）"
        return 1
    fi

    local worktree_path=$(git worktree list --porcelain | grep -B2 "branch refs/heads/$branch" | grep "worktree" | cut -d' ' -f2)

    if [ -z "$worktree_path" ]; then
        echo "Worktree for branch '$branch' not found"
        return 1
    fi

    # Worktree 削除
    if [ "$opt" = "-D" ]; then
        git worktree remove --force "$worktree_path"
    else
        git worktree remove "$worktree_path"
    fi

    # ブランチ削除
    if [ "$opt" = "-d" ]; then
        git branch -d "$branch"
    elif [ "$opt" = "-D" ]; then
        git branch -D "$branch"
    fi

    echo "Worktree removed: $worktree_path"
}

# Worktree 一覧
wtl() {
    git worktree list
}
