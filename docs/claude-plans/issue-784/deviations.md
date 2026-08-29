# Issue #784: 計画からの逸脱記録

計画: `ec2-deploy-runbook-and-scripts.md`

## 1. `tls-certificates.md` の書き換え箇所を 2 か所から 3 か所に増やした

- **元の計画**: 2 章手順 5 と 3 章手順 5 の `up -d` を `scripts/deploy-apply.sh` に書き換える（2 か所）
- **実際の実装**: 上記 2 か所に加え、3 章手順 2 の `up -d nginx` の直前に `eval "$(scripts/deploy-env.sh)"` を足した
- **逸脱の理由**: `docker compose up -d nginx` は指定サービスだけでなく依存先（`nginx` → `app` → `migrate` → `db`）も起動する。変数未設定のままだと app / migrate が `latest` で立ち上がり、計画の設計判断 7（`up -d` の正規経路を HEAD 由来のタグに限定する）が初回発行の手順内で破られる。`deploy-apply.sh` に置き換えると証明書が無い状態で全サービスが起動して nginx が落ちるため、`eval` の前置で対応した

## 2. `deploy-apply.sh` の `eval` を代入と 2 行に分けた

- **元の計画**: `eval "$(scripts/deploy-env.sh)"` の 1 行
- **実際の実装**: `exports="$(scripts/deploy-env.sh)"` → `eval "${exports}"` の 2 行
- **逸脱の理由**: `eval "$(cmd)"` の形は `cmd` の失敗が `set -e` に拾われない（`eval` の終了コードは評価した文字列のものになる）。代入文でのコマンド置換失敗は `set -e` が捕まえるため、`deploy-env.sh` が失敗したときに `APP_IMAGE` 未設定のまま先へ進まない。手順書・seed 文書で人が対話的に打つ形は計画どおり 1 行のまま

## 3. ローカルの shellcheck は Docker イメージで実行した

- **元の計画**: ローカルで `shellcheck --severity=warning scripts/deploy*.sh` を通す
- **実際の実装**: 開発機に shellcheck が無いため `docker run --rm -v "$PWD/scripts:/mnt:ro" koalaman/shellcheck:stable` で実行した（warning・style とも指摘なし）
- **逸脱の理由**: 実行手段の違いのみ。CI（`static` ジョブ）ではプリインストール版を使う計画のまま

## 4. Step 8（実機検証）は PR 作成時点では未実施

- **元の計画**: 本ブランチのリリース（develop → main マージ）後に EC2 で検証し、結果を PR 本文に記録する
- **実際の実装**: 計画どおり未実施。develop へのマージ前には検証できない（イメージは main の commit にしか無い）
- **逸脱の理由**: 逸脱ではなく計画どおりの順序だが、PR の完了条件が「Step 1〜7」であることを明示するために記録する。実機検証の結果は main へのリリース後に Issue #784 へコメントし、手順書と差があれば別 PR で修正する
