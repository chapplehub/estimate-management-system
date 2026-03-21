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
