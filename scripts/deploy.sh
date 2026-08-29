#!/usr/bin/env bash
# git フェーズ（入口）: EC2 クローンを指定 ref（既定 origin/main）に detach し、
# 適用フェーズ（deploy-apply.sh）へ exec で引き継ぐ。
# 通常デプロイもロールバックも scripts/deploy.sh [ref] の 1 コマンド。手順は docs/ops/deploy.md
set -euo pipefail
cd "$(dirname "$0")/.."

# 追跡ファイルの編集も未追跡ファイルの追加も drift（nginx は conf.d/*.conf を全部読む）。
# 上書きも退避もせず止める。解消手順は docs/ops/deploy.md 8 章
if [ -n "$(git status --porcelain)" ]; then
  echo "drift 検出: EC2 上のクローンに未コミットの変更がある。docs/ops/deploy.md 8 章に従って解消してから再実行する" >&2
  git status --short >&2
  exit 1
fi

git fetch origin

# --detach でブランチを追わず指定 commit に固定する。これで「HEAD = 動いているもの」が
# 通常デプロイでもロールバックでも成り立つ（ブランチを追うと、ロールバック後の再実行が
# fast-forward で旧 commit を打ち消す）
git checkout --detach "${1:-origin/main}"

# 最終行を exec にする。checkout で本ファイル自身が書き換わっても、この後に読む行が無いため
# 影響を受けず、適用フェーズは必ず checkout 後（= HEAD）のスクリプトで走る
exec scripts/deploy-apply.sh
