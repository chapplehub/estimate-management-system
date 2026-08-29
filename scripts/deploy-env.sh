#!/usr/bin/env bash
# EC2 クローンの HEAD commit からイメージタグを導出し、APP_IMAGE / MIGRATE_IMAGE の
# export 文を標準出力に出す。副作用は無い。使い方: eval "$(scripts/deploy-env.sh)"
# 手順は docs/ops/deploy.md
set -euo pipefail
cd "$(dirname "$0")/.."

# release-image.yml の metadata-action（type=sha）が付けるタグは sha-<先頭 7 文字> 固定。
# git rev-parse --short=7 は曖昧衝突時に 8 文字以上を返しうるため cut で切る
tag="sha-$(git rev-parse HEAD | cut -c1-7)"

printf 'export APP_IMAGE=%s\n' "ghcr.io/chapplehub/estimate-management-system/app:${tag}"
printf 'export MIGRATE_IMAGE=%s\n' "ghcr.io/chapplehub/estimate-management-system/migrate:${tag}"
