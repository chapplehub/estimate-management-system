#!/usr/bin/env bash
# 適用フェーズ: 現 HEAD のイメージを pull し、compose を起動し、nginx を reload し、
# 公開 URL の health を確認する。git は触らない（HEAD を動かすのは deploy.sh）。
# 単独で実行すると「git を触らずに現 HEAD を再適用する」入口になる。手順は docs/ops/deploy.md
set -euo pipefail
cd "$(dirname "$0")/.."

# eval "$(...)" の 1 行形だと deploy-env.sh の失敗が set -e に拾われないため、代入を挟む
exports="$(scripts/deploy-env.sh)"
eval "${exports}"
tag="${APP_IMAGE##*:}"

# 配列形式にするのは、文字列を展開する $compose 形式が shellcheck SC2086 に当たるため
compose=(docker compose -f compose.prod.yaml --env-file .env.production)

# up -d はローカルにあるタグを再 pull しないため pull は必須。過去の暗黙ビルドが残した
# 偽のローカルタグも、ここで GHCR のものに上書きされるか、GHCR に無ければ止まる
if ! "${compose[@]}" pull; then
  echo "pull 失敗: ${tag} が GHCR に無い。Release Image ワークフローが未完了か、main に含まれない commit を指定している（docs/ops/deploy.md 8 章）" >&2
  exit 1
fi

# --wait は app が healthy（= migrate が正常終了し app が応答している）になるまで待つ。
# 無いと直後の curl が app の start_period 中に走り、正常なデプロイでも失敗しうる
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 120

# conf.d は bind mount のため up -d ではコンテナが再作成されず反映されない。
# 変更の有無によらず毎回 reload する（変更が無ければ無害）。
# -T は TTY を割り当てない指定。後続の自動化（SSM 等）が TTY 無しで呼ぶため今から固定する
"${compose[@]}" exec -T nginx nginx -t
"${compose[@]}" exec -T nginx nginx -s reload

curl -fsS --write-out '\n' https://chapple-esm.duckdns.org/api/health

echo "deployed: $(git rev-parse HEAD) (${tag})"
