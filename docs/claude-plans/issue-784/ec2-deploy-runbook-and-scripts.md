# Issue #784: EC2 公開デモ環境への通常デプロイ手順書（docs/ops/deploy.md）を整備する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

EC2 公開デモ環境への通常デプロイを、**「EC2 で動いているものはクローンの HEAD commit で一意に決まる」** という原則のもとに手順書化・スクリプト化する。

- `docs/ops/deploy.md` を新設する（8 章構成）
- デプロイスクリプトを 3 本に分けて `scripts/` に置く（`deploy.sh` / `deploy-apply.sh` / `deploy-env.sh`）
- CI の `static` ジョブに shellcheck を追加する
- ADR を 1 本起票する（EC2 の稼働リリースを HEAD commit に固定し、イメージタグをそこから導出する）
- 既存 ops 文書 2 本（`tls-certificates.md` / `demo-seed.md`）を新方式に整合させる
- `CLAUDE.md` / `README.md` にポインタを追記する
- 実機（EC2）でのデプロイ成功を完了条件とする

前提: #761（`compose.prod.yaml` から `build:` を削除、PR #785）は develop にマージ済み。main には本イシューのリリース時に同梱される。

Issue 本文からの変更点（着手時に Issue へコメントで反映する）:

- 「EC2 は main を追う」「`git pull --ff-only` が drift 検出器」→ **detached checkout ＋ `git status --porcelain`** に変更。理由: `--ff-only` では `git checkout <旧 commit>` 後に同じ手順を再実行すると fast-forward でロールバックが打ち消される／未追跡の `conf.d/*.conf` を検出できない
- 「`scripts/deploy.sh` 1 本」→ 3 ファイル構成
- `tls-certificates.md` / `demo-seed.md` の整合修正がスコープに加わる

## 設計判断

### 1. EC2 クローンの定義（git 操作モデル）
- A. main ブランチを追う作業ツリー。`git pull --ff-only origin main` で更新（Issue 本文の案）
- B. 指定されたリリース commit に **detach された読み取り専用チェックアウト**。`git checkout --detach ${ref:-origin/main}`
- C. `git checkout main && git reset --hard <ref>`
- 採用: B。A はロールバック後の再実行で fast-forward が旧 commit を打ち消し、drift 検出も不完全（変更が入ってこないファイルの直接編集・未追跡ファイルを素通り）。C は drift を検出せず消してしまう。B なら通常デプロイもロールバックも `scripts/deploy.sh [ref]` の 1 コマンドになり、「HEAD = 動いているもの」が常に成り立つ。代償の detached HEAD は手順書に「正常状態」と明記して吸収する

### 2. drift 検出
- `git status --porcelain` が空でなければ停止（未追跡ファイルを含む。`.env.production` は gitignore 済み）
- 理由: nginx は `conf.d/*.conf` を全部読むため、未追跡の conf 追加も drift

### 3. スクリプトの構成
- A. 1 ファイル + `--apply` フラグで git フェーズ／適用フェーズを分岐
- B. **フェーズごとに別ファイル**（`deploy.sh` → `exec deploy-apply.sh`）
- 採用: B。変更頻度が違う（git フェーズは安定、適用フェーズは compose と共に進化）／引数分岐が消える／git フェーズの最終行が `exec` なら checkout による自己書き換えの影響を受けない／責務が名前に出る。適用フェーズは**必ず HEAD のスクリプト**で走り、`deploy-apply.sh` 単独実行が「git を触らずに現 HEAD を再適用する」正規の入口になる
- TAG 導出は `scripts/deploy-env.sh` に切り出す（設計判断 7 を参照）

### 4. 適用フェーズのコマンド列
- `up -d --remove-orphans --wait --wait-timeout 120`（`--wait` 無しだと `curl` が app の `start_period` 中に走り偽陰性。migrate 失敗 → app 起動不能を nginx reload の前に検出できる）
- `docker compose exec -T`（後続の SSM 自動化は TTY 無し。今から固定する）
- `pull` 失敗時に最頻出原因 2 つ（Release Image 未完了／main 外の commit）を stderr に出す
- nginx `-t` → `reload` は無条件で毎回（conf.d は bind mount のため `up -d` で反映されない。変更が無くても無害）
- TAG は `git rev-parse HEAD | cut -c1-7`（`--short=7` は曖昧衝突時に 8 文字以上を返しうる。metadata-action `type=sha` は 7 文字固定）
- `compose` コマンドは配列形式（shellcheck SC2086 対応。空白を含む引数でも壊れない）

### 5. ロールバックの境界
- `scripts/deploy.sh <旧 commit>` で戻るのは**イメージ＋起動宣言のみ。DB スキーマは戻らない**
- 戻せる条件の判定: `git diff --stat <旧 commit> HEAD -- prisma/migrations/` が空
- マイグレーション跨ぎ・migrate 失敗時の復旧は **`down -v` → `deploy.sh <commit>` → seed の「作り直し」に一本化**。`migrate resolve` は書かない（デモ環境 ADR-20260821-4f1。実業務データを持つ環境になった時点で別 runbook）

### 6. スクリプトの品質担保
- A. 何もしない（`tls-certificates.md` の「テストの無いシェルスクリプト」論拠と矛盾）
- B. **CI `static` ジョブに shellcheck**（プリインストール版、対象 `scripts/deploy*.sh`）
- 採用: B。`changes` フィルタは `scripts/` を除外していないので `static` は自動で走る。既存の `bashrc-worktree-functions.sh` は対象外（対話シェル用で流儀が違う）。自動テストは書かず、実機デプロイ成功を完了条件にする

### 7. compose の `latest` 既定値が残ることで生じる穴
- 問題: 手動 `up -d`（tls 文書に 2 か所）や `run --rm seed` は変数未設定で `latest` に解決し、HEAD とイメージの世代がズレる。「作り直し」でロールバック後に seed を流すと旧スキーマに最新 seed が走る
- A. `${APP_IMAGE:?}` で必須化 → compose は `logs` / `exec` / `stop` を含む全コマンドでファイル全体を補間するため、読み取り系まで変数必須になり運用が壊れる。不採用
- B. **既定値は残し、`up -d` の正規経路を `deploy-apply.sh` に限定**。TAG 導出を `scripts/deploy-env.sh` に切り出し、`demo-seed.md` の seed 手順に `eval "$(scripts/deploy-env.sh)"` を前置。`tls-certificates.md` の `up -d` 2 か所を `scripts/deploy-apply.sh` に書き換え
- 採用: B

### 8. sparse-checkout
- 不採用。理由 3 点を手順書に短く残す: (1) 実害（`build:` フォールバック）は #761 で消滅し認知上の誤読しか残っていない (2) cone mode ではルート直下（`Dockerfile` / `package.json`）を消せず効果が不完全 (3) `.git/info/sparse-checkout` という git 外の状態を作り「動いているものが git から決まる」原則の例外になる。パス一覧とレイアウトの結合（旧版 `deploy.sh` が新レイアウトを知らない）も戻ってくる

### 9. 手順書の章立て（`docs/ops/deploy.md`）
1. EC2 上のクローンの役割（使うファイル 3 つの表。それ以外は「置いてあるだけ」）
2. 届ける経路は 2 つ（アプリの中身 = GHCR／起動の宣言 = git の図。起点はどちらも main マージ） 2.1 release-image が担うもの（4 点を各 1 行。詳細は ADR-20260818-7pn / #758 へポインタ）
3. 前提条件（Release Image が緑／`.env.production` は秘密のみで `*_IMAGE` を書かない／docker グループ）
4. 通常デプロイ（`scripts/deploy.sh` 1 コマンド。各行が「失敗したら止まる」ことの説明。末尾に「移行（一回限り）」小節）
5. ロールバック（設計判断 5 の 3 段）
6. 運用ルール（drift 防止: EC2 上で追跡ファイルを編集しない／HEAD が動いているもの／detached が正常／`up -d` は `deploy-apply.sh` 経由のみ／sparse-checkout を採らない理由）
7. 本手順の範囲外（初回構築 = 別イシュー・#762 と合わせる／postgres メジャー更新／ホスト側前提作業。発生時に個別 runbook）
8. トラブルシュート（pull 失敗／drift 検出で止まった／migrate 失敗 → 5 の作り直し／「本当にイメージから動いているか」の検証）

### 10. ADR
- 起票する: 「EC2 の稼働リリースをクローンの HEAD commit に固定し、イメージタグをそこから導出する」。ID は `20260829-<base36 3 桁>`
- 退けた案: `latest` 追従／Watchtower 等 pull 型自動更新／ECS・App Runner・k8s。sparse-checkout と `pull_policy: always` の却下理由は compose コメント・`deploy.md` へのポインタで済ませ重複させない
- `deploy.md` の 1〜2 章はこの ADR へのポインタで理由の再掲を減らす

### 11. 用語の置き場所
- `CONTEXT.md` は見積管理の業務用語集のため、運用語彙（リリース／デプロイ／起動の宣言／drift）は足さない。`deploy.md` の 1〜2 章で定義して閉じる

### 12. 移行（一回限り）
- 現 EC2 クローンは `main` ブランチにいて `scripts/` を持たない。初回のみ手で `git fetch origin && git checkout --detach origin/main` を打ってからスクリプトを実行する。`tls-certificates.md` 2 章と同じ流儀で 4 章末尾に置く

## 実機で確かめる点（リスク）

- EC2 から自分の公開 DNS（`chapple-esm.duckdns.org`）への `curl` が通るか（ヘアピン）。通らなければ `--resolve` でローカル 443 に向ける
- `up --wait` が certbot / nginx（healthcheck 無し）で待ち続けないこと
- `docker compose exec -T` が現行 Compose（EC2 側バージョン）で意図どおり動くこと

## ステップ

### Step 1: Issue 本文からの方針変更をコメントで記録する
- [x] **完了**
- 対象ファイル: なし（GitHub Issue #784 へのコメント）
- テスト戦略: テスト不要（Issue コメント）
- 作業内容:
  - detached checkout ＋ `git status --porcelain` への変更理由、3 ファイル構成、tls / seed 文書の整合修正がスコープに入ることを Issue にコメントする
- コミットメッセージ: なし（コミット対象なし）

### Step 2: デプロイスクリプト 3 本を追加する
- [x] **完了**
- 対象ファイル: `scripts/deploy-env.sh`, `scripts/deploy-apply.sh`, `scripts/deploy.sh`
- テスト戦略: テスト不要（運用スクリプト。静的検査は Step 3 の shellcheck、動作確認は Step 8 の実機検証）
- 作業内容:
  - `deploy-env.sh`: `git rev-parse HEAD | cut -c1-7` から `export APP_IMAGE=… MIGRATE_IMAGE=…` を標準出力に出す。副作用なし
  - `deploy-apply.sh`: `set -euo pipefail` → リポジトリ直下へ `cd` → `eval "$(scripts/deploy-env.sh)"` → 配列形式の `compose` → `pull`（失敗時に原因メッセージ）→ `up -d --remove-orphans --wait --wait-timeout 120` → `exec -T nginx nginx -t && exec -T nginx nginx -s reload` → `curl -fsS https://chapple-esm.duckdns.org/api/health` → `deployed: <sha> (<tag>)` を表示
  - `deploy.sh [ref]`: `set -euo pipefail` → リポジトリ直下へ `cd` → `git status --porcelain` が非空なら drift として停止 → `git fetch origin` → `git checkout --detach "${1:-origin/main}"` → 最終行で `exec scripts/deploy-apply.sh`
  - 各スクリプト冒頭のコメントに責務を 1〜2 行で書く（`deploy.md` の重複説明はしない）
  - ローカルで `shellcheck --severity=warning scripts/deploy*.sh` を通す
- コミットメッセージ: `ci: EC2 デプロイスクリプトを追加（git フェーズ／適用フェーズ／タグ導出の 3 ファイル）`
  - ボディに設計判断 1・3・4 の理由（detached checkout を選んだ理由、フェーズ分割の理由、`--wait` / `-T` / `cut -c1-7` の理由）を記載する

### Step 3: CI の static ジョブに shellcheck を追加する
- [x] **完了**
- 対象ファイル: `.github/workflows/ci.yml`
- テスト戦略: テスト不要（CI 設定。PR の CI 実行で検証）
- 作業内容:
  - `static` ジョブに `shellcheck --severity=warning scripts/deploy*.sh` のステップを追加する（プリインストール版。対象をデプロイスクリプトに限定する理由をコメントに書く）
- コミットメッセージ: `ci: デプロイスクリプトを shellcheck で静的検査する`

### Step 4: ADR を起票する
- [x] **完了**
- 対象ファイル: `docs/adr/20260829-<sss>-pin-ec2-release-to-head-commit-derive-image-tag.md`, `docs/adr/INDEX.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - `ls docs/adr/` で `20260829-<sss>` の衝突が無いことを確認して採番する（`openssl rand -hex 2 | cut -c1-3`）
  - `docs/adr/TEMPLATE.md` の構成で記述する。検討した選択肢: `latest` 追従（現状）／HEAD commit 固定＋SHA タグ導出（採用）／Watchtower 等 pull 型自動更新／ECS・App Runner・k8s。sparse-checkout と `pull_policy: always` はポインタのみ
  - `INDEX.md` の該当カテゴリ（デプロイ・インフラ系）に 1 行追記する
- コミットメッセージ: `docs: ADR EC2 の稼働リリースを HEAD commit に固定しイメージタグを導出する`

### Step 5: docs/ops/deploy.md を新設する
- [x] **完了**
- 対象ファイル: `docs/ops/deploy.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 設計判断 9 の 8 章構成で記述する。既存 ops 文書の体裁（冒頭で Issue と ADR を参照、`> [!IMPORTANT]` 等の callout、コマンドは `docker compose -f compose.prod.yaml --env-file .env.production` の完全形）に揃える
  - 2 経路の図（Issue コメントの ASCII 図）を含める
  - 1〜2 章の理由は ADR（Step 4）へポインタ、release-image の 4 点は各 1 行＋ ADR-20260818-7pn / #758 へポインタ
  - 4 章末尾に「移行（一回限り）」小節を置く（設計判断 12）
  - 6 章に sparse-checkout を採らない理由 3 点を短く残す（設計判断 8）
  - 8 章の「本当にイメージから動いているか」検証は Issue コメントのコマンド（`compose images app` / `docker image inspect … RepoDigests`）を使う
- コミットメッセージ: `docs: EC2 公開デモ環境への通常デプロイ手順書を追加`

### Step 6: 既存 ops 文書を新方式に整合させる
- [x] **完了**
- 対象ファイル: `docs/ops/tls-certificates.md`, `docs/ops/demo-seed.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - `tls-certificates.md`: 2 章手順 5 と 3 章手順 5 の `up -d` を `scripts/deploy-apply.sh` に書き換える。3 章冒頭の「スクリプト化はしない…テストの無いシェルスクリプト」の一文に、デプロイスクリプトは shellcheck を CI で通す旨と `deploy.md` への相互参照を足す
  - `demo-seed.md`: seed 手順の先頭に `eval "$(scripts/deploy-env.sh)"` を足し、seed が HEAD 由来の migrate イメージで走ることと、その理由（作り直しでロールバック後に seed する場面で `latest` だと旧スキーマに最新 seed が走る）を書く
- コミットメッセージ: `docs: tls / seed 手順を HEAD 由来のイメージタグで動く形に揃える`

### Step 7: CLAUDE.md と README.md にポインタを追記する
- [x] **完了**
- 対象ファイル: `CLAUDE.md`, `README.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - `CLAUDE.md` の Docker 節に「EC2 への反映は `docs/ops/deploy.md` に従う。EC2 上で追跡ファイルを直接編集しない」の 1〜2 行を追加する（規範のみ。手順は書かない）
  - `README.md` の「デプロイ（公開デモ環境）」節に `docs/ops/deploy.md` へのリンクを 1 行追加する
- コミットメッセージ: `docs: デプロイ手順書へのポインタを CLAUDE.md と README に追加`

### Step 8: 実機（EC2）でデプロイを検証し、結果を記録する
- [ ] **完了**
- 対象ファイル: `docs/claude-plans/issue-784/deviations.md`（逸脱があった場合のみ）
- テスト戦略: テスト不要（実機検証。結果を PR 本文に記録する）
- 作業内容:
  - 本ブランチのリリース（develop → main マージ）後、Release Image ワークフローの完了を待つ
  - EC2 で「移行（一回限り）」手順 → `scripts/deploy.sh` を実行し、`deployed: <sha>` まで通ることを確認する
  - 「実機で確かめる点」3 項目（ヘアピン curl／`--wait`／`exec -T`）の結果を PR 本文に記録する
  - 「本当にイメージから動いているか」の検証コマンドを実行し、`RepoDigests` が GHCR のものであることを確認する
  - 手順書と実機の差があれば `deploy.md` を修正し、計画からの逸脱は `deviations.md` に記録する
- コミットメッセージ: `docs: 実機検証の結果を deploy.md に反映`（修正が生じた場合のみ）
